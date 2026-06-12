import { Brief, ConversionsByBrief } from '../types';

interface Props {
  briefs: Brief[];
  activeId: string | null;
  onSelect: (brief: Brief) => void;
  onNew: () => void;
  conversions: ConversionsByBrief;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

/** Persistent left-side brief history, sorted by last modified (backend order). */
export default function Sidebar({ briefs, activeId, onSelect, onNew, conversions }: Props) {
  return (
    <aside className="sidebar">
      <div>
        <div className="brand">Re<span>lay</span></div>
        <div className="tagline">Pittsburgh paid media</div>
      </div>
      <button className="new-btn" onClick={onNew}>
        + New brief
      </button>
      <div className="brief-list">
        {briefs.length === 0 && <div style={{ color: '#9b958a', fontSize: 13 }}>No briefs yet.</div>}
        {briefs.map((b) => (
          <button
            key={b.id}
            className={`brief-item ${b.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(b)}
          >
            <span className="name">{b.brief_name || 'Untitled brief'}</span>
            <span className="when">
              <span className={`badge ${b.status}`}>{b.status.replace(/_/g, ' ')}</span>
              {'  '}
              {relativeTime(b.last_modified)}
            </span>
            {conversions[b.id]?.trial_started ? (
              <span className="signups-badge">★ {conversions[b.id].trial_started} signups</span>
            ) : null}
          </button>
        ))}
      </div>
    </aside>
  );
}
