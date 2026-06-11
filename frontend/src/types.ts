// Mirrors the backend Brief contract (src/types/brief.ts). Kept in sync by hand
// for Phase 1; a shared package can replace this later.

export const INDUSTRIES = [
  'retail',
  'food',
  'healthcare',
  'real estate',
  'fitness',
  'education',
  'other',
] as const;
export type Industry = (typeof INDUSTRIES)[number];

export const CAMPAIGN_OBJECTIVES = [
  'AWARENESS',
  'TRAFFIC',
  'ENGAGEMENT',
  'LEADS',
  'CONVERSIONS',
] as const;
export type CampaignObjective = (typeof CAMPAIGN_OBJECTIVES)[number];

export const TONES = [
  'professional',
  'conversational',
  'urgent',
  'inspirational',
  'bold',
] as const;
export type Tone = (typeof TONES)[number];

export type BriefStatus = 'draft' | 'ready_for_meta' | 'submitted';

export const COPY_LIMITS = { headline: 40, primary_text: 125, description: 30 } as const;
export const MIN_DAILY_BUDGET_USD = 5;

export interface SelectedAsset {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  file_url: string;
  thumbnail_url: string;
  industry_tags: string[];
}

export interface AssetLibraryItem extends SelectedAsset {
  approved: boolean;
  last_updated: string;
}

export interface AdCopy {
  headline: string;
  primary_text: string;
  description: string;
  cta_suggestion: string;
  compliance_score: number;
  compliance_flags: string[];
  edited?: boolean;
}

export interface MetaSubmission {
  ad_id: string;
  campaign_id: string;
  review_status: string;
  permalink: string;
  submitted_at: string;
}

export interface BriefInput {
  brief_name: string;
  owner: string;
  industry: Industry;
  city: string;
  objective: CampaignObjective;
  tone: Tone;
  target_audience: string;
  product_description: string;
  key_message: string;
  destination_url: string;
  daily_budget_usd: number;
  start_date: string;
  end_date: string;
}

export interface Brief extends BriefInput {
  id: string;
  status: BriefStatus;
  selected_asset?: SelectedAsset;
  copy?: AdCopy;
  meta_submission?: MetaSubmission;
  cloned_from?: string;
  created_at: string;
  last_modified: string;
}

export interface FieldError {
  field: keyof BriefInput;
  message: string;
}

export interface CharCount {
  count: number;
  limit: number;
  over: boolean;
}
export type CopyCharCounts = Record<keyof typeof COPY_LIMITS, CharCount>;

export interface ReadinessCheck {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
}
export interface ReadinessResult {
  ready: boolean;
  checks: ReadinessCheck[];
  failures: string[];
}

export const HARD_BLOCK_FLAGS = ['INCOME_CLAIM', 'HEALTH_OUTCOME_CLAIM', 'DISCRIMINATORY_TARGETING'];
export const MIN_COMPLIANCE_SCORE = 60;
