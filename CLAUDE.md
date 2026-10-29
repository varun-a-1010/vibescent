# VibeScent

Independent Qloo hackathon project: turns an outfit, occasion and cultural touchstones
into a shortlist of fragrance samples. Flow: Qloo (confirmed entities, then aesthetic
tags) → Gemini (scent brief in Fragologist's controlled vocabulary) → Fragologist
catalog service (filter and rank). Work on `main`; no remote is configured initially.
Never modify Fragologist from this repo (use an inbox request), Doorway, Partner Mix,
Common Ground or any submitted artifact.

- Follow `~/code/AGENTS.md`. No unsolicited browser or visual QA.
- `npm run check` runs formatting, tests and type checking. `npm run probe` is the
  opt-in live Qloo check.
- Qloo only establishes cultural associations (entity ids, style tags). The UI must show
  Qloo output separately from LLM interpretation. Never imply Qloo "recommends" a
  fragrance.
- Explicit user constraints (budget, excluded accords/notes, plain-English dislikes)
  always beat cultural cues; `server/brief.ts` enforces it.
- The brief schema is built from the catalog's vocabulary; the model cannot invent terms.
  `server/vocab.ts` is provisional until Fragologist serves `/api/public/v1/vocab`.
- Fragologist wearing metadata (sillage, longevity, seasons, occasions) covers about 58%
  of its catalog and is estimated; do not present it as measured.
- Secrets stay server-side. `QLOO_API_KEY` is in Doppler `shared/dev_mac`; Vertex settings
  come from Slate via `scripts/with-keys.mjs` (authorized local reuse, child memory only).

## Docs

Read `docs/index.md`. Update affected docs and `docs/log.md` in the same change.
