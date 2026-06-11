/**
 * Relay backend entry point.
 *
 * Phase 1 scope: brief data model + CRUD API. Integrations (Claude, Google
 * Sheets, Meta Ads) mount additional routers here as they come online.
 */

import path from 'node:path';
import fs from 'node:fs';
import cors from 'cors';
import express from 'express';
import briefsRouter from './routes/briefs';
import copyRouter from './routes/copy';
import assetsRouter from './routes/assets';
import launchRouter from './routes/launch';
import strategyRouter from './routes/strategy';
import { basicAuth } from './middleware/auth';

const app = express();

app.use(cors());
app.use(express.json());

/**
 * Presence-only view of config the running container sees. Booleans + a couple
 * of non-secret resolved values (sheet range, service-account email) — never
 * secret values. Used to debug deploys without exposing credentials.
 */
function configPresence() {
  const present = (k: string) => Boolean(process.env[k] && process.env[k]!.trim());
  let serviceAccountEmail: string | null = null;
  if (present('GOOGLE_SERVICE_ACCOUNT_KEY')) {
    try {
      const json = JSON.parse(
        Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!, 'base64').toString('utf8'),
      );
      serviceAccountEmail = json.client_email ?? '(no client_email in key)';
    } catch {
      serviceAccountEmail = '(GOOGLE_SERVICE_ACCOUNT_KEY not valid base64 JSON)';
    }
  }
  return {
    ANTHROPIC_API_KEY: present('ANTHROPIC_API_KEY'),
    GOOGLE_SERVICE_ACCOUNT_KEY: present('GOOGLE_SERVICE_ACCOUNT_KEY'),
    ASSET_SHEET_ID: present('ASSET_SHEET_ID'),
    CAMPAIGN_LOG_SHEET_ID: present('CAMPAIGN_LOG_SHEET_ID'),
    META_ACCESS_TOKEN: present('META_ACCESS_TOKEN'),
    META_AD_ACCOUNT_ID: present('META_AD_ACCOUNT_ID'),
    META_PAGE_ID: present('META_PAGE_ID'),
    asset_sheet_range: process.env.ASSET_SHEET_RANGE || '(default A:H)',
    access_gate_enabled: present('RELAY_BASIC_AUTH_USER') && present('RELAY_BASIC_AUTH_PASS'),
    persistence_path: process.env.BRIEFS_DB_PATH || '(in-memory only)',
    service_account_email: serviceAccountEmail,
  };
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'relay-backend', phase: 1, config: configPresence() });
});

// Opt-in access gate (protects API + SPA). No-op unless RELAY_BASIC_AUTH_* set.
app.use(basicAuth());

app.use('/api/briefs', briefsRouter);
app.use('/api/briefs', copyRouter);
app.use('/api/briefs', launchRouter);
app.use('/api', assetsRouter);
app.use('/api', strategyRouter);

// 404 for unknown API routes (must precede the SPA fallback).
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Serve the built frontend (single Railway service). The dist dir exists in
// production builds; in dev the frontend runs on Vite and proxies /api here.
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  // SPA fallback: serve index.html for any non-API GET route.
  app.get('*', (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

const PORT = Number(process.env.PORT) || 3000;

// Only listen when run directly, so tests can import the app without binding.
if (require.main === module) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`relay-backend listening on port ${PORT}`);
  });
}

export default app;
