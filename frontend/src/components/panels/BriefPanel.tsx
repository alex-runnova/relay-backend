import { useMemo, useState } from 'react';
import {
  Brief,
  BriefInput,
  CAMPAIGN_OBJECTIVES,
  INDUSTRIES,
  MIN_DAILY_BUDGET_USD,
  TONES,
} from '../../types';
import { ApiError, api } from '../../api';

interface Props {
  brief: Brief | null;
  readOnly: boolean;
  onSaved: (brief: Brief) => void;
  onNext: () => void;
  toast: (message: string, error?: boolean) => void;
}

type Errors = Partial<Record<keyof BriefInput, string>>;

const BLANK: BriefInput = {
  brief_name: '',
  owner: localStorage.getItem('relay.owner') ?? '',
  industry: 'retail',
  city: 'Pittsburgh',
  objective: 'TRAFFIC',
  tone: 'professional',
  target_audience: '',
  product_description: '',
  key_message: '',
  destination_url: '',
  daily_budget_usd: MIN_DAILY_BUDGET_USD,
  start_date: '',
  end_date: '',
};

function toInput(brief: Brief): BriefInput {
  const { brief_name, owner, industry, city, objective, tone, target_audience, product_description, key_message, destination_url, daily_budget_usd, start_date, end_date } = brief;
  return { brief_name, owner, industry, city, objective, tone, target_audience, product_description, key_message, destination_url, daily_budget_usd, start_date, end_date };
}

/** Client-side mirror of the backend brief validation. */
function validate(v: BriefInput): Errors {
  const e: Errors = {};
  const req = (k: keyof BriefInput, label: string) => {
    if (!String(v[k] ?? '').trim()) e[k] = `${label} is required.`;
  };
  req('brief_name', 'Brief Name');
  req('owner', 'Owner');
  req('target_audience', 'Target Audience');
  req('product_description', 'Product/Service Description');
  req('key_message', 'Key Message');
  if (!String(v.destination_url ?? '').trim()) e.destination_url = 'Destination URL is required.';
  else if (!/^https?:\/\/.+\..+/.test(v.destination_url)) e.destination_url = 'Must be a valid http(s) URL.';
  if (!String(v.city ?? '').trim()) e.city = 'City is required.';
  if (!Number.isFinite(v.daily_budget_usd)) e.daily_budget_usd = 'Daily Budget is required.';
  else if (v.daily_budget_usd < MIN_DAILY_BUDGET_USD) e.daily_budget_usd = `Must be at least $${MIN_DAILY_BUDGET_USD}/day.`;
  if (!v.start_date) e.start_date = 'Start Date is required.';
  if (!v.end_date) e.end_date = 'End Date is required.';
  if (v.start_date && v.end_date && v.end_date < v.start_date) e.end_date = 'End Date must be on or after Start Date.';
  return e;
}

