# Relay — Operator & Build Manual

A complete how-to for owning, operating, deploying, and understanding Relay. If
you just inherited this tool, read this top to bottom once; afterward use it as
a reference.

---

## 1. What Relay is

**Relay (the business)** is a $99/month subscription for local businesses
(independent restaurants, cafés, bars, salons, barbers, fitness, wellness, med
spas, entertainment). Each month a vetted local creator visits the business,
samples the menu, and produces content — one Reel/TikTok, same-day Stories,
three commercial-use photos the business keeps forever, and one Google review —
fully hands-off for the owner. The first visit is **free**.

**Relay (this tool)** is a four-panel web dashboard that the team uses to
generate, review, and launch **Relay's own paid Meta acquisition ads** — the
ads that get business owners to sign up for that subscription. It turns a
campaign brief into compliant, on-brand ad copy paired with approved creator
content, and submits a **PAUSED** ad straight to Meta. The ads' single goal is
free-trial signups.

> POV that drives all generated copy: **Relay is the advertiser; the small-
> business owner is the audience and the hero.** Copy sells the owner peace of
> mind (hands-off monthly content they own), never "we run your ads." This is
> encoded in `src/prompts/relayProduct.ts` and `src/prompts/messagingRules.ts`.

---

## 2. The four-panel flow (what the tool does)

Panels are sequential; you can't advance until the current one is valid.

1. **Brief** — campaign inputs (name, owner, industry, city, objective, tone,
   target audience, product/service, key message, **messaging angle**,
   **destination URL**, daily budget ≥ $5, flight dates). A **"Draft with Relay
   strategy"** button uses Claude + the strategy docs in Google Drive to
   pre-fill audience / product / key message from Brief Name + Industry.
2. **Asset Match** — approved assets from the Google Sheets Asset Library,
   filtered to the brief's industry. Pick one. (Image assets only for now —
   see Limitations.)
3. **Copy Output** — click Generate; Claude returns headline, primary text,
   description, CTA suggestion, a compliance score (color-coded), and any
   compliance flags. Edit or regenerate. Can't proceed if score < 60 or a
   hard-block flag is present.
4. **Launch Readiness** — runs all pre-flight checks, shows **Facebook +
   Instagram ad previews**, and **Push to Meta** creates a PAUSED ad. On
   success the brief locks (`submitted`), a row is written to the Campaign Log
   sheet, and you get the ad permalink. Submitted briefs show free-trial-signup
   conversion counts (from PostHog).

**Brief lifecycle:** `draft → ready_for_meta → submitted`. A submitted brief is
read-only — **clone** it to revise. The left sidebar lists all briefs (newest
first) with status badges and signup counts.

**The three messaging angles** (each maps to its own landing page; selecting one
auto-fills the Destination URL):
- `social_proof` — "Your peers are already doing this" → `/peers`
- `time_relief` — "You don't have time. We do" → `/time`
- `value` — "Easier & cheaper than you think" → `/value`

---

## 3. Architecture

Single Railway service. Express (TypeScript) serves both the JSON API under
`/api` **and** the built React SPA (static) from one origin.

```
Browser (React SPA, Vite build)
        │  /api/*
        ▼
Express backend (Node/TS)
  ├── Claude (Anthropic) ........ copy generation + strategy pre-fill
  ├── Google Sheets ............. Asset Library (read) + Campaign Log (write)
  ├── Google Drive .............. strategy playbooks (read) for pre-fill
  ├── Meta Graph API ............ campaign → ad set → creative → ad (PAUSED)
  └── PostHog ................... free-trial-signup conversions (read)
Storage: in-memory Map, optionally persisted to a flat JSON file (a Railway volume)
```

- Model: **`claude-opus-4-8`**, structured JSON outputs, 1500 max tokens, 30s
  timeout, 3 retries. (The spec named `claude-3-5-sonnet`, which is retired;
  Opus 4.8 also removed the `temperature` param, so tone is steered via prompt.)
- The Meta + PostHog MCP servers are **only available in a Claude Code session**,
  not at runtime — the deployed backend calls the Meta Graph API and PostHog
  HTTP API directly.

---

## 4. Repo layout

```
src/                         backend
  index.ts                   entry: /health(+config readout), auth gate, routers, SPA serve
  types/brief.ts             Brief data model, enums, angles, copy limits
  types/compliance.ts        flag taxonomy, enforceCompliance(), char counts
  types/asset.ts             Asset Library row parsing + filtering (pure)
  types/readiness.ts         Panel 4 launch checks (pure)
  validation/brief.ts        Panel 1 validation
  store/briefStore.ts        in-memory + opt-in flat-file persistence
  services/claude.ts         generateCopy(), draftStrategy()
  services/sheets.ts         loadAssets(), appendCampaignLog()
  services/drive.ts          loadStrategyCorpus()
  services/meta.ts           createPausedAd() + pure helpers
  services/posthog.ts        getConversionsByBrief()
  prompts/relayProduct.ts    authoritative Relay product + 3 angles (ground truth)
  prompts/messagingRules.ts  copy system prompt (imports relayProduct)
  routes/                    briefs, copy, assets, launch, strategy, conversions
  middleware/auth.ts         opt-in HTTP Basic Auth
frontend/src/                React + Vite + TS dashboard
  App.tsx                    orchestrator (state, panel nav, conversions fetch)
  api.ts                     typed API client
  types.ts                   frontend mirror of backend contract
  components/                Sidebar, StatusBar, ProgressIndicator, AdPreview
  components/panels/         BriefPanel, AssetPanel, CopyPanel, LaunchPanel
  lib/image.ts               Drive image-URL → thumbnail-endpoint helper
test/                        node:test suites (pure logic + smoke)
railway.json                 build:all + npm start + /health check
.env.example                 every env var, documented
```

