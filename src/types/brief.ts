/**
 * Relay Canonical Ad Brief data model (Phase 1 — Meta only).
 *
 * This file is the single source of truth for the Brief shape. Validation
 * (src/validation/brief.ts) and storage (src/store/briefStore.ts) both build
 * on these types. Integration-specific shapes (Claude copy output, Meta
 * submission result, asset metadata) live here too so the Brief can carry
 * them through the four-panel workflow.
 */

// ---------------------------------------------------------------------------
// Enumerations (closed sets from the spec — used for dropdown validation)
// ---------------------------------------------------------------------------

export const INDUSTRIES = [
  'retail',
  'food',
  'healthcare',
  'real estate',
  'fitness',
  'education',
  'other',
] as const;
export type Industry = (typeof INDUSTRIES)[number];

export const CAMPAIGN_OBJECTIVES = [
  'AWARENESS',
  'TRAFFIC',
  'ENGAGEMENT',
  'LEADS',
  'CONVERSIONS',
] as const;
export type CampaignObjective = (typeof CAMPAIGN_OBJECTIVES)[number];

export const TONES = [
  'professional',
  'conversational',
  'urgent',
  'inspirational',
  'bold',
] as const;
export type Tone = (typeof TONES)[number];

/**
 * Brief lifecycle. A brief always starts as `draft`. It becomes
 * `ready_for_meta` once Panel 4's launch-readiness checks pass, and
 * `submitted` once a Meta ad has been created. `submitted` is terminal and
 * read-only — revisions are made by cloning into a fresh `draft`.
 */
export const BRIEF_STATUSES = ['draft', 'ready_for_meta', 'submitted'] as const;
export type BriefStatus = (typeof BRIEF_STATUSES)[number];

// Meta character limits, kept alongside the model so Panel 3 and Panel 4
// validate against the same numbers.
export const COPY_LIMITS = {
  headline: 40,
  primary_text: 125,
  description: 30,
} as const;

export const MIN_DAILY_BUDGET_USD = 5;

// ---------------------------------------------------------------------------
// Sub-objects attached to a brief as it moves through the panels
// ---------------------------------------------------------------------------

/** Selected asset metadata from the Google Sheets Asset Library (Panel 2). */
export interface SelectedAsset {
  asset_id: string;
  asset_name: string;
  asset_type: string; // "image" | "video" — kept open until Sheets wiring
  file_url: string;
  thumbnail_url: string;
  industry_tags: string[];
}

/** Structured copy returned by Claude and/or hand-edited by the user (Panel 3). */
export interface AdCopy {
  headline: string; // max 40 chars
  primary_text: string; // max 125 chars
  description: string; // max 30 chars
  cta_suggestion: string;
  compliance_score: number; // 0–100
  compliance_flags: string[]; // rule-violation codes, e.g. SPECIAL_AD_CATEGORY
  /** True once a user manually edits a field after generation. */
  edited?: boolean;
}

/** Result of a successful Meta submission (Panel 4). */
export interface MetaSubmission {
  ad_id: string;
  campaign_id: string;
  review_status: string;
  permalink: string;
  submitted_at: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// The Brief
// ---------------------------------------------------------------------------

/** Fields the client supplies/edits. Everything else is server-managed. */
export interface BriefInput {
  brief_name: string;
  owner: string;
  industry: Industry;
  city: string; // defaults to "Pittsburgh"
  objective: CampaignObjective;
  tone: Tone;
  target_audience: string;
  product_description: string;
  key_message: string;
  destination_url: string; // click-through URL for the Meta link ad
  daily_budget_usd: number; // min 5
  start_date: string; // ISO date (YYYY-MM-DD)
  end_date: string; // ISO date (YYYY-MM-DD)
}

/** The full persisted brief, including workflow state and panel artifacts. */
export interface Brief extends BriefInput {
  id: string;
  status: BriefStatus;

  // Panel artifacts — populated as the user advances.
  selected_asset?: SelectedAsset;
  copy?: AdCopy;
  meta_submission?: MetaSubmission;

  // Clone provenance: set when this brief was created by cloning another.
  cloned_from?: string;

  created_at: string; // ISO 8601
  last_modified: string; // ISO 8601
}

export const CITY_DEFAULT = 'Pittsburgh';
