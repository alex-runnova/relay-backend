import { useEffect, useState } from 'react';
import { AdCopy, Brief, COPY_LIMITS, HARD_BLOCK_FLAGS, MIN_COMPLIANCE_SCORE } from '../../types';
import { ApiError, api } from '../../api';

interface Props {
  brief: Brief;
  readOnly: boolean;
  onUpdated: (brief: Brief) => void;
  onNext: () => void;
  onBack: () => void;
  toast: (message: string, error?: boolean) => void;
}

type EditableField = 'headline' | 'primary_text' | 'description' | 'cta_suggestion';
const EDITABLE: { key: EditableField; label: string; multiline?: boolean }[] = [
  { key: 'headline', label: 'Headline' },
  { key: 'primary_text', label: 'Primary Text', multiline: true },
  { key: 'description', label: 'Description' },
  { key: 'cta_suggestion', label: 'CTA Suggestion' },
];

function scoreClass(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 80) return 'green';
  if (score >= 60) return 'yellow';
  return 'red';
}

function flagClass(flag: string): 'hard' | 'soft' | 'special' {
  if (HARD_BLOCK_FLAGS.includes(flag)) return 'hard';
  if (flag === 'SPECIAL_AD_CATEGORY') return 'special';
  return 'soft';
}

function limitOf(key: EditableField): number | null {
  return key in COPY_LIMITS ? COPY_LIMITS[key as keyof typeof COPY_LIMITS] : null;
}

export default function CopyPanel({ brief, readOnly, onUpdated, onNext, onBack, toast }: Props) {
  const copy = brief.copy;
  const [draft, setDraft] = useState<Pick<AdCopy, EditableField>>({
    headline: copy?.headline ?? '',
    primary_text: copy?.primary_text ?? '',
    description: copy?.description ?? '',
    cta_suggestion: copy?.cta_suggestion ?? '',
  });
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (copy) {
      setDraft({
        headline: copy.headline,
        primary_text: copy.primary_text,
        description: copy.description,
        cta_suggestion: copy.cta_suggestion,
      });
      setDirty(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copy?.headline, copy?.primary_text, copy?.description, copy?.cta_suggestion]);

  async function generate() {
    setGenerating(true);
    try {
      const res = await api.generateCopy(brief.id);
      onUpdated(res.brief);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Generation failed.', true);
    } finally {
      setGenerating(false);
    }
  }

  async function saveEdits() {
    setSaving(true);
    try {
      const res = await api.editCopy(brief.id, draft);
      onUpdated(res.brief);
      setDirty(false);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not save edits.', true);
    } finally {
      setSaving(false);
    }
  }

  const score = copy?.compliance_score ?? 0;
  const hardBlocked = (copy?.compliance_flags ?? []).some((f) => HARD_BLOCK_FLAGS.includes(f));
  const canProceed = !!copy && score >= MIN_COMPLIANCE_SCORE && !hardBlocked;
  const anyOver = EDITABLE.some(({ key }) => {
    const lim = limitOf(key);
    return lim !== null && draft[key].length > lim;
  });

  return (
    <div className="panel">
      <h2>Copy Output</h2>
      <p className="subtitle">Generate compliant ad copy from the brief, then review and edit.</p>

      {readOnly && <div className="locked-note">This brief is submitted and read-only.</div>}

      {!copy && (
        <div className="empty-state">
          <p>No copy yet. Generate copy from this brief and the selected asset.</p>
          <button className="btn gold" onClick={generate} disabled={generating}>
            {generating ? 'Generating…' : 'Generate copy'}
          </button>
        </div>
      )}

      {copy && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div className={`score-badge ${scoreClass(score)}`}>
              <span className="num">{score}</span>
              <span>compliance{copy.edited ? ' · edited' : ''}</span>
            </div>
            {!readOnly && (
              <button className="btn secondary" onClick={generate} disabled={generating}>
                {generating ? 'Regenerating…' : '↻ Regenerate'}
              </button>
            )}
          </div>

          {copy.compliance_flags.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              {copy.compliance_flags.map((f) => (
                <div key={f} className={`flag ${flagClass(f)}`}>
                  <strong>{f.replace(/_/g, ' ')}</strong>
                  {flagClass(f) === 'hard' && ' — blocks submission'}
                  {flagClass(f) === 'special' && ' — Meta Special Ad Category applies'}
                </div>
              ))}
            </div>
          )}

          {EDITABLE.map(({ key, label, multiline }) => {
            const lim = limitOf(key);
            const len = draft[key].length;
            const over = lim !== null && len > lim;
            return (
              <div key={key} className="copy-field">
                <div className="row">
                  <label>{label}</label>
                  {lim !== null && <span className={`count ${over ? 'over' : ''}`}>{len}/{lim}</span>}
                </div>
                {multiline ? (
                  <textarea
                    value={draft[key]}
                    disabled={readOnly}
                    onChange={(e) => { setDraft((d) => ({ ...d, [key]: e.target.value })); setDirty(true); }}
                  />
                ) : (
                  <input
                    value={draft[key]}
                    disabled={readOnly}
                    onChange={(e) => { setDraft((d) => ({ ...d, [key]: e.target.value })); setDirty(true); }}
                  />
                )}
              </div>
            );
          })}

          {!readOnly && dirty && (
            <button className="btn secondary" onClick={saveEdits} disabled={saving || anyOver}>
              {saving ? 'Saving…' : 'Save edits'}
            </button>
          )}

          {!canProceed && (
            <div className="banner fail" style={{ marginTop: 20 }}>
              {hardBlocked
                ? 'A hard-block compliance flag is present. Regenerate or edit the copy to proceed.'
                : `Compliance score must be at least ${MIN_COMPLIANCE_SCORE} to proceed.`}
            </div>
          )}
        </>
      )}

      <div className="panel-actions">
        <button className="btn secondary" onClick={onBack}>← Back</button>
        <button className="btn" onClick={onNext} disabled={!canProceed || dirty}>
          {dirty ? 'Save edits first' : 'Continue →'}
        </button>
      </div>
    </div>
  );
}