Scripts (root `package.json`): `dev` (backend), `dev:frontend` (Vite),
`build` (backend tsc), `build:frontend`, `build:all` (both — used by Railway),
`start` (prod), `typecheck`, `test`.

---

## 5. Run locally

```bash
npm install
cp .env.example .env        # fill in values
npm run build:frontend      # build the SPA once (or use dev:frontend for live)
npm run dev                 # backend on :3000, serves the built SPA
# In a second terminal for live frontend editing:
npm run dev:frontend        # Vite on :5173, proxies /api → :3000
```

Tests / typecheck: `npm test`, `npm run typecheck`.

---

## 6. Deploy (Railway) + full env reference

Railway builds with `build:all` and starts with `npm start`; health check is
`/health`. **Deploy the branch Railway is pointed at** (Settings → Source →
Branch). Env-var changes require a redeploy to take effect.

**Verify what the running container sees:** open `/health` — it returns a
`config` block with booleans for each key (no secret values), the resolved sheet
range, persistence path, and the service-account email. Use it to debug missing
or mis-scoped variables.

| Variable | Required | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Claude copy + strategy pre-fill |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | ✅ | **base64** of the service-account JSON |
| `ASSET_SHEET_ID` | ✅ | Asset Library spreadsheet id (the long id in the URL) |
| `CAMPAIGN_LOG_SHEET_ID` | ✅ | Campaign Log spreadsheet id |
| `ASSET_SHEET_RANGE` | ⬜ | e.g. `'For Relay Build'!A:H` if data is on a named tab (quote names with spaces) |
| `CAMPAIGN_LOG_RANGE` | ⬜ | default `A:J` |
| `STRATEGY_DRIVE_FOLDER_ID` | ⬜ | playbook folder for pre-fill (defaulted) |
| `META_ACCESS_TOKEN` | ✅ | long-lived token |
| `META_AD_ACCOUNT_ID` | ✅ | numeric (e.g. `1142738370641284`); `act_` prefix added automatically |
| `META_PAGE_ID` | ✅ | Page the ads publish under (e.g. `561230640409415`) |
| `META_APP_ID` / `META_APP_SECRET` | ⬜ | not used by current code (token is long-lived) |
| `POSTHOG_API_KEY` | ⬜ | personal API key, `query:read` scope → turns on conversion counts |
| `POSTHOG_HOST` / `POSTHOG_PROJECT_ID` | ⬜ | default `us.posthog.com` / `349303` |
| `RELAY_BASIC_AUTH_USER` / `RELAY_BASIC_AUTH_PASS` | ⬜ | set **both** to lock the URL (API + SPA) behind Basic Auth |
| `BRIEFS_DB_PATH` | ⬜→✅ | set to `/data/briefs.json` on a **mounted Railway volume** — without it, briefs vanish on every restart/redeploy |
| `PORT` | — | Railway sets it automatically; don't set it |

---

## 7. Integration setup (one-time, step by step)

### Google (Sheets + Drive)
1. In the service account's Google Cloud project, **enable** the **Google Sheets
   API** and **Google Drive API** (Console → APIs & Services → Library).
2. Find the service account's `client_email` (in the JSON). **Share** the Asset
   Library sheet, the Campaign Log sheet, and the strategy Drive folder with that
   email (**Editor**). This is the #1 silent failure — an unshared sheet returns
   403.
3. **Asset Library** tab — row 1 headers (matched by name): `asset_id,
   asset_name, asset_type, file_url, thumbnail_url, industry_tags, approved,
   last_updated`. Only `approved = TRUE` rows show. `industry_tags` = comma-
   separated lowercase values from the industry dropdown. `file_url` must be a
   **publicly shared** image. If the data is on a named tab, set
   `ASSET_SHEET_RANGE`.
   - Drive image links: store them however; the tool converts Drive URLs to the
     `thumbnail?id=…` endpoint (which actually serves image bytes) for both
     display and Meta upload.
4. **Campaign Log** tab — just needs to exist; columns appended on submission:
   `brief_id, brief_name, owner, industry, submitted_at, meta_ad_id,
   meta_campaign_id, meta_review_status, meta_permalink, compliance_score`.
5. **Strategy folder** — Google Docs in the folder are read (exported to text)
   and fed to the pre-fill. Keep them accurate to the product; the canonical
   facts in `relayProduct.ts` override anything ambiguous.

