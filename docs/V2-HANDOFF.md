# Relay V2 — Handoff for a New Build Session

This document onboards a fresh Claude Code session (or engineer) to continue
Relay into V2 without the context of the original build chat. **Read
`docs/MANUAL.md` first** — it's the full operator + architecture reference. This
file adds: current state, hard constraints a new agent must know, the V2 scope,
and a ready-to-paste starter prompt.

---

## 1. One-paragraph primer

Relay (this repo) is a four-panel web tool that generates and launches **Relay's
own paid Meta acquisition ads** (ads that get local business owners to start a
$99/mo creator-content subscription, first visit free). It's a single Railway
service: an Express/TypeScript backend serving a React/Vite SPA, integrating
Claude (copy + strategy pre-fill), Google Sheets (asset library + campaign log),
Google Drive (strategy playbooks), Meta Graph API (creates PAUSED ads), and
PostHog (free-trial-signup conversions). The audience POV is **owner-as-hero,
Relay-as-advertiser** — see `src/prompts/relayProduct.ts` (authoritative product
facts + the 3 messaging angles) and `src/prompts/messagingRules.ts`.

---

## 2. Current state — V1 is DONE and live

- Full pipeline proven end-to-end against real services: a real Meta ad ID was
  created from a brief (campaign → ad set → creative → ad, all PAUSED).
- Deployed on Railway off branch `claude/optimistic-volta-m0k7oa` (may be merged
  to `main` by the time you read this — check the Railway source branch).
- All four panels, gating, validation, compliance engine, strategy pre-fill, ad
  previews, angle→landing-page mapping, UTM tagging, and PostHog conversion
  wiring are built, tested, and working. ~52 backend tests pass; both builds
  clean.

Codebase map, env vars, and setup are in `docs/MANUAL.md` §3–§7. Don't
re-document them — build on them.

---

## 3. Hard constraints a new agent MUST know

1. **MCP servers (Meta, PostHog, Slack, etc.) exist only inside the Claude Code
   session, NOT at runtime.** The deployed backend calls the Meta Graph API and
   PostHog HTTP API directly. Use the MCPs for *discovery/validation* (e.g.
   confirm a Meta field, inspect PostHog schema), then implement against the raw
   API.
2. **The build sandbox has an egress allowlist** — you (the agent) cannot reach
   Railway, Google, Meta, or arbitrary hosts via `curl`/WebFetch. **All live
   verification must be done by the user from their browser.** Build, typecheck,
   and unit-test locally; hand the user precise things to click/paste.
3. **Deploy is push-to-branch.** Every push to the deployed branch triggers a
   Railway rebuild (`build:all`, ~2–3 min) and restarts the backend. If the user
   is mid-test, pause pushes (briefs are persisted to the volume, so they
   survive — but a redeploy still interrupts).
4. **Model is `claude-opus-4-8`** (structured outputs; no `temperature`).
   Don't downgrade or add sampling params.
5. **Meta ad creation specifics that are load-bearing** (all in
   `src/services/meta.ts`): CBO budget on the campaign + `LOWEST_COST_WITHOUT_CAP`;
   `is_adset_budget_sharing_enabled` not needed under CBO; image via
   `image_hash` uploaded from the Drive **thumbnail** endpoint; `SIGN_UP` CTA;
   Meta App must be **Live**; everything PAUSED. Errors are tagged by step.
6. **Persistence is a flat file on a Railway volume** (`BRIEFS_DB_PATH`),
   single-replica only. Don't assume a database.
7. **Verify env wiring via `/health`** — it returns a `config` presence block.

---

## 4. V2 scope (prioritized, with where to build)

### A. Full-funnel stage variants (highest value, matches the creative brief)
The NOVA × Relay creative brief defines a **deployment matrix**: each messaging
angle × funnel stage (Awareness → Consideration → Conversion) has distinct copy
and format. V1 generates one ad per brief.
- Add a **funnel stage** dimension to the brief (`awareness | consideration |
  conversion`), or generate all three stages per brief in one pass.
