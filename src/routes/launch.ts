/**
 * Panel 4 — Launch Readiness + Meta submission. Mounted at /api/briefs.
 *
 *   GET  /:id/readiness   run all launch checks (probes the asset URL)
 *   POST /:id/submit      push a PAUSED ad to Meta, log it, lock the brief
 *
 * Submission is gated on full readiness and guarded against duplicates: a
 * brief that already has a Meta ad_id cannot be submitted again.
 */

import { Router } from 'express';
import { getBrief, updateBrief } from '../store/briefStore';
import { checkReadiness } from '../types/readiness';
import { createPausedAd, MetaApiError } from '../services/meta';
import { appendCampaignLog } from '../services/sheets';

const router = Router();

const URL_PROBE_TIMEOUT_MS = 5_000;

/** HEAD-probe a URL for reachability, falling back to GET; never throws. */
async function isUrlAccessible(url: string): Promise<boolean> {
  if (!url) return false;
  const attempt = async (method: 'HEAD' | 'GET') => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), URL_PROBE_TIMEOUT_MS);
    try {
      const res = await fetch(url, { method, signal: controller.signal });
      return res.ok;
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    if (await attempt('HEAD')) return true;
    return await attempt('GET');
  } catch {
    return false;
  }
}

async function buildReadiness(brief: ReturnType<typeof getBrief>) {
  const b = brief!;
  const assetUrlAccessible = b.selected_asset
    ? await isUrlAccessible(b.selected_asset.file_url)
    : undefined;
  return checkReadiness(b, { today: new Date(), assetUrlAccessible });
}

router.get('/:id/readiness', async (req, res) => {
  const brief = getBrief(req.params.id);
  if (!brief) return res.status(404).json({ error: 'Brief not found.' });

  const result = await buildReadiness(brief);

  // Reflect readiness in the brief status (draft <-> ready_for_meta).
  // Submitted briefs are terminal and never change here.
  if (brief.status !== 'submitted') {
    const nextStatus = result.ready ? 'ready_for_meta' : 'draft';
    if (brief.status !== nextStatus) updateBrief(brief.id, { status: nextStatus });
  }

  return res.json(result);
});

router.post('/:id/submit', async (req, res) => {
  const brief = getBrief(req.params.id);
  if (!brief) return res.status(404).json({ error: 'Brief not found.' });

  // Duplicate guard — never submit a brief to Meta twice.
  if (brief.status === 'submitted' || brief.meta_submission?.ad_id) {
    return res.status(409).json({
      error: 'This brief has already been submitted to Meta.',
      meta_submission: brief.meta_submission,
    });
  }

  // Re-validate readiness server-side; the client banner is not trusted.
  const readiness = await buildReadiness(brief);
  if (!readiness.ready) {
    return res.status(422).json({ error: 'Brief is not launch-ready.', readiness });
  }

  // Create the PAUSED ad on Meta.
  let submission;
  try {
    submission = await createPausedAd(brief);
  } catch (err) {
    if (err instanceof MetaApiError) {
      // Surface Meta's rejection reason (e.g. policy violation).
      return res.status(422).json({ error: err.message, meta_code: err.metaCode });
    }
    const message = err instanceof Error ? err.message : 'Meta submission failed.';
    return res.status(502).json({ error: message });
  }

  // Lock the brief: store the submission and mark it submitted (read-only).
  const updated = updateBrief(brief.id, {
    meta_submission: submission,
    status: 'submitted',
  });

  // Write the Campaign Log — must never block or roll back the submission.
  let logged = true;
  try {
    await appendCampaignLog({
      brief_id: brief.id,
      brief_name: brief.brief_name,
      owner: brief.owner,
      industry: brief.industry,
      submitted_at: submission.submitted_at,
      meta_ad_id: submission.ad_id,
      meta_campaign_id: submission.campaign_id,
      meta_review_status: submission.review_status,
      meta_permalink: submission.permalink,
      compliance_score: brief.copy?.compliance_score ?? 0,
    });
  } catch {
    logged = false;
  }

  return res.status(201).json({
    brief: updated,
    meta_submission: submission,
    permalink: submission.permalink,
    campaign_logged: logged,
  });
});

export default router;
