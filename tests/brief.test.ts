import { describe, expect, it } from 'vitest';
import { createBriefSchema, toCatalogRequest, constraintsSchema } from '../server/brief';
import { PROVISIONAL_VOCAB } from '../server/vocab';

const vocab = { ...PROVISIONAL_VOCAB, vibes: ['rugged', 'polished', 'cozy'] };
const schema = createBriefSchema(vocab);
const base = {
  wantAccords: [
    { name: 'leather', weight: 0.9 },
    { name: 'sweet', weight: 0.4 },
  ],
  families: ['leather', 'woody'],
  seasons: ['fall'],
  occasions: ['evening'],
  vibes: ['rugged'],
  sillage: ['moderate'],
  longevity: ['long'],
  because: [{ cue: 'Leather Jackets', effect: 'pushes leather and woody' }],
};

describe('scent brief', () => {
  it('accepts terms from the vocabulary', () => {
    expect(schema.safeParse(base).success).toBe(true);
  });
  it('rejects terms the model invented', () => {
    expect(schema.safeParse({ ...base, vibes: ['edgy-vaporwave'] }).success).toBe(false);
    expect(
      schema.safeParse({ ...base, wantAccords: [{ name: 'tarmac', weight: 1 }] }).success,
    ).toBe(false);
  });
});

describe('toCatalogRequest', () => {
  const brief = schema.parse(base);
  it('lets explicit exclusions beat cultural cues', () => {
    const constraints = constraintsSchema.parse({ excludeAccords: ['Sweet'], budgetMaxUsd: 120 });
    const req = toCatalogRequest(brief, constraints);
    expect(req.want_accords.map((a) => a.name)).toEqual(['leather']);
    expect(req.exclude_accords).toEqual(['Sweet']);
    expect(req.budget_max_usd).toBe(120);
  });
  it('drops a wanted family the user excluded', () => {
    const req = toCatalogRequest(brief, constraintsSchema.parse({ excludeAccords: ['woody'] }));
    expect(req.families).toEqual(['leather']);
  });
});
