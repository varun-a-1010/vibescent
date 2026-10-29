---
type: Reference
title: Scope and status
last_verified: 2026-10-29
---

## Built and verified

- API (`server/app.ts`, Fastify, port 3196): `/api/status`, `/api/suggest` (text and optional photo → look summary, one follow-up question, Qloo-resolved carousels), `/api/entities/search` (custom references), `/api/recommend`. Per-IP rate limit; Qloo and Gemini keys stay server-side.
- GUI (`src/`, Vite, port 5196): look + optional photo + budget/gender/"nothing too…" → carousel multi-select (1–5) with custom search → results with a separate **Qloo** panel (entities + style cues, each cue can be dropped and the run repeats) and a **Gemini** panel (cited reasons), reaction buttons, "Swap cultural vibe". Not visually checked by the agent.
- Pipeline: Qloo aesthetic tags → Gemini brief (vocabulary-constrained, explicit constraints win) → catalog.
- Catalog: `server/catalog.ts` HTTP client for Fragologist's keyed service (not built there yet) or `server/devCatalog.ts`, a local scorer over a read-only export (`npm run export:catalog` → ignored `.data/catalog.json`: 8,675 in-catalog fragrances, 4,748 with a wearing profile, 2,359 with a USD price).
- Live end-to-end run (leather jacket, rooftop bar, ≤$120, no sweet) returns leather/smoky/woody picks with per-item reasons.

## Known limits

- Dev catalog: most fragrances have no USD price, so under a budget many results read "price not confirmed". No `vibes` field exists yet, so vibes are ignored.
- Vertex rejects very large enums in a response schema, so the wire schema relaxes lists over 60 values and the strict schema validates (retry once).
- Wearing profile (sillage, longevity, seasons, occasions) is estimated and covers about 55% of the exported catalog.
- Pending from Fragologist (handoff 2026-10-29): `POST /api/public/v1/recommend`, `GET /api/public/v1/vocab`, `vibes`. Set `FRAGOLOGIST_API_URL` and `FRAGOLOGIST_API_KEY` to switch over.

## Not built

Deployment and public hosting, README/licence for submission, demo video, a persisted session.
