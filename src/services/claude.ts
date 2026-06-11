/**
 * Claude copy-generation service (Panel 3).
 *
 * Sends the brief + selected asset metadata to Claude with the Relay Messaging
 * Rules as the system prompt, and returns structured ad copy. The server then
 * enforces compliance on top of the result (see ../types/compliance.ts).
 *
 * Spec alignment:
 *  - Auth: ANTHROPIC_API_KEY (read from env by the SDK).
 *  - Model: pinned via RELAY_MODEL — the spec named claude-3-5-sonnet, which is
 *    retired and 404s; pinned to claude-opus-4-8 per product decision.
 *  - Max output tokens: 1500.
 *  - Retry: SDK retries 429/5xx with exponential backoff; capped at 3.
 *  - Timeout: 30s; a timeout surfaces as an error to the caller.
 *  - Note: the spec's temperature 0.7 is omitted — Opus 4.8 removed sampling
 *    params (sending temperature returns 400). Tone is steered via the prompt.
 */

import Anthropic from '@anthropic-ai/sdk';
import { AdCopy, Brief, SelectedAsset } from '../types/brief';
import { RELAY_MESSAGING_RULES } from '../prompts/messagingRules';

export const RELAY_MODEL = 'claude-opus-4-8';
const MAX_OUTPUT_TOKENS = 1500;
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

/** Structured-output schema for the copy Claude returns. */
const COPY_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    headline: { type: 'string' },
    primary_text: { type: 'string' },
    description: { type: 'string' },
    cta_suggestion: { type: 'string' },
    compliance_score: { type: 'integer' },
    compliance_flags: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'headline',
    'primary_text',
    'description',
    'cta_suggestion',
    'compliance_score',
    'compliance_flags',
  ],
} as const;

let client: Anthropic | null = null;

/**
 * Lazily construct the client so importing this module doesn't throw when
 * ANTHROPIC_API_KEY is absent (e.g. in unit tests that never call the API).
 */
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set; cannot generate copy.');
  }
  if (!client) {
    client = new Anthropic({ timeout: TIMEOUT_MS, maxRetries: MAX_RETRIES });
  }
  return client;
}

/** The brief fields Claude needs — excludes server bookkeeping. */
function briefForPrompt(brief: Brief, asset?: SelectedAsset) {
  return {
    brief_name: brief.brief_name,
    industry: brief.industry,
    city: brief.city,
    objective: brief.objective,
    tone: brief.tone,
    target_audience: brief.target_audience,
    product_description: brief.product_description,
    key_message: brief.key_message,
    selected_asset: asset
      ? {
          asset_name: asset.asset_name,
          asset_type: asset.asset_type,
          industry_tags: asset.industry_tags,
        }
      : null,
  };
}

/**
 * Generate ad copy for a brief. Returns the raw AdCopy from Claude — callers
 * must run it through enforceCompliance() before persisting/surfacing.
 *
 * Throws on network/timeout/parse failure so the route can surface the error.
 */
export async function generateCopy(brief: Brief): Promise<AdCopy> {
  const anthropic = getClient();

  const userContent = JSON.stringify(briefForPrompt(brief, brief.selected_asset), null, 2);

  const response = await anthropic.messages.create({
    model: RELAY_MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: RELAY_MESSAGING_RULES,
    output_config: { format: { type: 'json_schema', schema: COPY_JSON_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: `Generate compliant Meta ad copy for this brief:\n\n${userContent}`,
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('Claude declined to generate copy for this brief.');
  }

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text content.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new Error('Claude returned malformed JSON.');
  }

  return normalizeCopy(parsed);
}

/**
 * Coerce Claude's parsed JSON into an AdCopy, tolerating minor shape drift.
 * Exported for unit testing without hitting the API.
 */
// ---------------------------------------------------------------------------
// Strategy drafting (Panel 1 AI pre-fill)
// ---------------------------------------------------------------------------

export interface StrategyDraftInput {
  brief_name: string;
  industry: string;
  city?: string;
  objective?: string;
  tone?: string;
}

export interface StrategyDraft {
  target_audience: string;
  product_description: string;
  key_message: string;
}

const STRATEGY_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    target_audience: { type: 'string' },
    product_description: { type: 'string' },
    key_message: { type: 'string' },
  },
  required: ['target_audience', 'product_description', 'key_message'],
} as const;

/**
 * Draft the three strategy fields for a brief, grounded in Relay's strategy
 * playbooks (the Drive corpus). Returns editable suggestions, not final copy.
 */
export async function draftStrategy(
  input: StrategyDraftInput,
  strategyCorpus: string,
): Promise<StrategyDraft> {
  const anthropic = getClient();

  const system = `You are Relay's paid-media strategist for a Pittsburgh agency. Using Relay's strategy playbooks below, draft three planning fields for a new campaign brief: target_audience, product_description, and key_message.

Ground your draft in the playbooks — match Relay's positioning, audience framing, and voice. Be specific and local where the playbooks support it. These are editable starting points for a strategist, so be concrete and useful, not generic.

Keep each field tight: target_audience and key_message 1-2 sentences; product_description 1-3 sentences.

=== RELAY STRATEGY PLAYBOOKS ===
${strategyCorpus || '(no playbook documents were available)'}
=== END PLAYBOOKS ===

Respond with the structured JSON object only.`;

  const userContent = JSON.stringify(
    {
      brief_name: input.brief_name,
      industry: input.industry,
      city: input.city ?? 'Pittsburgh',
      objective: input.objective,
      tone: input.tone,
    },
    null,
    2,
  );

  const response = await anthropic.messages.create({
    model: RELAY_MODEL,
    max_tokens: 900,
    system,
    output_config: { format: { type: 'json_schema', schema: STRATEGY_JSON_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: `Draft the strategy fields for this campaign:\n\n${userContent}`,
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('Claude declined to draft strategy for this brief.');
  }
  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text content.');
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new Error('Claude returned malformed JSON.');
  }
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    target_audience: str(parsed.target_audience),
    product_description: str(parsed.product_description),
    key_message: str(parsed.key_message),
  };
}

export function normalizeCopy(parsed: unknown): AdCopy {
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const flags = Array.isArray(obj.compliance_flags)
    ? obj.compliance_flags.filter((f): f is string => typeof f === 'string')
    : [];

  return {
    headline: str(obj.headline),
    primary_text: str(obj.primary_text),
    description: str(obj.description),
    cta_suggestion: str(obj.cta_suggestion),
    compliance_score:
      typeof obj.compliance_score === 'number' ? obj.compliance_score : Number(obj.compliance_score) || 0,
    compliance_flags: flags,
  };
}
