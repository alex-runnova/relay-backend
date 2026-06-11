/**
 * Validation for the Panel 1 Brief form.
 *
 * Returns a flat list of field-level errors so the frontend can render a red
 * border + inline message per field. An empty array means the brief is valid
 * and the user may advance past Panel 1.
 */

import {
  BriefInput,
  CAMPAIGN_OBJECTIVES,
  CampaignObjective,
  CITY_DEFAULT,
  INDUSTRIES,
  Industry,
  MIN_DAILY_BUDGET_USD,
  TONES,
  Tone,
} from '../types/brief';

export interface FieldError {
  field: keyof BriefInput;
  message: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Coerce an unknown request body into a BriefInput, applying defaults.
 * Does not validate — pair with validateBriefInput.
 */
export function normalizeBriefInput(body: Record<string, unknown>): BriefInput {
  return {
    brief_name: typeof body.brief_name === 'string' ? body.brief_name.trim() : '',
    owner: typeof body.owner === 'string' ? body.owner.trim() : '',
    industry: body.industry as Industry,
    city: isNonEmptyString(body.city) ? body.city.trim() : CITY_DEFAULT,
    objective: body.objective as CampaignObjective,
    tone: body.tone as Tone,
    target_audience:
      typeof body.target_audience === 'string' ? body.target_audience.trim() : '',
    product_description:
      typeof body.product_description === 'string' ? body.product_description.trim() : '',
    key_message: typeof body.key_message === 'string' ? body.key_message.trim() : '',
    destination_url: typeof body.destination_url === 'string' ? body.destination_url.trim() : '',
    daily_budget_usd:
      typeof body.daily_budget_usd === 'number'
        ? body.daily_budget_usd
        : Number(body.daily_budget_usd),
    start_date: typeof body.start_date === 'string' ? body.start_date.trim() : '',
    end_date: typeof body.end_date === 'string' ? body.end_date.trim() : '',
  };
}

export function validateBriefInput(input: BriefInput): FieldError[] {
  const errors: FieldError[] = [];
  const err = (field: keyof BriefInput, message: string) =>
    errors.push({ field, message });

  if (!isNonEmptyString(input.brief_name)) err('brief_name', 'Brief Name is required.');
  if (!isNonEmptyString(input.owner)) err('owner', 'Owner is required.');

  if (!INDUSTRIES.includes(input.industry)) {
    err('industry', `Industry must be one of: ${INDUSTRIES.join(', ')}.`);
  }

  // City defaults to Pittsburgh, so it should always be present post-normalize.
  if (!isNonEmptyString(input.city)) err('city', 'City is required.');

  if (!CAMPAIGN_OBJECTIVES.includes(input.objective)) {
    err('objective', `Objective must be one of: ${CAMPAIGN_OBJECTIVES.join(', ')}.`);
  }

  if (!TONES.includes(input.tone)) {
    err('tone', `Tone must be one of: ${TONES.join(', ')}.`);
  }

  if (!isNonEmptyString(input.target_audience)) {
    err('target_audience', 'Target Audience is required.');
  }
  if (!isNonEmptyString(input.product_description)) {
    err('product_description', 'Product/Service Description is required.');
  }
  if (!isNonEmptyString(input.key_message)) {
    err('key_message', 'Key Message is required.');
  }

  if (!isNonEmptyString(input.destination_url)) {
    err('destination_url', 'Destination URL is required.');
  } else if (!/^https?:\/\/.+\..+/.test(input.destination_url)) {
    err('destination_url', 'Destination URL must be a valid http(s) URL.');
  }

  if (!Number.isFinite(input.daily_budget_usd)) {
    err('daily_budget_usd', 'Daily Budget is required.');
  } else if (input.daily_budget_usd < MIN_DAILY_BUDGET_USD) {
    err('daily_budget_usd', `Daily Budget must be at least $${MIN_DAILY_BUDGET_USD}/day.`);
  }

  const startValid = ISO_DATE.test(input.start_date);
  const endValid = ISO_DATE.test(input.end_date);
  if (!startValid) err('start_date', 'Start Date is required (YYYY-MM-DD).');
  if (!endValid) err('end_date', 'End Date is required (YYYY-MM-DD).');

  if (startValid && endValid) {
    const start = new Date(input.start_date);
    const end = new Date(input.end_date);
    if (end < start) {
      err('end_date', 'End Date must be on or after Start Date.');
    }
  }

  return errors;
}
