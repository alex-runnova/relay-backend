/**
 * Meta Ads API service (Panel 4 submission).
 *
 * Creates a PAUSED ad in the connected ad account via the Graph API. Phase 1
 * is Meta-only. Auth uses a long-lived token (META_ACCESS_TOKEN) against the
 * account in META_AD_ACCOUNT_ID.
 *
 * Ad creation on Meta is a 4-step sequence: campaign → ad set → ad creative →
 * ad. Every entity is created PAUSED so nothing spends until a human resumes
 * it in Business Manager.
 *
 * Pure helpers (objective mapping, budget conversion, account-id normalization,
 * error parsing) are exported for unit testing without network access.
 */

import { Brief, CampaignObjective, Industry, MetaSubmission } from '../types/brief';

const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** Relay campaign objectives → Meta Outcome-based objectives (ODAX). */
const OBJECTIVE_MAP: Record<CampaignObjective, string> = {
  AWARENESS: 'OUTCOME_AWARENESS',
  TRAFFIC: 'OUTCOME_TRAFFIC',
  ENGAGEMENT: 'OUTCOME_ENGAGEMENT',
  LEADS: 'OUTCOME_LEADS',
  CONVERSIONS: 'OUTCOME_SALES',
};

export function mapObjective(objective: CampaignObjective): string {
  return OBJECTIVE_MAP[objective];
}

/**
 * Per-objective ad-set optimization. Phase 1 keeps every objective on a
 * setup-free combo: billing on impressions, optimizing for a goal that needs
 * no pixel or on-Meta lead form. CONVERSIONS/LEADS drive to the landing page
 * (LINK_CLICKS) rather than requiring a pixel or instant form — noted as a
 * Phase 1 simplification.
 */
const OPTIMIZATION_MAP: Record<CampaignObjective, { optimization_goal: string; billing_event: string }> = {
  AWARENESS: { optimization_goal: 'REACH', billing_event: 'IMPRESSIONS' },
  TRAFFIC: { optimization_goal: 'LINK_CLICKS', billing_event: 'IMPRESSIONS' },
  ENGAGEMENT: { optimization_goal: 'POST_ENGAGEMENT', billing_event: 'IMPRESSIONS' },
  LEADS: { optimization_goal: 'LINK_CLICKS', billing_event: 'IMPRESSIONS' },
  CONVERSIONS: { optimization_goal: 'LINK_CLICKS', billing_event: 'IMPRESSIONS' },
};

export function mapOptimization(objective: CampaignObjective) {
  return OPTIMIZATION_MAP[objective];
}

/**
 * Map a Relay industry to Meta's Special Ad Categories enum. Only a subset of
 * Relay industries map to a real Meta SAC: `real estate` → HOUSING. Healthcare
 * carries Relay's internal SPECIAL_AD_CATEGORY warning but is NOT a Meta SAC,
 * so it submits with no category (sending an invalid value would 400).
 */
export function metaSpecialAdCategories(industry: Industry): string[] {
  return industry === 'real estate' ? ['HOUSING'] : [];
}

export function usdToCents(usd: number): number {
  return Math.round(usd * 100);
}

/** Ensure the account id carries the Graph API `act_` prefix exactly once. */
export function normalizeAccountId(id: string): string {
  const trimmed = id.trim();
  return trimmed.startsWith('act_') ? trimmed : `act_${trimmed}`;
}

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'campaign';
}

/**
 * Append UTM parameters to the destination URL so PostHog can attribute
 * `trial_started` conversions back to the brief, campaign, and angle. Existing
 * query params the user added are preserved (never overwritten). Returns the
 * original string unchanged if it isn't a valid URL.
 */
export function buildTrackedUrl(brief: Brief): string {
  try {
    const url = new URL(brief.destination_url);
    const set = (k: string, v: string) => {
      if (!url.searchParams.has(k)) url.searchParams.set(k, v);
    };
    set('utm_source', 'facebook');
    set('utm_medium', 'paid_social');
    set('utm_campaign', slugify(brief.brief_name));
    set('utm_content', brief.messaging_angle ?? 'unspecified');
    set('utm_term', brief.id); // exact per-brief attribution
    return url.toString();
  } catch {
    return brief.destination_url;
  }
}

/** A Meta policy/validation rejection, carrying the surfaced reason. */
export class MetaApiError extends Error {
  readonly status: number;
  readonly metaCode?: number;
  constructor(message: string, status: number, metaCode?: number) {
    super(message);
    this.name = 'MetaApiError';
    this.status = status;
    this.metaCode = metaCode;
  }
}

