/**
 * Panel 3 — Copy Output API.
 *
 *   POST  /api/briefs/:id/generate   generate (or regenerate) copy via Claude
 *   PATCH /api/briefs/:id/copy        manually edit individual copy fields
 *
 * Generation requires a brief that passes Panel 1 validation. The selected
 * asset (Panel 2) is included in the prompt when present; it is not yet
 * hard-required here because Panel 2 wiring lands in a later phase.
 */

import { Router } from 'express';
import { getBrief, updateBrief } from '../store/briefStore';
import { generateCopy } from '../services/claude';
import { normalizeBriefInput, validateBriefInput } from '../validation/brief';
import {
  computeCharCounts,
  enforceCompliance,
} from '../types/compliance';
import { AdCopy, COPY_LIMITS } from '../types/brief';

const router = Router();

router.post('/:id/generate', async (req, res) => {
  const brief = getBrief(req.params.id);
  if (!brief) return res.status(404).json({ error: 'Brief not found.' });
  if (brief.status === 'submitted') {
    return res.status(409).json({
      error: 'Brief is submitted and read-only. Clone it to make changes.',
    });
  }

  // Generation needs a complete, valid brief (Panel 1 must pass).
  const errors = validateBriefInput(normalizeBriefInput(brief as unknown as Record<string, unknown>));
  if (errors.length > 0) {
    return res.status(422).json({ error: 'Brief is incomplete.', errors });
  }

  try {
    const raw = await generateCopy(brief);
    const copy = enforceCompliance(raw, brief.industry);
    const updated = updateBrief(brief.id, { copy });
    return res.json({
      brief: updated,
      copy,
      char_counts: computeCharCounts(copy),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Copy generation failed.';
    return res.status(502).json({ error: message });
  }
});

const EDITABLE_COPY_FIELDS = [
  'headline',
  'primary_text',
  'description',
  'cta_suggestion',
] as const;

router.patch('/:id/copy', (req, res) => {
  const brief = getBrief(req.params.id);
  if (!brief) return res.status(404).json({ error: 'Brief not found.' });
  if (brief.status === 'submitted') {
    return res.status(409).json({ error: 'Brief is submitted and read-only.' });
  }
  if (!brief.copy) {
    return res.status(409).json({ error: 'No copy to edit yet. Generate copy first.' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const patch: Partial<AdCopy> = {};
  for (const field of EDITABLE_COPY_FIELDS) {
    if (typeof body[field] === 'string') {
      patch[field] = body[field] as string;
    }
  }
  if (Object.keys(patch).length === 0) {
    return res.status(422).json({
      error: `Provide at least one of: ${EDITABLE_COPY_FIELDS.join(', ')}.`,
    });
  }

  // Manual edits keep the existing compliance score/flags but mark the copy as
  // user-edited. Final character-limit and score gating happens at Panel 4.
  const copy: AdCopy = { ...brief.copy, ...patch, edited: true };
  const updated = updateBrief(brief.id, { copy });
  return res.json({
    brief: updated,
    copy,
    char_counts: computeCharCounts(copy),
    limits: COPY_LIMITS,
  });
});

export default router;
