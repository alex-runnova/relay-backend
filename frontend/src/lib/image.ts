/**
 * Google Drive no longer serves `uc?export=view` links to hotlinked <img>
 * tags. Convert any Drive URL to the thumbnail endpoint, which does render.
 * Returns null for non-Drive URLs (e.g. Instagram/TikTok video links), which
 * have no usable still image.
 */
export function driveImage(url: string | undefined, size = 640): string | null {
  if (!url || !url.includes('drive.google.com')) return null;
  const m = url.match(/(?:\/d\/|[?&]id=)([a-zA-Z0-9_-]+)/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w${size}` : null;
}

/** Bare domain for display in an ad preview's link bar (e.g. RUN-RELAY.COM). */
export function displayDomain(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '').toUpperCase();
  } catch {
    return '';
  }
}
