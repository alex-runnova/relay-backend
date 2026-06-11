import { Brief } from '../types';

interface Props {
  brief: Brief | null;
  onClone: () => void;
}

/** Top bar: brief name, status, owner. Offers cloning when submitted. */
export default function StatusBar({ brief, onClone }: Props) {
  const name = brief?.brief_name || 'New brief';
  const owner = brief?.owner || '—';
  const status = brief?.status ?? 'draft';
  return (
    <div className="statusbar">
      <div className="title">{name}</div>
      <div className="meta">
        <span>
          <span className={`badge ${status}`}>{status.replace(/_/g, ' ')}</span>
        </span>
        <span>Owner: {owner}</span>
        {brief?.status === 'submitted' && (
          <button className="btn secondary" style={{ padding: '4px 12px' }} onClick={onClone}>
            Clone to revise
          </button>
        )}
      </div>
    </div>
  );
}
