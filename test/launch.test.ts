import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Brief } from '../src/types/brief';
import { checkReadiness } from '../src/types/readiness';
import {
  mapObjective,
  normalizeAccountId,
  parseMetaError,
  usdToCents,
} from '../src/services/meta';

const TODAY = new Date('2026-06-11T00:00:00Z');

function readyBrief(): Brief {
  return {
    id: 'b1',
    status: 'draft',
    brief_name: 'Spring',
    owner: 'Nic',
    industry: 'retail',
    city: 'Pittsburgh',
    objective: 'TRAFFIC',
    tone: 'bold',
    target_audience: 'Locals',
    product_description: 'Leather goods',
    key_message: 'Built to last',
    daily_budget_usd: 25,
    start_date: '2026-07-01',
    end_date: '2026-07-31',
    created_at: TODAY.toISOString(),
    last_modified: TODAY.toISOString(),
    selected_asset: {
      asset_id: 'a1',
      asset_name: 'Banner',
      asset_type: 'image',
      file_url: 'http://x/a1.png',
      thumbnail_url: 'http://x/a1_t.png',
      industry_tags: ['retail'],
    },
    copy: {
      headline: 'Save on local leather',
      primary_text: 'Handmade bags built to last, from your neighborhood maker.',
      description: 'Shop today',
      cta_suggestion: 'Shop now',
      compliance_score: 88,
      compliance_flags: [],
    },
  };
}

test('a complete brief passes all readiness checks', () => {
  const r = checkReadiness(readyBrief(), { today: TODAY, assetUrlAccessible: true });
  assert.equal(r.ready, true, JSON.stringify(r.failures));
  assert.equal(r.failures.length, 0);
});

test('missing copy fails copy + char-limit + compliance checks', () => {
  const b = readyBrief();
  delete b.copy;
  const r = checkReadiness(b, { today: TODAY, assetUrlAccessible: true });
  assert.equal(r.ready, false);
  assert.ok(r.checks.find((c) => c.id === 'copy_present' && !c.passed));
  assert.ok(r.checks.find((c) => c.id === 'compliance_score' && !c.passed));
});

test('over-limit copy fails char_limits', () => {
  const b = readyBrief();
  b.copy!.headline = 'x'.repeat(60);
  const r = checkReadiness(b, { today: TODAY, assetUrlAccessible: true });
  assert.equal(r.ready, false);
  assert.ok(r.checks.find((c) => c.id === 'char_limits' && !c.passed));
});

test('unreachable asset URL fails asset_url', () => {
  const r = checkReadiness(readyBrief(), { today: TODAY, assetUrlAccessible: false });
  assert.ok(r.checks.find((c) => c.id === 'asset_url' && !c.passed));
});

test('no asset fails asset_attached and skips asset_url', () => {
  const b = readyBrief();
  delete b.selected_asset;
  const r = checkReadiness(b, { today: TODAY });
  assert.ok(r.checks.find((c) => c.id === 'asset_attached' && !c.passed));
  assert.equal(r.checks.find((c) => c.id === 'asset_url'), undefined);
});

test('budget below $5 fails budget check', () => {
  const b = readyBrief();
  b.daily_budget_usd = 3;
  const r = checkReadiness(b, { today: TODAY, assetUrlAccessible: true });
  assert.ok(r.checks.find((c) => c.id === 'budget' && !c.passed));
});

test('past flight end fails flight_dates', () => {
  const b = readyBrief();
  b.start_date = '2026-01-01';
  b.end_date = '2026-02-01';
  const r = checkReadiness(b, { today: TODAY, assetUrlAccessible: true });
  assert.ok(r.checks.find((c) => c.id === 'flight_dates' && !c.passed));
});

test('compliance score below 60 fails', () => {
  const b = readyBrief();
  b.copy!.compliance_score = 55;
  const r = checkReadiness(b, { today: TODAY, assetUrlAccessible: true });
  assert.ok(r.checks.find((c) => c.id === 'compliance_score' && !c.passed));
});

test('hard-block flag fails no_hard_blocks', () => {
  const b = readyBrief();
  b.copy!.compliance_flags = ['HEALTH_OUTCOME_CLAIM'];
  const r = checkReadiness(b, { today: TODAY, assetUrlAccessible: true });
  assert.ok(r.checks.find((c) => c.id === 'no_hard_blocks' && !c.passed));
});

// --- Meta pure helpers ---

test('mapObjective maps to Meta ODAX objectives', () => {
  assert.equal(mapObjective('CONVERSIONS'), 'OUTCOME_SALES');
  assert.equal(mapObjective('LEADS'), 'OUTCOME_LEADS');
  assert.equal(mapObjective('AWARENESS'), 'OUTCOME_AWARENESS');
});

test('usdToCents converts dollars to integer cents', () => {
  assert.equal(usdToCents(25), 2500);
  assert.equal(usdToCents(5.5), 550);
});

test('normalizeAccountId adds act_ prefix once', () => {
  assert.equal(normalizeAccountId('12345'), 'act_12345');
  assert.equal(normalizeAccountId('act_12345'), 'act_12345');
});

test('parseMetaError prefers error_user_msg', () => {
  const { message } = parseMetaError({
    error: { message: 'generic', error_user_title: 'Policy', error_user_msg: 'Ad violates policy X', code: 1885 },
  });
  assert.equal(message, 'Policy: Ad violates policy X');
});

test('parseMetaError falls back to message', () => {
  assert.equal(parseMetaError({ error: { message: 'Invalid budget' } }).message, 'Invalid budget');
});
