/**
 * Brief CRUD + clone API.
 *
 * Endpoints (mounted at /api/briefs):
 *   GET    /                 list briefs (history panel order)
 *   POST   /                 create a draft brief (validates Panel 1)
 *   GET    /:id              fetch one brief
 *   PUT    /:id              update a draft brief (re-validates)
 *   POST   /:id/clone        clone any brief into a fresh draft
 *   DELETE /:id              delete a brief
 *
 * Submitted briefs are read-only: PUT and DELETE are rejected with 409.
 * Integration endpoints (asset match, generate copy, push to Meta) will be
 * added in later phases.
 */

import { Router } from 'express';
import {
  cloneBrief,
  createBrief,
  deleteBrief,
  getBrief,
  listBriefs,
  updateBrief,
} from '../store/briefStore';
import { normalizeBriefInput, validateBriefInput } from '../validation/brief';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ briefs: listBriefs() });
});

router.post('/', (req, res) => {
  const input = normalizeBriefInput(req.body ?? {});
  const errors = validateBriefInput(input);
  if (errors.length > 0) {
    return res.status(422).json({ errors });
  }
  const brief = createBrief(input);
  res.status(201).json({ brief });
});

router.get('/:id', (req, res) => {
  const brief = getBrief(req.params.id);
  if (!brief) return res.status(404).json({ error: 'Brief not found.' });
  res.json({ brief });
});

router.put('/:id', (req, res) => {
  const existing = getBrief(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Brief not found.' });
  if (existing.status === 'submitted') {
    return res.status(409).json({
      error: 'Brief is submitted and read-only. Clone it to make changes.',
    });
  }

  const input = normalizeBriefInput(req.body ?? {});
  const errors = validateBriefInput(input);
  if (errors.length > 0) {
    return res.status(422).json({ errors });
  }

  const brief = updateBrief(req.params.id, input);
  res.json({ brief });
});

router.post('/:id/clone', (req, res) => {
  const clone = cloneBrief(req.params.id);
  if (!clone) return res.status(404).json({ error: 'Brief not found.' });
  res.status(201).json({ brief: clone });
});

router.delete('/:id', (req, res) => {
  const existing = getBrief(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Brief not found.' });
  if (existing.status === 'submitted') {
    return res.status(409).json({ error: 'Submitted briefs cannot be deleted.' });
  }
  deleteBrief(req.params.id);
  res.status(204).send();
});

export default router;
