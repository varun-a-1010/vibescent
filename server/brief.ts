import { z } from 'zod';
import type { Vocab } from './vocab';

/** What the user set directly. These always win over cultural interpretation. */
export const constraintsSchema = z.object({
  budgetMaxUsd: z.number().positive().max(10_000).optional(),
  gender: z.enum(['masculine', 'feminine', 'unisex', 'any']).default('any'),
  excludeAccords: z.array(z.string().max(40)).max(20).default([]),
  excludeNotes: z.array(z.string().max(40)).max(20).default([]),
});
export type Constraints = z.infer<typeof constraintsSchema>;

/** Structured scent brief built from a vocabulary, so the model cannot invent terms. */
/** Vertex rejects very large enums in a response schema; above this the wire schema uses plain strings. */
export const WIRE_ENUM_LIMIT = 60;

/**
 * `wire` builds the schema sent to the model (large vocabularies relaxed to strings, listed in the
 * prompt instead); the strict one is always used to validate what comes back.
 */
export function createBriefSchema(vocab: Vocab, options: { wire?: boolean } = {}) {
  const pick = (values: string[]) =>
    options.wire && values.length > WIRE_ENUM_LIMIT
      ? z.string()
      : z.enum(values as [string, ...string[]]);
  const list = (values: string[], max: number) => z.array(pick(values)).max(max);
  return z.object({
    wantAccords: z
      .array(z.object({ name: pick(vocab.accords), weight: z.number().min(0).max(1) }))
      .max(8),
    families: list(vocab.families, 3),
    seasons: list(vocab.seasons, 4),
    occasions: list(vocab.occasions, 4),
    // With no vibe vocabulary the field is left out of the model's schema entirely.
    ...(vocab.vibes.length ? { vibes: list(vocab.vibes, 4) } : {}),
    sillage: list(vocab.sillage, 3),
    longevity: list(vocab.longevity, 3),
    /** One line per cultural cue saying what it contributed; shown to the user. */
    because: z.array(z.object({ cue: z.string().max(60), effect: z.string().max(160) })).max(8),
  });
}
export type ScentBrief = Omit<z.infer<ReturnType<typeof createBriefSchema>>, 'vibes'> & {
  vibes: string[];
};

/**
 * Enforces the precedence rule: explicit user constraints beat cultural interpretation.
 * Anything the user excluded is removed from the wanted accords, and the hard filters
 * are attached to the request exactly as given.
 */
export function toCatalogRequest(brief: ScentBrief, constraints: Constraints, limit = 5) {
  const banned = new Set(constraints.excludeAccords.map((a) => a.toLowerCase()));
  return {
    ...(constraints.budgetMaxUsd !== undefined ? { budget_max_usd: constraints.budgetMaxUsd } : {}),
    gender: constraints.gender,
    exclude_accords: constraints.excludeAccords,
    exclude_notes: constraints.excludeNotes,
    want_accords: brief.wantAccords.filter((a) => !banned.has(a.name.toLowerCase())),
    families: brief.families.filter((f) => !banned.has(f.toLowerCase())),
    seasons: brief.seasons,
    occasions: brief.occasions,
    vibes: brief.vibes,
    sillage: brief.sillage,
    longevity: brief.longevity,
    limit,
  };
}
export type CatalogRequest = Omit<ReturnType<typeof toCatalogRequest>, 'budget_max_usd'> & {
  budget_max_usd?: number;
};
