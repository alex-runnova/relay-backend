import { useEffect, useState } from 'react';
import { AssetLibraryItem, Brief } from '../../types';
import { ApiError, api } from '../../api';

/**
 * Google Drive no longer serves `uc?export=view` links to hotlinked <img>
 * tags. Convert any Drive URL to the thumbnail endpoint, which does render.
 * Returns null for non-Drive URLs (e.g. Instagram/TikTok video links), which
 * have no usable still thumbnail.
 */
function driveThumbnail(url: string | undefined): string | null {
  if (!url || !url.includes('drive.google.com')) return null;
  const m = url.match(/(?:\/d\/|[?&]id=)([a-zA-Z0-9_-]+)/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w640` : null;
}

/** Asset card image with Drive-thumbnail support and a graceful fallback. */
function AssetThumb({ asset }: { asset: AssetLibraryItem }) {
  const [failed, setFailed] = useState(false);
  const thumb = driveThumbnail(asset.thumbnail_url || asset.file_url);
  if (thumb && !failed) {
    return (
      <img
        className="thumb"
        src={thumb}
        alt={asset.asset_name}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div className="thumb" style={{ display: 'grid', placeItems: 'center', color: 'var(--ink-soft)', textAlign: 'center', padding: 8 }}>
      {asset.asset_type === 'video' ? '🎬 video' : asset.asset_type || 'image'}
    </div>
  );
}

interface Props {
  brief: Brief;
  readOnly: boolean;
  onSelected: (brief: Brief) => void;
  onNext: () => void;
  onBack: () => void;
  toast: (message: string, error?: boolean) => void;
}

export default function AssetPanel({ brief, readOnly, onSelected, onNext, onBack, toast }: Props) {
  const [assets, setAssets] = useState<AssetLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);
  const selectedId = brief.selected_asset?.asset_id ?? null;

  async function load(refresh = false) {
    setLoading(true);
    setError(null);
    try {
      setAssets(await api.listAssets(brief.industry, refresh));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load assets.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief.industry]);

  async function choose(asset: AssetLibraryItem) {
    if (readOnly) return;
    setSelecting(asset.asset_id);
    try {
      const updated = await api.selectAsset(brief.id, asset.asset_id);
      onSelected(updated);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not select asset.', true);
    } finally {
      setSelecting(null);
    }
  }

  return (
    <div className="panel" style={{ maxWidth: 960 }}>
      <h2>Asset Match</h2>
      <p className="subtitle">
        Approved assets tagged <strong>{brief.industry}</strong> from the Asset Library. Select one to continue.
      </p>

      {readOnly && <div className="locked-note">This brief is submitted and read-only.</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
          {loading ? 'Loading…' : `${assets.length} approved asset${assets.length === 1 ? '' : 's'}`}
        </span>
        <button className="btn secondary" onClick={() => load(true)} disabled={loading}>↻ Refresh</button>
      </div>

      {error && <div className="banner fail">{error}</div>}

      {!loading && !error && assets.length === 0 && (
        <div className="empty-state">No approved assets tagged “{brief.industry}”. Add one to the Asset Library and refresh.</div>
      )}

      <div className="asset-grid">
        {assets.map((a) => (
          <div
            key={a.asset_id}
            className={`asset-card ${a.asset_id === selectedId ? 'selected' : ''}`}
            onClick={() => choose(a)}
            style={{ opacity: selecting && selecting !== a.asset_id ? 0.6 : 1 }}
          >
            <AssetThumb asset={a} />
            <div className="body">
              <div className="nm">{a.asset_name}</div>
              <div className="tags">
                <span className="tag">{a.asset_type}</span>
                {a.industry_tags.map((t) => <span key={t} className="tag">{t}</span>)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="panel-actions">
        <button className="btn secondary" onClick={onBack}>← Back</button>
        <button className="btn" onClick={onNext} disabled={!selectedId}>
          {selectedId ? 'Continue →' : 'Select an asset to continue'}
        </button>
      </div>
    </div>
  );
}
