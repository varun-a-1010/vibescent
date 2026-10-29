---
type: Reference
title: Scope and status
last_verified: 2026-10-29
---

## Built (server core, unit-tested with fakes)

- `server/qloo.ts`: entity search per category, style-tag lookup (taste analysis restricted to `urn:tag:aesthetic_property:qloo`).
- `server/brief.ts`: vocabulary-built scent brief schema; explicit constraints override cultural cues.
- `server/translator.ts`: Gemini (Vertex) translator, structured JSON output.
- `server/catalog.ts`: HTTP client for Fragologist's keyed service.
- `server/recommend.ts`: pipeline (1-5 entities, deselectable tags, brief, catalog).

## Blocked on Fragologist (handoff given 2026-10-29)

`POST /api/public/v1/recommend` and `GET /api/public/v1/vocab`, plus a `vibes` field.
Until then the pipeline cannot run end to end against real data.

## Not built

HTTP routes, entity-carousel elicitation, photo input, GUI, deployment.
