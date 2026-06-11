/**
 * In-memory brief storage for Phase 1.
 *
 * Deliberately not persisted — the spec says start with in-memory storage and
 * do not over-engineer. The interface is kept small so it can be swapped for a
 * real database later without touching the routes.
 */

import { randomUUID } from 'node:crypto';
import { Brief, BriefInput } from '../types/brief';

const briefs = new Map<string, Brief>();

function now(): string {
  return new Date().toISOString();
}

/** Create a new brief in `draft` status. */
export function createBrief(input: BriefInput): Brief {
  const timestamp = now();
  const brief: Brief = {
    ...input,
    id: randomUUID(),
    status: 'draft',
    created_at: timestamp,
    last_modified: timestamp,
  };
  briefs.set(brief.id, brief);
  return brief;
}

export function getBrief(id: string): Brief | undefined {
  return briefs.get(id);
}

/** All briefs, sorted by last_modified descending (for the history panel). */
export function listBriefs(): Brief[] {
  return [...briefs.values()].sort((a, b) =>
    b.last_modified.localeCompare(a.last_modified),
  );
}

/**
 * Apply a partial update to a brief and bump last_modified. Callers are
 * responsible for enforcing status rules (e.g. blocking edits to submitted
 * briefs) before calling this.
 */
export function updateBrief(id: string, patch: Partial<Brief>): Brief | undefined {
  const existing = briefs.get(id);
  if (!existing) return undefined;
  const updated: Brief = {
    ...existing,
    ...patch,
    id: existing.id, // never reassign id
    created_at: existing.created_at,
    last_modified: now(),
  };
  briefs.set(id, updated);
  return updated;
}

/**
 * Clone a submitted (or any) brief into a fresh draft. Copies the editable
 * input fields and the selected asset + copy, but clears workflow state
 * (status → draft, no meta_submission) and records provenance.
 */
export function cloneBrief(id: string): Brief | undefined {
  const source = briefs.get(id);
  if (!source) return undefined;
  const timestamp = now();
  const clone: Brief = {
    ...source,
    id: randomUUID(),
    status: 'draft',
    brief_name: `${source.brief_name} (copy)`,
    meta_submission: undefined,
    cloned_from: source.id,
    created_at: timestamp,
    last_modified: timestamp,
  };
  briefs.set(clone.id, clone);
  return clone;
}

export function deleteBrief(id: string): boolean {
  return briefs.delete(id);
}

/** Test/dev helper — wipes all briefs. */
export function _resetStore(): void {
  briefs.clear();
}
