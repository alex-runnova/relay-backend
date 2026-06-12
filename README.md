# Relay

A four-panel web tool that generates and launches Relay's own paid **Meta
acquisition ads** — turning a campaign brief into compliant, on-brand ad copy
paired with approved creator content, and submitting a PAUSED ad to Meta.

Single Railway service: Express/TypeScript backend (serves the API + the built
React/Vite SPA) integrating Claude, Google Sheets, Google Drive, the Meta Graph
API, and PostHog.

## Docs

- **[docs/MANUAL.md](docs/MANUAL.md)** — operator & build manual: what Relay is,
  the four-panel flow, architecture, repo layout, local dev, deployment + every
  env var, integration setup, day-to-day usage, compliance rules, and
  troubleshooting.
- **[docs/V2-HANDOFF.md](docs/V2-HANDOFF.md)** — handoff for continuing into V2:
  current state, hard constraints, prioritized V2 scope, and a starter prompt
  for a fresh build session.

## Quick start

```bash
npm install
cp .env.example .env     # fill in values (see docs/MANUAL.md §6)
npm run build:frontend
npm run dev              # backend :3000, serves the SPA
npm test                 # run the test suite
```

Deployment, integrations, and the full env reference are in `docs/MANUAL.md`.
