import { useEffect, useState } from 'react';
import { Brief, Conversions, ReadinessResult } from '../../types';
import { ApiError, api } from '../../api';
import AdPreview from '../AdPreview';

interface Props {
  brief: Brief;
  conversions?: Conversions;
  onSubmitted: (brief: Brief, permalink: string, logged: boolean) => void;
  onBack: () => void;
  toast: (message: string, error?: boolean) => void;
}

export default function LaunchPanel({ brief, conversions, onSubmitted, onBack, toast }: Props) {
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const submitted = brief.status === 'submitted' && !!brief.meta_submission;

  useEffect(() => {
    if (submitted) { setLoading(false); return; }
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const r = await api.readiness(brief.id);
        if (active) setReadiness(r);
      } catch (e) {
        if (active) toast(e instanceof ApiError ? e.message : 'Could not check readiness.', true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief.id]);

  async function pushToMeta() {
    setSubmitting(true);
    try {
      const res = await api.submit(brief.id);
      onSubmitted(res.brief, res.permalink, res.campaign_logged);
    } catch (e) {
      // 422 from Meta carries the policy rejection reason in `message`.
      toast(e instanceof ApiError ? e.message : 'Submission failed.', true);
      // Refresh readiness in case the failure was a readiness gap.
      try { setReadiness(await api.readiness(brief.id)); } catch { /* ignore */ }
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    const sub = brief.meta_submission!;
    return (
      <div className="panel">
        <h2>Launch Readiness</h2>
        <div className="banner ok">
          <strong>Submitted to Meta.</strong> This brief is locked. Clone it to make a new draft.
        </div>
        <div className="conversions-card">
          <div>
            <div className="conv-num">{conversions?.trial_started ?? 0}</div>
            <div className="conv-label">Free-trial signups</div>
          </div>
          <div>
            <div className="conv-num">{conversions?.trial_converted ?? 0}</div>
            <div className="conv-label">Trial → paid</div>
          </div>
          <div className="conv-note">Attributed via PostHog (utm_term). Updates as signups come in.</div>
        </div>
        {brief.copy && (
          <div style={{ marginBottom: 24 }}>
            <AdPreview copy={brief.copy} asset={brief.selected_asset} destinationUrl={brief.destination_url} />
          </div>
        )}
        <div className="copy-field">
          <div className="row"><label>Meta Ad ID</label></div>
          <div>{sub.ad_id}</div>
        </div>
        <div className="copy-field">
          <div className="row"><label>Campaign ID</label></div>
          <div>{sub.campaign_id}</div>
        </div>
        <div className="copy-field">
          <div className="row"><label>Review Status</label></div>
          <div>{sub.review_status}</div>
        </div>
        <div className="copy-field">
          <div className="row"><label>Permalink</label></div>
          <a href={sub.permalink} target="_blank" rel="noreferrer">Open in Meta Ads Manager →</a>
        </div>
        <div className="panel-actions">
          <button className="btn secondary" onClick={onBack}>← Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>Launch Readiness</h2>
      <p className="subtitle">Final validation before submitting a PAUSED ad to Meta.</p>

      {brief.copy && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Ad preview</h3>
          <AdPreview copy={brief.copy} asset={brief.selected_asset} destinationUrl={brief.destination_url} />
        </div>
      )}

      {loading && <div className="spinner">Running checks…</div>}

      {!loading && readiness && (
        <>
          {readiness.ready ? (
            <div className="banner ok"><strong>Ready.</strong> All checks passed — you can push this ad to Meta.</div>
          ) : (
            <div className="banner fail">
              <strong>Not ready.</strong> Resolve the following before submitting:
              <ul>{readiness.failures.map((f, i) => <li key={i}>{f}</li>)}</ul>
            </div>
          )}

          <div>
            {readiness.checks.map((c) => (
              <div key={c.id} className={`check-row ${c.passed ? 'pass' : 'fail'}`}>
                <span className="mark">{c.passed ? '✓' : '✕'}</span>
                <div>
                  <div>{c.label}</div>
                  {!c.passed && c.detail && <div className="detail">{c.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="panel-actions">
        <button className="btn secondary" onClick={onBack}>← Back</button>
        <button className="btn gold" onClick={pushToMeta} disabled={!readiness?.ready || submitting}>
          {submitting ? 'Pushing to Meta…' : 'Push to Meta'}
        </button>
      </div>
    </div>
  );
}
