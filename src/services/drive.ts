/**
 * Google Drive strategy-corpus reader (Panel 1 AI pre-fill).
 *
 * Reads the agency's strategy/playbook documents from a shared Drive folder
 * (shared with the service account) and concatenates them into a single text
 * corpus that Claude uses to draft brief strategy fields. Cached aggressively
 * since these master docs change rarely.
 *
 * Requires the Google Drive API enabled on the service account's project and
 * drive.readonly scope.
 */

import { GoogleAuth } from 'google-auth-library';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const FOLDER_ID = process.env.STRATEGY_DRIVE_FOLDER_ID || '1DLB_m2ESqRO2zh0IeEq8cgf_y94p8ejY';
const CORPUS_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_CORPUS_CHARS = 40_000; // keep token usage bounded

let auth: GoogleAuth | null = null;

function getAuth(): GoogleAuth {
  if (auth) return auth;
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!encoded) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set.');
  const credentials = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  auth = new GoogleAuth({ credentials, scopes: [DRIVE_SCOPE] });
  return auth;
}

async function authHeader(): Promise<string> {
  const token = await getAuth().getAccessToken();
  if (!token) throw new Error('Failed to obtain Google access token.');
  return `Bearer ${token}`;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

async function listFolderFiles(header: string): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    q: `'${FOLDER_ID}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType)',
    includeItemsFromAllDrives: 'true',
    supportsAllDrives: 'true',
    pageSize: '100',
  });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: header },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive folder list failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { files?: DriveFile[] };
  return data.files ?? [];
}

async function readFileText(file: DriveFile, header: string): Promise<string | null> {
  let url: string;
  if (file.mimeType === 'application/vnd.google-apps.document') {
    url = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`;
  } else if (file.mimeType.startsWith('text/')) {
    url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`;
  } else {
    return null; // skip PDFs/images/etc. in Phase 1
  }
  const res = await fetch(url, { headers: { Authorization: header } });
  if (!res.ok) return null;
  return res.text();
}

let cache: { corpus: string; fetchedAt: number } | null = null;

/**
 * Load (and cache) the strategy corpus. Returns concatenated document text.
 * Throws if Drive can't be reached (e.g. API disabled, folder not shared).
 */
export async function loadStrategyCorpus(forceRefresh = false): Promise<string> {
  if (cache && !forceRefresh && Date.now() - cache.fetchedAt < CORPUS_TTL_MS) {
    return cache.corpus;
  }
  const header = await authHeader();
  const files = await listFolderFiles(header);

  const parts: string[] = [];
  let total = 0;
  for (const file of files) {
    const text = await readFileText(file, header);
    if (!text) continue;
    const block = `### ${file.name}\n${text.trim()}\n`;
    parts.push(block);
    total += block.length;
    if (total >= MAX_CORPUS_CHARS) break;
  }

  const corpus = parts.join('\n').slice(0, MAX_CORPUS_CHARS);
  cache = { corpus, fetchedAt: Date.now() };
  return corpus;
}

export function _clearStrategyCache(): void {
  cache = null;
}
