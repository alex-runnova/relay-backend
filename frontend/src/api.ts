// Typed client for the Relay backend API. All calls are same-origin (/api),
// proxied to :3000 in dev by Vite and served by Express in prod.

import {
  AdCopy,
  AssetLibraryItem,
  Brief,
  BriefInput,
  CopyCharCounts,
  FieldError,
  MetaSubmission,
  ReadinessResult,
} from './types';

/** An API error carrying the HTTP status and optional field errors. */
export class ApiError extends Error {
  status: number;
  fieldErrors?: FieldError[];
  constructor(message: string, status: number, fieldErrors?: FieldError[]) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (body as { error?: string }).error ?? `Request failed (${res.status})`;
    throw new ApiError(message, res.status, (body as { errors?: FieldError[] }).errors);
  }
  return body as T;
}

export const api = {
  listBriefs: () => request<{ briefs: Brief[] }>('/briefs').then((r) => r.briefs),

  getBrief: (id: string) => request<{ brief: Brief }>(`/briefs/${id}`).then((r) => r.brief),

  createBrief: (input: BriefInput) =>
    request<{ brief: Brief }>('/briefs', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.brief),

  updateBrief: (id: string, input: BriefInput) =>
    request<{ brief: Brief }>(`/briefs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }).then((r) => r.brief),

  cloneBrief: (id: string) =>
    request<{ brief: Brief }>(`/briefs/${id}/clone`, { method: 'POST' }).then((r) => r.brief),

  listAssets: (industry: string, refresh = false) =>
    request<{ assets: AssetLibraryItem[] }>(
      `/assets?industry=${encodeURIComponent(industry)}${refresh ? '&refresh=true' : ''}`,
    ).then((r) => r.assets),

  selectAsset: (id: string, assetId: string) =>
    request<{ brief: Brief }>(`/briefs/${id}/asset`, {
      method: 'POST',
      body: JSON.stringify({ asset_id: assetId }),
    }).then((r) => r.brief),

  draftStrategy: (input: {
    brief_name: string;
    industry: string;
    city?: string;
    objective?: string;
    tone?: string;
  }) =>
    request<{ draft: { target_audience: string; product_description: string; key_message: string } }>(
      '/strategy/draft',
      { method: 'POST', body: JSON.stringify(input) },
    ).then((r) => r.draft),

  generateCopy: (id: string) =>
    request<{ brief: Brief; copy: AdCopy; char_counts: CopyCharCounts }>(
      `/briefs/${id}/generate`,
      { method: 'POST' },
    ),

  editCopy: (id: string, patch: Partial<AdCopy>) =>
    request<{ brief: Brief; copy: AdCopy; char_counts: CopyCharCounts }>(`/briefs/${id}/copy`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  readiness: (id: string) => request<ReadinessResult>(`/briefs/${id}/readiness`),

  conversions: () =>
    request<{ configured: boolean; by_brief: Record<string, { trial_started: number; trial_converted: number }> }>(
      '/conversions',
    ),

  submit: (id: string) =>
    request<{ brief: Brief; meta_submission: MetaSubmission; permalink: string; campaign_logged: boolean }>(
      `/briefs/${id}/submit`,
      { method: 'POST' },
    ),
};
