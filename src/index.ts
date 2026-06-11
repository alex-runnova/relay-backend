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

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'relay-backend', phase: 1 });
});

app.use('/api/briefs', briefsRouter);
app.use('/api/briefs', copyRouter);
app.use('/api/briefs', launchRouter);
app.use('/api', assetsRouter);

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
