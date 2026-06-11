import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  anyFieldOverLimit,
  computeCharCounts,
  enforceCompliance,
  hasHardBlock,
  isSpecialAdCategory,
  MIN_COMPLIANCE_SCORE,
} from '../src/types/compliance';
import { normalizeCopy } from '../src/services/claude';
import { AdCopy } from '../src/types/brief';

const baseCopy: AdCopy = {
  headline: 'Save on fresh local groceries',
  primary_text: 'Shop neighborhood produce delivered to your door this week.',
  description: 'Order today',
  cta_suggestion: 'Shop now',
  compliance_score: 85,
  compliance_flags: [],
};

test('hard block forces compliance score to 0', () => {
  const result = enforceCompliance(
    { ...baseCopy, compliance_score: 90, compliance_flags: ['INCOME_CLAIM'] },
    'retail',
  );
  assert.equal(result.compliance_score, 0);
  assert.ok(hasHardBlock(result.compliance_flags));
});

test('soft warning does not zero the score', () => {
  const result = enforceCompliance(
    { ...baseCopy, compliance_score: 72, compliance_flags: ['VAGUE_CTA'] },
    'retail',
  );
  assert.equal(result.compliance_score, 72);
});

test('healthcare auto-adds SPECIAL_AD_CATEGORY', () => {
  const result = enforceCompliance({ ...baseCopy, compliance_flags: [] }, 'healthcare');
  assert.ok(result.compliance_flags.includes('SPECIAL_AD_CATEGORY'));
  assert.ok(isSpecialAdCategory('healthcare'));
});

test('real estate auto-adds SPECIAL_AD_CATEGORY (housing)', () => {
  const result = enforceCompliance({ ...baseCopy }, 'real estate');
  assert.ok(result.compliance_flags.includes('SPECIAL_AD_CATEGORY'));
});

test('retail is not a special ad category', () => {
  assert.equal(isSpecialAdCategory('retail'), false);
});

test('score is clamped into 0-100', () => {
  assert.equal(enforceCompliance({ ...baseCopy, compliance_score: 140 }, 'retail').compliance_score, 100);
  assert.equal(enforceCompliance({ ...baseCopy, compliance_score: -5 }, 'retail').compliance_score, 0);
});

test('flags are de-duplicated', () => {
  const result = enforceCompliance(
    { ...baseCopy, compliance_flags: ['VAGUE_CTA', 'VAGUE_CTA'] },
    'retail',
  );
  assert.equal(result.compliance_flags.filter((f) => f === 'VAGUE_CTA').length, 1);
});

test('computeCharCounts flags over-limit fields', () => {
  const counts = computeCharCounts({
    headline: 'x'.repeat(50), // limit 40
    primary_text: 'ok',
    description: 'ok',
  });
  assert.equal(counts.headline.over, true);
  assert.equal(counts.headline.limit, 40);
  assert.equal(counts.primary_text.over, false);
  assert.ok(anyFieldOverLimit(counts));
});

test('MIN_COMPLIANCE_SCORE is 60', () => {
  assert.equal(MIN_COMPLIANCE_SCORE, 60);
});

test('normalizeCopy tolerates missing fields and string scores', () => {
  const c = normalizeCopy({ headline: 'Hi', compliance_score: '77', compliance_flags: ['VAGUE_CTA', 5] });
  assert.equal(c.headline, 'Hi');
  assert.equal(c.primary_text, '');
  assert.equal(c.compliance_score, 77);
  assert.deepEqual(c.compliance_flags, ['VAGUE_CTA']);
});
