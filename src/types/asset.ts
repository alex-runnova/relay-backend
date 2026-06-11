/**
 * Asset Library types and pure parsing/filtering logic (Panel 2).
 *
 * The Asset Library lives in a Google Sheet with columns:
 *   asset_id, asset_name, asset_type, file_url, thumbnail_url,
 *   industry_tags, approved, last_updated
 *
 * Network/auth lives in ../services/sheets.ts; this module is the pure data
 * layer so row parsing and filtering can be tested without credentials.
 */

import { SelectedAsset } from './brief';

export interface AssetLibraryItem extends SelectedAsset {
  approved: boolean;
  last_updated: string;
}

/** Canonical column keys, in the spec's order (used as positional fallback). */
export const ASSET_COLUMNS = [
  'asset_id',
  'asset_name',
  'asset_type',
  'file_url',
  'thumbnail_url',
  'industry_tags',
  'approved',
  'last_updated',
] as const;

function isTruthyApproved(raw: string | undefined): boolean {
  return typeof raw === 'string' && raw.trim().toLowerCase() === 'true';
}

function parseTags(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
}

/**
 * Map a header row to column indices. Falls back to the canonical positional
 * order for any column whose header isn't found, so a sheet that omits the
 * header row (or renames a column) still parses.
 */
function columnIndex(headers: string[]): Record<(typeof ASSET_COLUMNS)[number], number> {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  return ASSET_COLUMNS.reduce((acc, col, fallback) => {
    const found = normalized.indexOf(col);
    acc[col] = found === -1 ? fallback : found;
    return acc;
  }, {} as Record<(typeof ASSET_COLUMNS)[number], number>);
}

/**
 * Parse raw sheet rows (including the header row) into asset items.
 * Rows missing an asset_id are skipped as blank/malformed.
 */
export function parseAssetRows(rows: string[][]): AssetLibraryItem[] {
  if (!rows || rows.length === 0) return [];
  const [headers, ...dataRows] = rows;
  const idx = columnIndex(headers ?? []);

  const items: AssetLibraryItem[] = [];
  for (const row of dataRows) {
    const cell = (col: (typeof ASSET_COLUMNS)[number]) => row[idx[col]];
    const assetId = (cell('asset_id') ?? '').trim();
    if (!assetId) continue;
    items.push({
      asset_id: assetId,
      asset_name: (cell('asset_name') ?? '').trim(),
      asset_type: (cell('asset_type') ?? '').trim(),
      file_url: (cell('file_url') ?? '').trim(),
      thumbnail_url: (cell('thumbnail_url') ?? '').trim(),
      industry_tags: parseTags(cell('industry_tags')),
      approved: isTruthyApproved(cell('approved')),
      last_updated: (cell('last_updated') ?? '').trim(),
    });
  }
  return items;
}

export interface AssetFilter {
  /** Brief industry to match against industry_tags (case-insensitive). */
  industry?: string;
}

/**
 * Only approved assets, optionally filtered to those tagged for the given
 * industry. Per spec, only rows where approved = TRUE are ever surfaced.
 */
export function filterAssets(items: AssetLibraryItem[], filter: AssetFilter = {}): AssetLibraryItem[] {
  const industry = filter.industry?.trim().toLowerCase();
  return items.filter((a) => {
    if (!a.approved) return false;
    if (industry && !a.industry_tags.includes(industry)) return false;
    return true;
  });
}

/** Strip library-only fields to the SelectedAsset shape stored on a brief. */
export function toSelectedAsset(item: AssetLibraryItem): SelectedAsset {
  return {
    asset_id: item.asset_id,
    asset_name: item.asset_name,
    asset_type: item.asset_type,
    file_url: item.file_url,
    thumbnail_url: item.thumbnail_url,
    industry_tags: item.industry_tags,
  };
}
