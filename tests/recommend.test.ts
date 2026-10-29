import { describe, expect, it } from 'vitest';
import { recommend } from '../server/recommend';
import { constraintsSchema } from '../server/brief';
import { PROVISIONAL_VOCAB } from '../server/vocab';
import type { CatalogRequest } from '../server/brief';

const entity = {
  entityId: 'A'.repeat(8) + '-1111-4111-8111-111111111111',
  name: 'Zoë Kravitz',
  kind: 'person' as const,
};
const brief = {
  wantAccords: [{ name: 'leather', weight: 1 }],
  families: [],
  seasons: [],
  occasions: [],
  vibes: [],
  sillage: [],
  longevity: [],
  because: [],
};

function deps() {
  const seen: { tags?: string[]; request?: CatalogRequest } = {};
  return {
    seen,
    deps: {
      qloo: {
        search: async () => [],
        styleTags: async () => [
          { id: 't1', name: 'Rugged Utility', group: 'Style' },
          { id: 't2', name: 'Noisy', group: 'Style' },
        ],
      },
      translator: {
        translate: async (i: { tags: { name: string }[] }) => {
          seen.tags = i.tags.map((t) => t.name);
          return brief;
        },
      },
      catalog: {
        vocab: async () => PROVISIONAL_VOCAB,
        recommend: async (r: CatalogRequest) => {
          seen.request = r;
          return [];
        },
      },
    },
  };
}

describe('recommend', () => {
  it('passes only non-deselected Qloo tags to the translator and shows them', async () => {
    const { deps: d, seen } = deps();
    const out = await recommend(d, {
      look: 'x',
      constraints: constraintsSchema.parse({}),
      entities: [entity],
      deselectedTagIds: ['t2'],
    });
    expect(seen.tags).toEqual(['Rugged Utility']);
    expect(out.qloo.tags.map((t) => t.name)).toEqual(['Rugged Utility']);
  });
  it('sends hard constraints to the catalog unchanged', async () => {
    const { deps: d, seen } = deps();
    await recommend(d, {
      look: 'x',
      constraints: constraintsSchema.parse({ budgetMaxUsd: 80, excludeAccords: ['leather'] }),
      entities: [entity],
    });
    expect(seen.request?.budget_max_usd).toBe(80);
    expect(seen.request?.want_accords).toEqual([]);
  });
  it('requires 1 to 5 entities', async () => {
    const { deps: d } = deps();
    await expect(
      recommend(d, { look: 'x', constraints: constraintsSchema.parse({}), entities: [] }),
    ).rejects.toThrow();
  });
});