- Extend `src/prompts/messagingRules.ts` / `relayProduct.ts` with the per-stage
  copy guidance (the brief PDF has exact funnel copy per angle — encode it).
- Surface stage-specific copy on Panel 3; map stage → Meta audience (the brief's
  matrix: cold→awareness, warm→consideration, hot→conversion).
- Data model: `src/types/brief.ts`; generation: `src/services/claude.ts`.

### B. Performance dashboard (pairs with conversions)
A new surface showing Meta **Insights** metrics (spend, impressions, reach, CTR,
CPC, frequency) per campaign/ad, **alongside** the PostHog free-trial-signup
conversions already wired (`src/services/posthog.ts`,
`src/routes/conversions.ts`).
- Add a Meta insights service (Graph API `/{ad_id|campaign_id}/insights`), a
  route, and a dashboard view (new top-level surface in the SPA).
- Use the Meta MCP (`ads_get_ad_entities`) to validate the exact field set first.

### C. Video / multi-format creatives
The asset library is mostly IG/TikTok **video** reels that V1 can't use (image
ads only). Add Meta video-ad support (upload video / use the reel; different
`object_story_spec`). See the asset `asset_type` field.

### D. Headline / variant options
The brief provides A/B/C/D headlines per angle. Generate multiple copy variants
per brief and let the user pick / A-B test them as separate ads.

### E. Targeting upgrade
V1 targets US country only (city is just in the campaign name). Add real geo
(Pittsburgh primary / Tampa secondary), age, and vertical targeting on the ad
set (`src/services/meta.ts` ad-set step). Mind Special Ad Category targeting
restrictions for `real estate`.

### F. Hardening (do alongside the above)
- Real **auth** (V1 has opt-in Basic Auth only) if more people use it.
- **Database** (Postgres) replacing the flat file if scaling beyond one replica
  or wanting brief history/analytics.
- Map `cta_suggestion` → a valid Meta CTA enum instead of hardcoded `SIGN_UP`.

---

## 5. Recommended approach to start V2

1. Branch from the current production branch: `git checkout -b relay/v2-<topic>`.
2. Pick **one** V2 item (A is the most aligned with the brief). Don't scaffold
   everything — build one slice, get the user to verify it live, then iterate
   (this is how V1 was built).
3. Keep the build-and-gate pattern: new integrations read env vars, degrade
   gracefully when unset, and are unit-tested as pure functions where possible.
4. Use the MCPs to validate API shapes before implementing; verify end-to-end
   only via the user's browser.
5. Run `npm run typecheck && npm test && npm run build:all` before every push.
   **Watch exit codes** — never pipe the typecheck through `| tail` (it masks
   failures; this bit us once).

---

## 6. Starter prompt to paste into a new Claude Code session

> You are continuing **Relay**, a four-panel web tool that generates and
> launches Relay's own PAUSED Meta acquisition ads. **Read `docs/MANUAL.md` and
> `docs/V2-HANDOFF.md` in full before doing anything** — they contain the
> architecture, all integrations, env vars, hard constraints, and the V2 scope.
>
> Key constraints: MCP servers are session-only (the deployed backend calls
> Meta/PostHog HTTP APIs directly); you can't reach the internet from the build
> sandbox, so all live verification is done by me in the browser; deploy is
> push-to-branch on Railway (~2–3 min rebuild); the model is `claude-opus-4-8`.
>
> We're building **V2 item [A: full-funnel stage variants]** (see V2-HANDOFF §4).
> Start by reading the relevant files (`src/types/brief.ts`,
> `src/services/claude.ts`, `src/prompts/*`), propose a small first slice, and
> confirm the plan with me before writing code. Build one slice, I'll verify it
> live, then we iterate.

Replace the bracketed item with whichever V2 piece you're starting on.
