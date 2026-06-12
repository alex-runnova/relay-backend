/**
 * PostHog conversions service (Panel 4 per-brief signup counts).
 *
 * Free-trial signups are the `trial_started` event (and `trial_converted` for
 * trial→paid). The event itself has no UTM props, so we attribute via the
 * person's first-touch UTM (`$initial_utm_term`), which Relay sets to the
 * brief id on the ad link. One grouped HogQL query returns counts per brief.
 *
 * Gated on POSTHOG_API_KEY (a personal API key with query scope). Host and
 * project default to the Relay project but are env-overridable. The deployed
 * backend can't use the PostHog MCP, so it queries the HTTP API directly.
 */

const HOST = (process.env.POSTHOG_HOST || 'https://us.posthog.com').replace(/\/$/, '');
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID || '349303';
const CACHE_TTL_MS = 60_000;

export interface Conversions {
  trial_started: number;
  trial_converted: number;
}
export type ConversionsByBrief = Record<string, Conversions>;

export function isPostHogConfigured(): boolean {
  return Boolean(process.env.POSTHOG_API_KEY);
}

// Attribute by first-touch UTM term (= brief id) on Relay's facebook ads.
const HOGQL_QUERY = `
SELECT person.properties['$initial_utm_term'] AS brief,
       countIf(event = 'trial_started') AS started,
       countIf(event = 'trial_converted') AS converted
FROM events
WHERE event IN ('trial_started', 'trial_converted')
  AND person.properties['$initial_utm_source'] = 'facebook'
  AND person.properties['$initial_utm_term'] != ''
GROUP BY brief`.trim();

/** Parse PostHog query rows ([brief, started, converted]) into a map. Pure. */
export function parseConversionRows(results: unknown): ConversionsByBrief {
  const rows = Array.isArray(results) ? results : [];
  const out: ConversionsByBrief = {};
  for (const r of rows) {
    if (!Array.isArray(r)) continue;
    const [brief, started, converted] = r;
    if (typeof brief !== 'string' || !brief) continue;
    out[brief] = {
      trial_started: Number(started) || 0,
      trial_converted: Number(converted) || 0,
    };
  }
  return out;
}

let cache: { data: ConversionsByBrief; at: number } | null = null;

/** Conversions keyed by brief id, cached briefly. Throws if PostHog errors. */
export async function getConversionsByBrief(forceRefresh = false): Promise<ConversionsByBrief> {
  const key = process.env.POSTHOG_API_KEY;
  if (!key) throw new Error('POSTHOG_API_KEY is not set.');
  if (cache && !forceRefresh && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

  const res = await fetch(`${HOST}/api/projects/${encodeURIComponent(PROJECT_ID)}/query/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query: HOGQL_QUERY } }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PostHog query failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { results?: unknown };
  const parsed = parseConversionRows(data.results);
  cache = { data: parsed, at: Date.now() };
  return parsed;
}
