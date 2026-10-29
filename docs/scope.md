---
type: Reference
title: Scope and status
last_verified: 2026-10-29
---

## Built and verified

- API (`server/app.ts`, Fastify, port 3196): `/api/status`, `/api/suggest` (text and optional photo → look summary, one follow-up question, Qloo-resolved carousels), `/api/entities/search` (custom references), `/api/recommend`. Per-IP rate limit; Qloo and Gemini keys stay server-side.
- GUI (`src/`, Vite, port 5196): look + optional photo + budget/gender/"nothing too…" → carousel multi-select (1–5) with custom search → results with a separate **Qloo** panel (entities + style cues, each cue can be dropped and the run repeats) and a **Gemini** panel (cited reasons), reaction buttons, "Swap cultural vibe". Not visually checked by the agent.
- Pipeline: Qloo aesthetic tags → Gemini brief (vocabulary-constrained, explicit constraints win) → catalog.
- Catalog: `server/catalog.ts` calls Fragologist's keyed service (`https://fragologist.buzz/api/public/v1`, `X-Api-Key` from Doppler `fragologist/prd` `RECOMMENDATION_API_KEY`, fetched by `scripts/with-keys.mjs` into the child process only). Contract: Fragologist `docs/agents/recommendation-api.md`. The local dev export was removed.
- Qloo tags: personal style, emotional tone, look (silhouette words capped at one) and setting namespaces, shown grouped. `aesthetic_property` alone was mostly silhouette words.
- GUI: nine preset looks (varied season, formality, gender, budget), warm-dark Fragologist-style theme, result cards with accord bars, projection/longevity meters and season chips.
- Live end-to-end run (leather jacket, rooftop bar, ≤$120, no sweet) returns leather/smoky/woody picks with per-item reasons.

## Known limits

- Only 50 fragrances have vibe tags (Fragologist pilot), so the vibe match rarely contributes yet. The API's partner rate limit is one request every 12 s after a burst of 30.
- Qloo style cues can be off-mood for a look (e.g. "Eco-Conscious" for a club outfit); that is why each cue can be dropped.
- Vertex rejects very large enums in a response schema, so the wire schema relaxes lists over 60 values and the strict schema validates (retry once).
- Wearing profile (sillage, longevity, seasons, occasions) is estimated and covers about 55% of the exported catalog.

## Not built

Deployment and public hosting, README/licence for submission, demo video, a persisted session.
