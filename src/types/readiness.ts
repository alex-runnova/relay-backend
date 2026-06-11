/**
 * Panel 4 — Launch Readiness checks.
 *
 * Pure validation over a brief plus a couple of externally-determined inputs
 * (today's date, whether the asset URL is reachable). The route performs the
 * async asset-URL probe and passes the result in, so this stays testable.
 *
 * Every check the spec lists is represented so the UI can render a red banner
 * itemizing exactly what failed.
 */

import { Brief, MIN_DAILY_BUDGET_USD } from './brief';
import {
  anyFieldOverLimit,
  computeCharCounts,
  hardBlockFlagsPresent,
  MIN_COMPLIANCE_SCORE,
} from './compliance';

export interface ReadinessCheck {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
}

export interface ReadinessResult {
  ready: boolean;
  checks: ReadinessCheck[];
  failures: string[]; // labels (+detail) of failed checks, for the red banner
}

export interface ReadinessContext {
  /** "Now" for the future-dated flight check. */
  today: Date;
  /**
   * Whether the selected asset's file_url responded OK to a reachability
   * probe. Undefined when no asset is attached (the asset-attached check
   * fails first in that case).
   */
  assetUrlAccessible?: boolean;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function startOfDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function checkReadiness(brief: Brief, ctx: ReadinessContext): ReadinessResult {
  const checks: ReadinessCheck[] = [];
  const add = (id: string, label: string, passed: boolean, detail?: string) =>
    checks.push({ id, label, passed, detail });

  // 1. Copy exists and is within Meta character limits.
  const copy = brief.copy;
  if (!copy) {
    add('copy_present', 'Ad copy has been generated', false, 'No copy generated yet.');
    add('char_limits', 'All copy fields are within Meta character limits', false, 'No copy to check.');
  } else {
    add('copy_present', 'Ad copy has been generated', true);
    const counts = computeCharCounts(copy);
    const over = Object.entries(counts)
      .filter(([, c]) => c.over)
      .map(([field, c]) => `${field} ${c.count}/${c.limit}`);
    add(
      'char_limits',
      'All copy fields are within Meta character limits',
      !anyFieldOverLimit(counts),
      over.length ? `Over limit: ${over.join(', ')}.` : undefined,
    );
  }

  // 2. Asset attached + URL accessible.
  const asset = brief.selected_asset;
  add('asset_attached', 'A creative asset is attached', !!asset, asset ? undefined : 'No asset selected.');
  if (asset) {
    add(
      'asset_url',
      'Asset URL is accessible',
      ctx.assetUrlAccessible === true,
      ctx.assetUrlAccessible === true ? undefined : `Could not reach ${asset.file_url}.`,
    );
  }

  // 3. Budget >= $5/day.
  add(
    'budget',
    `Daily budget is at least $${MIN_DAILY_BUDGET_USD}`,
    Number.isFinite(brief.daily_budget_usd) && brief.daily_budget_usd >= MIN_DAILY_BUDGET_USD,
    `Budget is $${brief.daily_budget_usd}/day.`,
  );

  // 4. Flight dates valid and in the future.
  const startValid = ISO_DATE.test(brief.start_date);
  const endValid = ISO_DATE.test(brief.end_date);
  let datesOk = false;
  let dateDetail: string | undefined;
  if (!startValid || !endValid) {
    dateDetail = 'Flight dates are missing or malformed.';
  } else {
    const start = startOfDay(new Date(brief.start_date));
    const end = startOfDay(new Date(brief.end_date));
    const today = startOfDay(ctx.today);
    if (end < start) {
      dateDetail = 'End date is before start date.';
    } else if (end < today) {
      dateDetail = 'Flight has already ended.';
    } else {
      datesOk = true;
    }
  }
  add('flight_dates', 'Flight dates are valid and in the future', datesOk, dateDetail);

  // 5. Compliance score >= 60.
  const score = copy?.compliance_score ?? 0;
  add(
    'compliance_score',
    `Compliance score is at least ${MIN_COMPLIANCE_SCORE}`,
    score >= MIN_COMPLIANCE_SCORE,
    `Score is ${score}.`,
  );

  // 6. No hard-block compliance flags.
  const hardBlocks = hardBlockFlagsPresent(copy?.compliance_flags ?? []);
  add(
    'no_hard_blocks',
    'No hard-block compliance flags',
    hardBlocks.length === 0,
    hardBlocks.length ? `Hard blocks: ${hardBlocks.join(', ')}.` : undefined,
  );

  const failures = checks
    .filter((c) => !c.passed)
    .map((c) => (c.detail ? `${c.label} — ${c.detail}` : c.label));

  return { ready: failures.length === 0, checks, failures };
}