/**
 * Extract the most user-meaningful message from a Graph API error body.
 * Prefers `error_user_msg` (the policy-rejection reason Meta surfaces to
 * advertisers) over the generic `message`.
 */
export function parseMetaError(body: unknown): {
  message: string;
  code?: number;
  subcode?: number;
  fbtrace?: string;
} {
  const err = (body as { error?: Record<string, unknown> })?.error;
  if (!err) return { message: 'Unknown Meta API error.' };
  const userMsg = typeof err.error_user_msg === 'string' ? err.error_user_msg : undefined;
  const message = typeof err.message === 'string' ? err.message : undefined;
  const title = typeof err.error_user_title === 'string' ? err.error_user_title : undefined;
  const code = typeof err.code === 'number' ? err.code : undefined;
  const subcode = typeof err.error_subcode === 'number' ? err.error_subcode : undefined;
  const fbtrace = typeof err.fbtrace_id === 'string' ? err.fbtrace_id : undefined;
  const best = userMsg ? (title ? `${title}: ${userMsg}` : userMsg) : message ?? 'Meta API error.';
  return { message: best, code, subcode, fbtrace };
}

/** Build a debuggable message with Meta's code/subcode/trace appended. */
function metaErrorMessage(parsed: ReturnType<typeof parseMetaError>): string {
  const bits: string[] = [];
  if (parsed.code !== undefined) bits.push(`code ${parsed.code}`);
  if (parsed.subcode !== undefined) bits.push(`subcode ${parsed.subcode}`);
  if (parsed.fbtrace) bits.push(`trace ${parsed.fbtrace}`);
  return bits.length ? `${parsed.message} (${bits.join(', ')})` : parsed.message;
}

interface MetaConfig {
  accessToken: string;
  accountId: string;
  pageId: string;
}

function getConfig(): MetaConfig {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const accountIdRaw = process.env.META_AD_ACCOUNT_ID;
  const pageId = process.env.META_PAGE_ID;
  if (!accessToken) throw new Error('META_ACCESS_TOKEN is not set.');
  if (!accountIdRaw) throw new Error('META_AD_ACCOUNT_ID is not set.');
  if (!pageId) throw new Error('META_PAGE_ID is not set (required for the ad creative).');
  return { accessToken, accountId: normalizeAccountId(accountIdRaw), pageId };
}

/**
 * Extract an image hash from a Graph `/adimages` upload response.
 * Shape: { images: { "<filename>": { hash, url } } }. Returns the first hash.
 */
export function parseImageHashResponse(body: unknown): string | null {
  const images = (body as { images?: Record<string, { hash?: string }> })?.images;
  if (!images) return null;
  for (const entry of Object.values(images)) {
    if (entry?.hash) return entry.hash;
  }
  return null;
}

/**
 * Convert a Google Drive share/view URL into one that actually serves image
 * bytes to a server-side fetch (and to Meta). Drive's `uc?export=view` links
 * return an HTML interstitial, not the image — the thumbnail endpoint serves a
 * real JPEG. Non-Drive URLs are returned unchanged.
 */
export function toFetchableImageUrl(url: string): string {
  if (!url.includes('drive.google.com')) return url;
  const m = url.match(/(?:\/d\/|[?&]id=)([a-zA-Z0-9_-]+)/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1600` : url;
}

/**
 * Upload an image to the ad account by fetching its bytes from `imageUrl` and
 * POSTing to /adimages, returning the resulting image_hash. Meta creatives are
 * far more reliable with an uploaded image_hash than a raw picture URL. Returns
 * null on any failure so the caller can fall back to the URL.
 */
export async function uploadAdImage(
  accountId: string,
  accessToken: string,
  imageUrl: string,
): Promise<string | null> {
  try {
    const imgRes = await fetch(toFetchableImageUrl(imageUrl));
    if (!imgRes.ok) return null;
    const bytes = Buffer.from(await imgRes.arrayBuffer());

    const form = new FormData();
    form.set('access_token', accessToken);
    form.set('source', new Blob([bytes], { type: 'image/jpeg' }), 'image.jpg');

    const res = await fetch(`${GRAPH_BASE}/${accountId}/adimages`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) return null;
    return parseImageHashResponse(await res.json().catch(() => ({})));
  } catch {
    return null;
  }
}

/** POST to a Graph API edge; throws MetaApiError on a non-OK response. */
async function graphPost(
  path: string,
  params: Record<string, unknown>,
  accessToken: string,
  step = 'meta',
): Promise<Record<string, unknown>> {
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    form.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  form.set('access_token', accessToken);

  const res = await fetch(`${GRAPH_BASE}/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const parsed = parseMetaError(json);
    throw new MetaApiError(`[${step}] ${metaErrorMessage(parsed)}`, res.status, parsed.code);
  }
  return json;
}

