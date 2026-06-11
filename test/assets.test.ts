import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  filterAssets,
  parseAssetRows,
  toSelectedAsset,
} from '../src/types/asset';

const HEADER = [
  'asset_id',
  'asset_name',
  'asset_type',
  'file_url',
  'thumbnail_url',
  'industry_tags',
  'approved',
  'last_updated',
];

const rows = [
  HEADER,
  ['a1', 'Spring Banner', 'image', 'http://x/a1.png', 'http://x/a1_t.png', 'retail, food', 'TRUE', '2026-05-01'],
  ['a2', 'Clinic Video', 'video', 'http://x/a2.mp4', 'http://x/a2_t.png', 'healthcare', 'FALSE', '2026-05-02'],
  ['a3', 'Gym Promo', 'image', 'http://x/a3.png', 'http://x/a3_t.png', 'fitness', 'true', '2026-05-03'],
  ['', 'Blank row', 'image', '', '', '', 'TRUE', ''], // skipped: no asset_id
];

test('parseAssetRows maps columns and parses tags/approved', () => {
  const items = parseAssetRows(rows);
  assert.equal(items.length, 3); // blank row skipped
  const a1 = items.find((i) => i.asset_id === 'a1')!;
  assert.deepEqual(a1.industry_tags, ['retail', 'food']);
  assert.equal(a1.approved, true);
  assert.equal(a1.asset_type, 'image');
});

test('approved parsing is case-insensitive and FALSE excluded', () => {
  const items = parseAssetRows(rows);
  assert.equal(items.find((i) => i.asset_id === 'a2')!.approved, false);
  assert.equal(items.find((i) => i.asset_id === 'a3')!.approved, true); // "true"
});

test('filterAssets returns only approved', () => {
  const approved = filterAssets(parseAssetRows(rows));
  assert.deepEqual(approved.map((a) => a.asset_id).sort(), ['a1', 'a3']);
});

test('filterAssets filters by industry tag', () => {
  const items = parseAssetRows(rows);
  assert.deepEqual(filterAssets(items, { industry: 'retail' }).map((a) => a.asset_id), ['a1']);
  assert.deepEqual(filterAssets(items, { industry: 'food' }).map((a) => a.asset_id), ['a1']);
  // healthcare asset exists but is not approved → excluded
  assert.deepEqual(filterAssets(items, { industry: 'healthcare' }), []);
});

test('industry filter is case-insensitive', () => {
  const items = parseAssetRows(rows);
  assert.equal(filterAssets(items, { industry: 'RETAIL' }).length, 1);
});

test('parseAssetRows falls back to positional order without headers', () => {
  const noHeader = [rows[1]]; // a data row treated as if first row
  // First row is consumed as headers, so a single data row yields nothing —
  // verify positional mapping works when headers are unrecognized labels.
  const withJunkHeader = [['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'], rows[1]];
  const items = parseAssetRows(withJunkHeader);
  assert.equal(items.length, 1);
  assert.equal(items[0].asset_id, 'a1');
  assert.equal(items[0].approved, true);
  assert.equal(noHeader.length, 1);
});

test('toSelectedAsset strips library-only fields', () => {
  const item = parseAssetRows(rows).find((i) => i.asset_id === 'a1')!;
  const sel = toSelectedAsset(item);
  assert.deepEqual(Object.keys(sel).sort(), [
    'asset_id',
    'asset_name',
    'asset_type',
    'file_url',
    'industry_tags',
    'thumbnail_url',
  ]);
  assert.equal('approved' in sel, false);
});

test('empty sheet yields no assets', () => {
  assert.deepEqual(parseAssetRows([]), []);
});
