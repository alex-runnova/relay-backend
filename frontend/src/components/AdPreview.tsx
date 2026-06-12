import { AdCopy, SelectedAsset } from '../types';
import { displayDomain, driveImage } from '../lib/image';

interface Props {
  copy: AdCopy;
  asset?: SelectedAsset;
  destinationUrl: string;
  /** Meta CTA button label — matches what the backend submits. */
  cta?: string;
}

/**
 * Side-by-side Facebook + Instagram feed previews of the ad. Approximate
 * renders of Meta's chrome so the team can eyeball the creative before
 * pushing. Uses the same Drive-image transform as the asset cards.
 */
export default function AdPreview({ copy, asset, destinationUrl, cta = 'Sign Up' }: Props) {
  const img = driveImage(asset?.file_url || asset?.thumbnail_url, 1080);
  const domain = displayDomain(destinationUrl) || 'RUN-RELAY.COM';

  const Image = () =>
    img ? (
      <img src={img} alt="" style={{ width: '100%', display: 'block', aspectRatio: '1.91 / 1', objectFit: 'cover', background: '#eee' }} />
    ) : (
      <div style={{ width: '100%', aspectRatio: '1.91 / 1', background: '#ececec', display: 'grid', placeItems: 'center', color: '#999', fontSize: 13 }}>
        {asset ? 'Video asset — no still preview' : 'No asset selected'}
      </div>
    );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
      {/* Facebook */}
      <div className="ad-preview">
        <div className="ad-preview-label">Facebook feed</div>
        <div className="ad-card">
          <div className="ad-head">
            <div className="ad-avatar">R</div>
            <div>
              <div className="ad-page">Relay</div>
              <div className="ad-sponsored">Sponsored · <span style={{ fontSize: 11 }}>🌐</span></div>
            </div>
          </div>
          <div className="ad-primary">{copy.primary_text}</div>
          <Image />
          <div className="ad-linkbar">
            <div style={{ minWidth: 0 }}>
              <div className="ad-domain">{domain}</div>
              <div className="ad-headline">{copy.headline}</div>
              {copy.description && <div className="ad-desc">{copy.description}</div>}
            </div>
            <button className="ad-cta" type="button" disabled>{cta}</button>
          </div>
        </div>
      </div>

      {/* Instagram */}
      <div className="ad-preview">
        <div className="ad-preview-label">Instagram feed</div>
        <div className="ad-card">
          <div className="ad-head">
            <div className="ad-avatar ig">R</div>
            <div>
              <div className="ad-page">relay</div>
              <div className="ad-sponsored">Sponsored</div>
            </div>
          </div>
          <Image />
          <div className="ad-cta-banner">
            <span>{cta}</span>
            <span style={{ opacity: 0.6 }}>›</span>
          </div>
          <div className="ad-ig-caption">
            <span className="ad-page">relay</span> {copy.primary_text}
          </div>
          {copy.description && <div className="ad-desc" style={{ padding: '0 12px 12px' }}>{copy.description}</div>}
        </div>
      </div>
    </div>
  );
}
