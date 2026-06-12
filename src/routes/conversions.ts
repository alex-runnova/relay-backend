/**
 * Conversions API. Mounted at /api.
 *
 *   GET /api/conversions  → { configured, by_brief: { [briefId]: {trial_started, trial_converted} } }
 *
 * Returns configured:false (not an error) when PostHog isn't wired, so the UI
 * can simply hide conversion counts.
 */

import { Router } from 'express';
import { getConversionsByBrief, isPostHogConfigured } from '../services/posthog';

const router = Router();

router.get('/conversions', async (req, res) => {
  if (!isPostHogConfigured()) {
    return res.json({ configured: false, by_brief: {} });
  }
  try {
    const by_brief = await getConversionsByBrief(req.query.refresh === 'true');
    return res.json({ configured: true, by_brief });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load conversions.';
    return res.status(502).json({ error: message });
  }
});

export default router;