### Meta
1. The **Meta App must be in Live mode** (App Dashboard → toggle Development →
   Live; may require a Privacy Policy URL + App category). Development-mode apps
   cannot create ad creatives that publish Page posts.
2. The long-lived `META_ACCESS_TOKEN` needs `ads_management` on the ad account
   and the Page (`META_PAGE_ID`) must belong to that account.
3. Ads are created **PAUSED** with **campaign-level budget (CBO)** and bid
   strategy `LOWEST_COST_WITHOUT_CAP`. Targeting is US + the brief city is only
   in the name for now (see Limitations). Special Ad Category `HOUSING` is sent
   for `real estate`. CTA button is **Sign Up**.

### PostHog
1. Create a **personal API key** with **`query:read`** scope (add `project:read`
   if the query endpoint 403s), scoped to the Relay org + project `349303`.
2. Set `POSTHOG_API_KEY`. Conversions are attributed via the person's
   `$initial_utm_term` = brief id, which the ad link carries.

---

## 8. Using Relay day to day

1. **New brief** → fill Panel 1. Pick a **messaging angle** (auto-fills its
   landing page). Optionally hit **Draft with Relay strategy** to pre-fill the
   strategy fields, then edit.
2. **Asset** → pick an approved **image** asset for the brief's industry.
3. **Copy** → Generate. Check the compliance badge (green ≥80 / yellow 60–79 /
   red <60) and flags. Edit any field or Regenerate. Save edits, then continue.
4. **Launch** → review the FB/IG previews and the readiness checklist. **Push to
   Meta** → a PAUSED ad is created; you get the permalink. The brief locks.
5. **In Meta Ads Manager**, review the PAUSED ad and **unpause** it to start
   spending (the tool never spends on its own).
6. **Conversions** (free-trial signups) appear on Panel 4 and the sidebar once
   the landing pages are live, the ad is running, and PostHog has data.

To change a submitted brief: open it (read-only) → **Clone to revise** →
edit the new draft → resubmit.

---

## 9. Compliance (Relay Messaging Rules)

Encoded in `src/prompts/messagingRules.ts` + enforced in
`src/types/compliance.ts`:
- **Hard blocks** (force score to 0, block submission): `INCOME_CLAIM`,
  `HEALTH_OUTCOME_CLAIM`, `DISCRIMINATORY_TARGETING`.
- **Soft warnings** (flag, don't block): `VAGUE_CTA`, `READING_LEVEL_HIGH`,
  `PASSIVE_VOICE`.
- **`SPECIAL_AD_CATEGORY`** auto-applied server-side for `healthcare` and `real
  estate` (only `real estate` → Meta `HOUSING`; healthcare is an internal
  warning, not a Meta SAC).
- Meta character limits: headline 40, primary_text 125, description 30.

---

## 10. Troubleshooting (the gotchas we actually hit)

| Symptom | Cause / Fix |
|---|---|
| Build fails "repo only has README" | Railway is on the wrong branch — point it at the deployed branch (or merge to `main`). |
| `X is not set` despite the var existing | Var on the wrong **service/environment**, or no redeploy since adding it. Check `/health` `config`. Variables are per-service + per-environment. |
| Panel 2 empty / "Asset sheet fetch failed (403)" | Enable the **Sheets API**, and **share the sheet** with the service-account email. |
| Panel 2 empty, no error (`count:0`) | Range points at the wrong tab (`ASSET_SHEET_RANGE`), or no `approved=TRUE` rows / industry-tag mismatch. |
| Thumbnails / Meta image won't load | Drive `uc?export=view` doesn't serve bytes — the tool uses the `thumbnail?id=…` endpoint; ensure the Drive files are **publicly shared**. |
| "Brief not found" mid-flow | In-memory store wiped by a restart/redeploy. Set `BRIEFS_DB_PATH` to a **mounted volume**. |
| Meta "is_adset_budget_sharing_enabled" / "bid amount required" | Use CBO (budget on campaign) + `LOWEST_COST_WITHOUT_CAP` — already in code. |
| Meta "image wasn't downloaded" | Drive thumbnail endpoint fix (in code); file must be public. |
| Meta "app is in development mode" | Switch the Meta App to **Live**. |
| Meta `code 1` "unknown error" | Transient / account clutter. Delete orphaned PAUSED campaigns, confirm the account is healthy (payment method, not spend-capped), wait, retry once. |
| Conversions error (not 0) | PostHog key scope — add `project:read`. |

Each Meta submission error is prefixed with the failing step
(`[campaign]` / `[ad set]` / `[creative]` / `[ad]`) plus Meta's code/subcode/
trace — paste that when debugging.

---

## 11. Known limitations (current as of V1)

- **Image ads only.** Video/Instagram/TikTok reel assets in the library can't be
  used as creatives yet (they're page links, not media files).
- **Targeting is US + city-in-name only.** No geo radius / age / interest
  targeting yet.
- **Single ad per brief.** The creative brief has A/B/C/D headline options and
  three funnel stages; the tool generates one ad.
- **Flat-file persistence, single replica.** Fine for one Railway instance; a
  real database is needed to scale out.
- **App secret unused.** The token is long-lived; no OAuth refresh flow.