/**
 * Create a PAUSED ad for the brief and return the resulting identifiers.
 *
 * Targeting is kept to the brief's city plus the US (Phase 1). Meta requires
 * geo *keys* for precise city targeting; until a city-key lookup is added we
 * target the country and record the city in the ad name, which is sufficient
 * for a PAUSED draft that a human reviews before resuming.
 */
export async function createPausedAd(brief: Brief): Promise<MetaSubmission> {
  const { accessToken, accountId, pageId } = getConfig();
  const copy = brief.copy;
  const asset = brief.selected_asset;
  if (!copy) throw new Error('Brief has no copy to submit.');
  if (!asset) throw new Error('Brief has no asset to submit.');
  if (!brief.destination_url) throw new Error('Brief has no destination URL to submit.');

  const campaignName = `${brief.brief_name} — ${brief.city}`;
  const opt = mapOptimization(brief.objective);

  // 1. Campaign (budget lives here — CBO; avoids the ad-set budget-sharing field)
  const campaign = await graphPost(
    `${accountId}/campaigns`,
    {
      name: campaignName,
      objective: mapObjective(brief.objective),
      status: 'PAUSED',
      special_ad_categories: metaSpecialAdCategories(brief.industry),
      daily_budget: usdToCents(brief.daily_budget_usd),
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP', // autobid — no bid_amount required
    },
    accessToken,
    'campaign',
  );
  const campaignId = String(campaign.id);

  // 2. Ad set (no budget — inherited from the CBO campaign)
  const adSet = await graphPost(
    `${accountId}/adsets`,
    {
      name: `${campaignName} — Ad Set`,
      campaign_id: campaignId,
      billing_event: opt.billing_event,
      optimization_goal: opt.optimization_goal,
      targeting: { geo_locations: { countries: ['US'] } },
      status: 'PAUSED',
    },
    accessToken,
    'ad set',
  );
  const adSetId = String(adSet.id);

  // 3. Ad creative (requires page_id + a destination link).
  // Prefer an uploaded image_hash (more reliable than a raw picture URL); fall
  // back to the asset URL if the upload fails.
  const imageHash = await uploadAdImage(accountId, accessToken, asset.file_url);
  const linkData: Record<string, unknown> = {
    link: buildTrackedUrl(brief), // UTM-tagged for PostHog conversion attribution
    message: copy.primary_text,
    name: copy.headline,
    description: copy.description,
    call_to_action: { type: 'SIGN_UP' }, // Relay's goal is free-trial signups
    ...(imageHash ? { image_hash: imageHash } : { picture: toFetchableImageUrl(asset.file_url) }),
  };
  const creative = await graphPost(
    `${accountId}/adcreatives`,
    {
      name: `${campaignName} — Creative`,
      object_story_spec: { page_id: pageId, link_data: linkData },
    },
    accessToken,
    'creative',
  );
  const creativeId = String(creative.id);

  // 4. Ad
  const ad = await graphPost(
    `${accountId}/ads`,
    {
      name: campaignName,
      adset_id: adSetId,
      creative: { creative_id: creativeId },
      status: 'PAUSED',
    },
    accessToken,
    'ad',
  );
  const adId = String(ad.id);

  // Best-effort review status (non-fatal if it fails).
  let reviewStatus = 'PENDING_REVIEW';
  try {
    const detail = await fetchAdReviewStatus(adId, accessToken);
    if (detail) reviewStatus = detail;
  } catch {
    /* leave default */
  }

  return {
    ad_id: adId,
    campaign_id: campaignId,
    review_status: reviewStatus,
    permalink: `https://business.facebook.com/adsmanager/manage/ads?act=${accountId.replace(
      'act_',
      '',
    )}&selected_ad_ids=${adId}`,
    submitted_at: new Date().toISOString(),
  };
}

async function fetchAdReviewStatus(adId: string, accessToken: string): Promise<string | null> {
  const res = await fetch(
    `${GRAPH_BASE}/${adId}?fields=effective_status&access_token=${encodeURIComponent(accessToken)}`,
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { effective_status?: string };
  return json.effective_status ?? null;
}
