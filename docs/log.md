# Log

## 2026-10-31

- Added a second Vertex project. A failed call now tries the same model there before the chain
  moves to the next model, so a quota limit on one project keeps Argon in use.
- Added all six requested sample look photos as 800×800 JPEGs under 150 KB each;
  their prompts and exact filenames are in `docs/image-requests.md`.
- Added a model chain led by Gemini 4 Argon, replacing the single retry, because Gemini 3.8 Flash
  timed out intermittently and rate limits must never end a request.
- Trusted the local nginx proxy so the per-client limiter works when hosted.
- Deployed to Motif at vibescent.slate-app.online and published the repository under MIT.
- Cached the vocabulary and repeat recommendations, honored `Retry-After`, and dropped score-zero
  items, after Fragologist's audit showed one shared bucket of 30 requests and fallback results with
  no evidence.
- Refreshed the sample looks toward sports, film, live music and hosting, and made sample photos
  optional so a look works before its photo exists. Moved first-step suggestions to the fast chain.

- 2026-10-29: repo created; server core with tests. Catalog contract awaits Fragologist.
- 2026-10-29: live probes pass (Qloo style tags, Gemini brief via Slate Vertex launcher): `npm run probe`, `npm run probe:brief`.
- 2026-10-29: API routes, GUI, photo/text suggester, dev catalog export, Vertex enum workaround, retry. End-to-end run verified by curl.
- 2026-10-29: switched to Fragologist's live recommendation API; removed dev export; multi-namespace Qloo tags; presets and restyled GUI.

## 2026-10-29 — chat-thread UI

The three-step form became one chat thread: user look bubble, Gemini read plus follow-up question,
Qloo touchstone picker, user pick bubble, then Qloo / Gemini / shortlist messages. The composer stays
docked; replies at the touchstone stage re-run suggestion with the added detail, and replies after
results become preferences for a re-run. No backend changes.
