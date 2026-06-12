import { useCallback, useEffect, useState } from 'react';
import { Brief, ConversionsByBrief, HARD_BLOCK_FLAGS, MIN_COMPLIANCE_SCORE } from './types';
import { ApiError, api } from './api';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import ProgressIndicator from './components/ProgressIndicator';
import BriefPanel from './components/panels/BriefPanel';
import AssetPanel from './components/panels/AssetPanel';
import CopyPanel from './components/panels/CopyPanel';
import LaunchPanel from './components/panels/LaunchPanel';

function copyClears(brief: Brief): boolean {
  const c = brief.copy;
  return (
    !!c &&
    c.compliance_score >= MIN_COMPLIANCE_SCORE &&
    !c.compliance_flags.some((f) => HARD_BLOCK_FLAGS.includes(f))
  );
}

/** Highest panel (1–4) the user may navigate to for a given brief. */
function maxReachable(brief: Brief | null): number {
  if (!brief) return 1;
  if (brief.status === 'submitted') return 4;
  let m = 2; // brief saved → asset match reachable
  if (brief.selected_asset) m = 3;
  if (brief.selected_asset && copyClears(brief)) m = 4;
  return m;
}

export default function App() {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [active, setActive] = useState<Brief | null>(null);
  const [panel, setPanel] = useState(1);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const [conversions, setConversions] = useState<ConversionsByBrief>({});

  const refreshConversions = useCallback(async () => {
    try {
      const r = await api.conversions();
      if (r.configured) setConversions(r.by_brief);
    } catch {
      /* conversions are best-effort; never block the UI */
    }
  }, []);

  const showToast = useCallback((message: string, error = false) => {
    setToast({ message, error });
    window.setTimeout(() => setToast(null), error ? 7000 : 4500);
  }, []);

  const refreshList = useCallback(async () => {
    try {
      setBriefs(await api.listBriefs());
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not load briefs.', true);
    }
  }, [showToast]);

  useEffect(() => {
    refreshList();
    refreshConversions();
  }, [refreshList, refreshConversions]);

  const next = () => setPanel((p) => Math.min(4, p + 1));
  const back = () => setPanel((p) => Math.max(1, p - 1));

  function selectBrief(b: Brief) {
    setActive(b);
    setPanel(maxReachable(b)); // resume where they left off
  }

  function newBrief() {
    setActive(null);
    setPanel(1);
  }

  function onBriefChanged(b: Brief) {
    setActive(b);
    refreshList();
  }

  async function cloneActive() {
    if (!active) return;
    try {
      const clone = await api.cloneBrief(active.id);
      await refreshList();
      setActive(clone);
      setPanel(1);
      showToast('Cloned to a new draft. Edit and resubmit.');
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not clone brief.', true);
    }
  }

  const readOnly = active?.status === 'submitted';

  let content;
  if (panel === 1 || !active) {
    content = (
      <BriefPanel
        brief={active}
        readOnly={readOnly}
        onSaved={onBriefChanged}
        onNext={next}
        toast={showToast}
      />
    );
  } else if (panel === 2) {
    content = (
      <AssetPanel
        brief={active}
        readOnly={readOnly}
        onSelected={onBriefChanged}
        onNext={next}
        onBack={back}
        toast={showToast}
      />
    );
  } else if (panel === 3) {
    content = (
      <CopyPanel
        brief={active}
        readOnly={readOnly}
        onUpdated={onBriefChanged}
        onNext={next}
        onBack={back}
        toast={showToast}
      />
    );
  } else {
    content = (
      <LaunchPanel
        brief={active}
        conversions={conversions[active.id]}
        onBack={back}
        toast={showToast}
        onSubmitted={(b, permalink, logged) => {
          setActive(b);
          refreshList();
          showToast(
            `Submitted to Meta — ${permalink}${logged ? '' : ' (campaign log write failed)'}`,
          );
        }}
      />
    );
  }

  return (
    <div className="shell">
      <Sidebar briefs={briefs} activeId={active?.id ?? null} onSelect={selectBrief} onNew={newBrief} conversions={conversions} />
      <div className="main">
        <StatusBar brief={active} onClone={cloneActive} />
        <ProgressIndicator current={panel} onJump={setPanel} maxReachable={maxReachable(active)} />
        {content}
      </div>
      {toast && <div className={`toast ${toast.error ? 'error' : ''}`}>{toast.message}</div>}
    </div>
  );
}
