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
export function createBriefSchema(vocab: Vocab) {
  const pick = (values: string[]) =>
    values.length ? z.enum(values as [string, ...string[]]) : z.never();
  return z.object({
    wantAccords: z
      .array(z.object({ name: pick(vocab.accords), weight: z.number().min(0).max(1) }))
      .max(8),
    families: z.array(pick(vocab.families)).max(3),
    seasons: z.array(pick(vocab.seasons)).max(4),
    occasions: z.array(pick(vocab.occasions)).max(4),
    vibes: z.array(pick(vocab.vibes)).max(4),
    sillage: z.array(pick(vocab.sillage)).max(3),
    longevity: z.array(pick(vocab.longevity)).max(3),
    /** One line per cultural cue saying what it contributed; shown to the user. */
    because: z.array(z.object({ cue: z.string().max(60), effect: z.string().max(160) })).max(8),
  });
}
export type ScentBrief = z.infer<ReturnType<typeof createBriefSchema>>;

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
