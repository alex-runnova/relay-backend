/**
 * Panel 2 — Asset Match API. Mounted at /api.
 *
 *   GET  /api/assets?industry=retail&refresh=true   approved assets, filtered
 *   POST /api/briefs/:id/asset { asset_id }          select an asset for a brief
 *
 * Only approved assets are ever returned. The optional industry filter matches
 * the brief's industry against each asset's industry_tags. `refresh=true`
 * bypasses the short-lived sheet cache (the Panel 2 refresh button).
 */

import { Router } from 'express';
import { getBrief, updateBrief } from '../store/briefStore';
import { loadAssets } from '../services/sheets';
import { filterAssets, toSelectedAsset } from '../types/asset';

const router = Router();

router.get('/assets', async (req, res) => {
  const industry = typeof req.query.industry === 'string' ? req.query.industry : undefined;
  const forceRefresh = req.query.refresh === 'true';
  try {
    const all = await loadAssets(forceRefresh);
    const assets = filterAssets(all, { industry });
    return res.json({ assets, count: assets.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load assets.';
    return res.status(502).json({ error: message });
  }
});

router.post('/briefs/:id/asset', async (req, res) => {
  const brief = getBrief(req.params.id);
  if (!brief) return res.status(404).json({ error: 'Brief not found.' });
  if (brief.status === 'submitted') {
    return res.status(409).json({ error: 'Brief is submitted and read-only.' });
  }

  const assetId = (req.body ?? {}).asset_id;
  if (typeof assetId !== 'string' || assetId.trim().length === 0) {
    return res.status(422).json({ error: 'asset_id is required.' });
  }

  try {
    // Resolve against the library so we store trusted metadata, and enforce
    // that the asset exists and is approved (and matches the brief industry).
    const approved = filterAssets(await loadAssets(), { industry: brief.industry });
    const match = approved.find((a) => a.asset_id === assetId.trim());
    if (!match) {
      return res.status(422).json({
        error: 'Asset not found, not approved, or not tagged for this brief’s industry.',
      });
    }
    const updated = updateBrief(brief.id, { selected_asset: toSelectedAsset(match) });
    return res.json({ brief: updated, selected_asset: updated?.selected_asset });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to select asset.';
    return res.status(502).json({ error: message });
  }
});

export default router;
