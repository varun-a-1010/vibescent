# Log

## 2026-10-31

- Added a model chain led by Gemini 4 Argon, replacing the single retry, because Gemini 3.8 Flash
  timed out intermittently and rate limits must never end a request.
- Trusted the local nginx proxy so the per-client limiter works when hosted.
- Deployed to Motif at vibescent.slate-app.online and published the repository under MIT.

- 2026-10-29: repo created; server core with tests. Catalog contract awaits Fragologist.
- 2026-10-29: live probes pass (Qloo style tags, Gemini brief via Slate Vertex launcher): `npm run probe`, `npm run probe:brief`.
- 2026-10-29: API routes, GUI, photo/text suggester, dev catalog export, Vertex enum workaround, retry. End-to-end run verified by curl.
- 2026-10-29: switched to Fragologist's live recommendation API; removed dev export; multi-namespace Qloo tags; presets and restyled GUI.

## 2026-10-29 — chat-thread UI

The three-step form became one chat thread: user look bubble, Gemini read plus follow-up question,
Qloo touchstone picker, user pick bubble, then Qloo / Gemini / shortlist messages. The composer stays
docked; replies at the touchstone stage re-run suggestion with the added detail, and replies after
results become preferences for a re-run. No backend changes.
