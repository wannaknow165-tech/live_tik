# BOOSTERA — Live Intelligence V10 merged into live_tik

## Architecture (read this first)

This integration builds on the pre-existing `live_tik` application rather than replacing it.
It **reuses the current TikTok Swarm connections** (up to ten active rooms) and does not run a second TikTok connector.
The original broadcast stage, OBS sources, chat-companion, AI learning vault, and server APIs remain unchanged.

- Existing application: `server.ts`, `src/App.tsx`, original 5 workspaces.
- New workspace: `src/components/LiveIntelligenceWorkspace.tsx`; accessible from navigation as **מודיעין לייבים ומסקנות**.
- Event analysis: `src/server/liveInsights.mjs` — bounded in-memory rolling windows, deduped event identifiers,
  question grouping in Hebrew/English, topic trends, chat-overload signals, evidence-weighted recommendations.
- Live telemetry bridges are inside the existing `connectCreatorToSwarm()` handlers in `server.ts`;
  real chat, likes, follows, shares, joins, gifts, viewers, and optional TikTok-supplied captions are sampled once.
- Evidence-safe artistic policy from V9: recommends low-opacity smoke, sparks, lightning, or a short peak effect
  with explicit intensity and sound limits. **Recommendations are not automatically dispatched to the stage**.
- 8 pre-keyed WebM alpha VFX videos from local BOOSTERA V9 in `public/assets/boostera-alpha/`,
  displayed in the VFX Library in a dedicated 9:16 preview with Fit/Fill.
- On-demand Gemini analyst is accessed via a button and has a 60-second cooldown.
  It is not invoked automatically, and does not have permission to send chat or change the broadcast.

## Developer commands

```shell
npm install
npm run lint
npm run test:intelligence
npm run build
npm run dev
```

The original repo's `esbuild` ^0.25 conflicted with the Vite 8.3 peer dependency.
`package.json` now requests `esbuild` ^0.28 and an npm package-lock is included.
If using Bun with the existing `bun.lock`, refresh the Bun lockfile rather than freezing the old esbuild version.

## Main endpoints

- `GET /api/intelligence/status`: same-origin aggregated live intelligence + recommendations, no raw chat transcript.
- `GET /api/intelligence/export.md`: evidence-based operational report.
- `GET /api/intelligence/facts?username=...`: operator-approved facts for that creator.
- `POST /api/intelligence/facts`: save approved facts only; browser Origin checked.
- `POST /api/intelligence/visual`: optional numeric visual/audio telemetry from an explicitly shared tab/window.
- `POST /api/intelligence/ai-review`: Gemini on demand (API key required; costs may apply).
- `GET /api/intelligence/ai-review/latest`: last AI result held in server RAM.

Existing `/api/tiktok/connect-room`, watchlist scan, Swarm synthesis, /api/state, OBS, and streaming
routes continue to work as before.

## Operating procedure

1. Open the unified app. Choose **מודיעין לייבים ומסקנות**.
2. Add `@handle` or a full TikTok URL. This calls the **existing** `/api/tiktok/connect-room` with
   `OBSERVER_LEARN`, `mirrorToStage:false` — there is no extra duplicate socket.
3. Compare observed engagement after 45+ seconds (shorter samples are marked unreliable).
4. Review a recommendation and copy a Gemini-ready creative brief. The original VFX library now contains
   8 more transparent alpha WebM clips; use the standard stage pipeline after testing.
5. For busy chat, review grouped questions, add approved facts, and copy the suggested answer
   for manual posting. **The system never auto-posts messages**.
6. Optionally click "נתח חלון ושמע" for one room, and explicitly pick the corresponding browser window.
   A small 80×45 frame is analyzed locally to estimate motion, luminance, saturation, RMS sound level,
   and beats. Only numeric aggregates are posted to the server (no frames/audio). Up to three windows at once.
7. Optionally click Gemini analysis. This sends **aggregate evidence + question examples** to the configured
   Gemini service, not raw names or images. No automatic AI costs while viewing the dashboard.

## Accuracy, safety and security

- This is **not semantic video recognition**; without user-approved screen sharing, V10 sees only public
  TikTok events. With screen sharing it measures motion/brightness/audio energy, not spoken content.
- TikTok `CAPTION_MESSAGE` content is sampled only when emitted by TikTok. It is not complete ASR.
- Viewer counts and battle scores are shown only if available from the existing connector.
- The login/authorization model of the parent app was not changed. **Do not expose an unauthenticated
  deployment with operator-only endpoints to the public Internet.** Put it behind an authenticated gateway
  or add application-level authentication before production distribution.
- Approved facts are persisted to `data/live_intelligence_facts.json` (ignored by Git).
  Raw chat snippets are not saved to disk by the new module. Existing app persistence is separate.
- Gemini model is configurable with `GEMINI_MODEL`, falling back to the application's existing default.
  If no key is set, the deterministic evidence-based recommendations still work.
- The existing V9 local Ollama daemon on 4193 is NOT embedded in this repo: the original
  application's Gemini AI Director remains the primary stage AI, while V9's creative rules and alpha
  library were imported. This avoids conflicting showrunners.

## Validation

- `npm run lint`
- `npm run test:intelligence` — 9 tests passed in development (normalization, independent rooms,
  chat overload, repeated questions, accurate draft facts, replay suppression, captions, insufficient samples).
- `npm run build` — production React UI and 8 alpha clips packaged in `dist/assets/boostera-alpha/`.
- Headless Edge integration on a temporary production server: the new dashboard loads, live status is real
  (0/10 until an actual TikTok account is connected), VFX library shows all 8 alpha effects, no JS exceptions.
- **Not yet verified against the user's chosen real TikTok streams or on-air viewers.**

## Deployment note / fallback

Use your normal deployment process for the original `live_tik` project. Existing OBS links and
stage scene configuration are not automatically changed by this integration. Feature changes are additive.
