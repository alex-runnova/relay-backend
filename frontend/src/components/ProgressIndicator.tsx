interface Props {
  current: number; // 1-4
  onJump: (panel: number) => void;
  maxReachable: number; // highest panel the user may navigate to
}

const STEPS = ['Brief', 'Asset', 'Copy', 'Launch'];

/** Panel 1–4 progress indicator; completed steps are clickable to jump back. */
export default function ProgressIndicator({ current, onJump, maxReachable }: Props) {
  return (
    <div className="progress">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const cls = n === current ? 'active' : n < current ? 'done' : '';
        const clickable = n <= maxReachable;
        return (
          <button
            key={label}
            className={`step ${cls}`}
            disabled={!clickable}
            onClick={() => clickable && onJump(n)}
            style={{ border: 'none', cursor: clickable ? 'pointer' : 'default' }}
          >
            <span className="num">{n}</span>
            {label}
          </button>
        );
      })}
    </div>
  );
}