export default function BriefPanel({ brief, readOnly, onSaved, onNext, toast }: Props) {
  const [form, setForm] = useState<BriefInput>(brief ? toInput(brief) : BLANK);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);

  const errors = useMemo(() => validate(form), [form]);
  const valid = Object.keys(errors).length === 0;

  const set = <K extends keyof BriefInput>(k: K, val: BriefInput[K]) =>
    setForm((f) => ({ ...f, [k]: val }));

  const fieldClass = (k: keyof BriefInput) => `field ${touched && errors[k] ? 'invalid' : ''}`;
  const err = (k: keyof BriefInput) => touched && errors[k] && <div className="error">{errors[k]}</div>;

  async function draftStrategy() {
    if (!form.brief_name.trim()) return;
    setDrafting(true);
    try {
      const d = await api.draftStrategy({
        brief_name: form.brief_name,
        industry: form.industry,
        city: form.city,
        objective: form.objective,
        tone: form.tone,
      });
      setForm((f) => ({
        ...f,
        target_audience: d.target_audience,
        product_description: d.product_description,
        key_message: d.key_message,
      }));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not draft strategy.', true);
    } finally {
      setDrafting(false);
    }
  }

  async function saveAndContinue() {
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    try {
      localStorage.setItem('relay.owner', form.owner);
      const saved = brief ? await api.updateBrief(brief.id, form) : await api.createBrief(form);
      onSaved(saved);
      onNext();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Could not save brief.';
      toast(msg, true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <h2>Campaign Brief</h2>
      <p className="subtitle">Define the campaign. All fields are required before you can match an asset.</p>

      {readOnly && <div className="locked-note">This brief is submitted and read-only. Clone it to make changes.</div>}

      <div className={fieldClass('brief_name')}>
        <label>Brief Name</label>
        <input value={form.brief_name} disabled={readOnly} onChange={(e) => set('brief_name', e.target.value)} />
        {err('brief_name')}
      </div>

      <div className="grid-2">
        <div className={fieldClass('owner')}>
          <label>Owner</label>
          <input value={form.owner} disabled={readOnly} onChange={(e) => set('owner', e.target.value)} />
          {err('owner')}
        </div>
        <div className={fieldClass('city')}>
          <label>City</label>
          <input value={form.city} disabled={readOnly} onChange={(e) => set('city', e.target.value)} />
          {err('city')}
        </div>
      </div>

      <div className="grid-2">
        <div className={fieldClass('industry')}>
          <label>Industry</label>
          <select value={form.industry} disabled={readOnly} onChange={(e) => set('industry', e.target.value as BriefInput['industry'])}>
            {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div className={fieldClass('objective')}>
          <label>Campaign Objective</label>
          <select value={form.objective} disabled={readOnly} onChange={(e) => set('objective', e.target.value as BriefInput['objective'])}>
            {CAMPAIGN_OBJECTIVES.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <div className="grid-2">
        <div className={fieldClass('tone')}>
          <label>Tone</label>
          <select value={form.tone} disabled={readOnly} onChange={(e) => set('tone', e.target.value as BriefInput['tone'])}>
            {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className={fieldClass('daily_budget_usd')}>
          <label>Daily Budget (USD) <span className="hint">min ${MIN_DAILY_BUDGET_USD}</span></label>
          <input type="number" min={MIN_DAILY_BUDGET_USD} value={form.daily_budget_usd} disabled={readOnly}
            onChange={(e) => set('daily_budget_usd', e.target.value === '' ? NaN : Number(e.target.value))} />
          {err('daily_budget_usd')}
        </div>
      </div>

      {!readOnly && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--gold-soft)', padding: '12px 14px', borderRadius: 8, marginBottom: 18 }}>
          <button type="button" className="btn gold" onClick={draftStrategy} disabled={!form.brief_name.trim() || drafting} style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
            {drafting ? 'Drafting…' : '✨ Draft with Relay strategy'}
          </button>
          <span className="hint">Fills the three fields below from Relay's playbooks, based on Brief Name + Industry. Fully editable after.</span>
        </div>
      )}

      <div className={fieldClass('target_audience')}>
        <label>Target Audience</label>
        <input value={form.target_audience} disabled={readOnly} onChange={(e) => set('target_audience', e.target.value)} />
        {err('target_audience')}
      </div>

      <div className={fieldClass('product_description')}>
        <label>Product / Service Description</label>
        <textarea value={form.product_description} disabled={readOnly} onChange={(e) => set('product_description', e.target.value)} />
        {err('product_description')}
      </div>

      <div className={fieldClass('key_message')}>
        <label>Key Message</label>
        <textarea value={form.key_message} disabled={readOnly} onChange={(e) => set('key_message', e.target.value)} />
        {err('key_message')}
      </div>

      <div className={fieldClass('destination_url')}>
        <label>Destination URL <span className="hint">where the ad clicks through to</span></label>
        <input type="url" placeholder="https://" value={form.destination_url} disabled={readOnly} onChange={(e) => set('destination_url', e.target.value)} />
        {err('destination_url')}
      </div>

      <div className="grid-2">
        <div className={fieldClass('start_date')}>
          <label>Flight Start Date</label>
          <input type="date" value={form.start_date} disabled={readOnly} onChange={(e) => set('start_date', e.target.value)} />
          {err('start_date')}
        </div>
        <div className={fieldClass('end_date')}>
          <label>Flight End Date</label>
          <input type="date" value={form.end_date} disabled={readOnly} onChange={(e) => set('end_date', e.target.value)} />
          {err('end_date')}
        </div>
      </div>

      <div className="panel-actions">
        {readOnly ? (
          <button className="btn" onClick={onNext}>View asset →</button>
        ) : (
          <button className="btn" onClick={saveAndContinue} disabled={!valid || saving}>
            {saving ? 'Saving…' : brief ? 'Save & continue →' : 'Create & continue →'}
          </button>
        )}
      </div>
    </div>
  );
}
