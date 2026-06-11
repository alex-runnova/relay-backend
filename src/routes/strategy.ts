/**
 * Panel 1 AI pre-fill — draft strategy fields from Relay's playbooks.
 *
 *   POST /api/strategy/draft  { brief_name, industry, city?, objective?, tone? }
 *     → { target_audience, product_description, key_message }
 *
 * Standalone (not tied to a saved brief) so it works while the user is still
 * filling out Panel 1.
 */

import { Router } from 'express';
import { INDUSTRIES, Industry } from '../types/brief';
import { draftStrategy } from '../services/claude';
import { loadStrategyCorpus } from '../services/drive';

const router = Router();

router.post('/strategy/draft', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const brief_name = typeof body.brief_name === 'string' ? body.brief_name.trim() : '';
  const industry = body.industry as Industry;

  if (!brief_name) return res.status(422).json({ error: 'Brief Name is required to draft strategy.' });
  if (!INDUSTRIES.includes(industry)) {
    return res.status(422).json({ error: 'A valid Industry is required to draft strategy.' });
  }

  try {
    const corpus = await loadStrategyCorpus();
    const draft = await draftStrategy(
      {
        brief_name,
        industry,
        city: typeof body.city === 'string' ? body.city : undefined,
        objective: typeof body.objective === 'string' ? body.objective : undefined,
        tone: typeof body.tone === 'string' ? body.tone : undefined,
      },
      corpus,
    );
    return res.json({ draft });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not draft strategy.';
    return res.status(502).json({ error: message });
  }
});

export default router;
