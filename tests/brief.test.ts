import { describe, expect, it } from 'vitest';
import {
  createBriefSchema,
  toCatalogRequest,
  constraintsSchema,
  type ScentBrief,
} from '../server/brief';
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

describe('empty vibe vocabulary', () => {
  it('leaves vibes out of the model schema', async () => {
    const { z } = await import('zod');
    const empty = createBriefSchema({ ...PROVISIONAL_VOCAB, vibes: [] });
    const props = (z.toJSONSchema(empty) as { properties: object }).properties;
    expect(Object.keys(props)).not.toContain('vibes');
    expect(empty.safeParse({ ...base, vibes: undefined }).success).toBe(true);
  });
});

describe('toCatalogRequest', () => {
  const brief = { vibes: [], ...schema.parse(base) } as ScentBrief;
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

describe('wire schema', () => {
  it('relaxes huge enums for the model but stays strict for validation', async () => {
    const { z } = await import('zod');
    const big = { ...PROVISIONAL_VOCAB, accords: Array.from({ length: 80 }, (_, i) => `a${i}`) };
    const wire = JSON.stringify(z.toJSONSchema(createBriefSchema(big, { wire: true })));
    expect(wire).not.toContain('"a79"');
    expect(
      createBriefSchema(big).safeParse({ ...base, wantAccords: [{ name: 'nope', weight: 1 }] })
        .success,
    ).toBe(false);
  });
});
