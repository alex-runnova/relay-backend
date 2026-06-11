/**
 * Google Sheets service (Panel 2 + Campaign Log).
 *
 * Auth: a service account whose JSON key is provided base64-encoded in
 * GOOGLE_SERVICE_ACCOUNT_KEY. Reads the Asset Library (ASSET_SHEET_ID) and
 * appends to the Campaign Log (CAMPAIGN_LOG_SHEET_ID).
 *
 * The Asset Library read is cached briefly; the Panel 2 "refresh" button
 * bypasses the cache via `forceRefresh`.
 */

import { GoogleAuth } from 'google-auth-library';
import {
  AssetLibraryItem,
  parseAssetRows,
} from '../types/asset';

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const ASSET_RANGE = 'A:H'; // 8 columns per the Asset Library schema
const CACHE_TTL_MS = 60_000;

let auth: GoogleAuth | null = null;

function getAuth(): GoogleAuth {
  if (auth) return auth;
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!encoded) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set.');
  }
  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid base64-encoded JSON.');
  }
  auth = new GoogleAuth({ credentials, scopes: [SHEETS_SCOPE] });
  return auth;
}

async function authHeader(): Promise<string> {
  const token = await getAuth().getAccessToken();
  if (!token) throw new Error('Failed to obtain Google access token.');
  return `Bearer ${token}`;
}

function requireSheetId(envVar: 'ASSET_SHEET_ID' | 'CAMPAIGN_LOG_SHEET_ID'): string {
  const id = process.env[envVar];
  if (!id) throw new Error(`${envVar} is not set.`);
  return id;
}

// ---------------------------------------------------------------------------
// Asset Library read
// ---------------------------------------------------------------------------

let assetCache: { items: AssetLibraryItem[]; fetchedAt: number } | null = null;

async function fetchAssetRows(): Promise<string[][]> {
  const sheetId = requireSheetId('ASSET_SHEET_ID');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    sheetId,
  )}/values/${encodeURIComponent(ASSET_RANGE)}`;

  const res = await fetch(url, { headers: { Authorization: await authHeader() } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Asset sheet fetch failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { values?: string[][] };
  return data.values ?? [];
}

/**
 * All assets in the library (approved and not), cached for CACHE_TTL_MS.
 * Callers filter with filterAssets(); the route surfaces only approved rows.
 */
export async function loadAssets(forceRefresh = false): Promise<AssetLibraryItem[]> {
  const fresh = assetCache && Date.now() - assetCache.fetchedAt < CACHE_TTL_MS;
  if (fresh && !forceRefresh) {
    return assetCache!.items;
  }
  const rows = await fetchAssetRows();
  const items = parseAssetRows(rows);
  assetCache = { items, fetchedAt: Date.now() };
  return items;
}

/** Test/dev helper — clears the asset cache. */
export function _clearAssetCache(): void {
  assetCache = null;
}

// ---------------------------------------------------------------------------
// Campaign Log append (used by Panel 4 on submission)
// ---------------------------------------------------------------------------

export interface CampaignLogRow {
  brief_id: string;
  brief_name: string;
  owner: string;
  industry: string;
  submitted_at: string;
  meta_ad_id: string;
  meta_campaign_id: string;
  meta_review_status: string;
  meta_permalink: string;
  compliance_score: number;
}

/**
 * Append one row to the Campaign Log. Per spec, a log-write failure must never
 * block or roll back a Meta submission — callers should catch and continue.
 */
export async function appendCampaignLog(row: CampaignLogRow): Promise<void> {
  const sheetId = requireSheetId('CAMPAIGN_LOG_SHEET_ID');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    sheetId,
  )}/values/${encodeURIComponent('A:J')}:append?valueInputOption=RAW`;

  const values = [[
    row.brief_id,
    row.brief_name,
    row.owner,
    row.industry,
    row.submitted_at,
    row.meta_ad_id,
    row.meta_campaign_id,
    row.meta_review_status,
    row.meta_permalink,
    String(row.compliance_score),
  ]];

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: await authHeader(), 'content-type': 'application/json' },
    body: JSON.stringify({ values }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Campaign log append failed (${res.status}): ${body.slice(0, 200)}`);
  }
}
