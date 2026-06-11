/**
 * Relay compliance taxonomy.
 *
 * Single source of truth for compliance flag codes, which flags are hard
 * blocks, and the industry → Special Ad Category mapping. Panel 3 (copy
 * generation) and Panel 4 (launch readiness) both build on these so the rules
 * are enforced identically in both places.
 *
 * The Relay Messaging Rulebook is the authority; the codes here are the
 * machine-readable contract Claude is instructed to emit and that the server
 * enforces on top of Claude's output.
 */

import { AdCopy, COPY_LIMITS, Industry } from './brief';

// ---------------------------------------------------------------------------
// Flag codes
// ---------------------------------------------------------------------------

/**
 * Hard blocks. If any of these is present, compliance_score is forced to 0 and
 * the brief cannot advance to Panel 4 / be submitted to Meta.
 */
export const HARD_BLOCK_FLAGS = [
  'INCOME_CLAIM', // income/earnings outcome claims
  'HEALTH_OUTCOME_CLAIM', // health outcome claims
  'DISCRIMINATORY_TARGETING', // discriminatory targeting language
] as const;
export type HardBlockFlag = (typeof HARD_BLOCK_FLAGS)[number];

/**
 * Soft warnings. Surfaced to the user but do not block submission.
 */
export const SOFT_WARNING_FLAGS = [
  'VAGUE_CTA', // "learn more" / "click here" with no specific action
  'READING_LEVEL_HIGH', // above Grade 8
  'PASSIVE_VOICE', // passive-voice-heavy copy
] as const;
export type SoftWarningFlag = (typeof SOFT_WARNING_FLAGS)[number];

/**
 * Special Ad Category. Not a hard block on its own, but ads in these
 * industries are subject to Meta's Special Ad Categories and must carry this
 * flag automatically. Surfaced to the user; handled at Meta submission time.
 */
export const SPECIAL_AD_CATEGORY_FLAG = 'SPECIAL_AD_CATEGORY';

const HARD_BLOCK_SET: ReadonlySet<string> = new Set(HARD_BLOCK_FLAGS);

/**
 * Industries subject to Meta Special Ad Categories. The Rulebook names
 * healthcare, financial services, housing, and employment. Mapped onto Relay's
 * industry enum: `healthcare` and `real estate` (housing) are the two that
 * Phase 1's dropdown can produce.
 */
const SPECIAL_AD_CATEGORY_INDUSTRIES: ReadonlySet<Industry> = new Set<Industry>([
  'healthcare',
  'real estate',
]);

export function isSpecialAdCategory(industry: Industry): boolean {
  return SPECIAL_AD_CATEGORY_INDUSTRIES.has(industry);
}

export function hasHardBlock(flags: string[]): boolean {
  return flags.some((f) => HARD_BLOCK_SET.has(f));
}

export function hardBlockFlagsPresent(flags: string[]): string[] {
  return flags.filter((f) => HARD_BLOCK_SET.has(f));
}

// ---------------------------------------------------------------------------
// Compliance post-processing
// ---------------------------------------------------------------------------

/** Minimum compliance score required to advance past Panel 3 / submit. */
export const MIN_COMPLIANCE_SCORE = 60;

/**
 * Enforce Relay's server-side compliance rules on top of Claude's raw output.
 * This is deliberately not "trust the model": Special Ad Category is derived
 * from the brief's industry, and hard blocks force the score to 0 regardless
 * of what the model returned.
 *
 * Returns a new AdCopy with normalized flags and score. De-duplicates flags.
 */
export function enforceCompliance(raw: AdCopy, industry: Industry): AdCopy {
  const flags = new Set<string>(raw.compliance_flags ?? []);

  if (isSpecialAdCategory(industry)) {
    flags.add(SPECIAL_AD_CATEGORY_FLAG);
  }

  const flagList = [...flags];

  // Clamp the model's score into range, then force to 0 on any hard block.
  let score = Math.max(0, Math.min(100, Math.round(raw.compliance_score ?? 0)));
  if (hasHardBlock(flagList)) {
    score = 0;
  }

  return {
    ...raw,
    compliance_score: score,
    compliance_flags: flagList,
  };
}

// ---------------------------------------------------------------------------
// Character-limit helpers (shared with Panel 4)
// ---------------------------------------------------------------------------

export interface CharCount {
  count: number;
  limit: number;
  over: boolean;
}

export type CopyCharCounts = Record<keyof typeof COPY_LIMITS, CharCount>;

/** Per-field character counts and over-limit flags against Meta's limits. */
export function computeCharCounts(copy: Pick<AdCopy, keyof typeof COPY_LIMITS>): CopyCharCounts {
  const fields = Object.keys(COPY_LIMITS) as (keyof typeof COPY_LIMITS)[];
  return fields.reduce((acc, field) => {
    const count = (copy[field] ?? '').length;
    const limit = COPY_LIMITS[field];
    acc[field] = { count, limit, over: count > limit };
    return acc;
  }, {} as CopyCharCounts);
}

export function anyFieldOverLimit(counts: CopyCharCounts): boolean {
  return Object.values(counts).some((c) => c.over);
}
