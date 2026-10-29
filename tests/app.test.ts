import { describe, expect, it } from 'vitest';
import { buildApp } from '../server/app';
import { resolve } from '../server/suggester';
import { PROVISIONAL_VOCAB } from '../server/vocab';

const id = '11111111-1111-4111-8111-111111111111';
const qloo = {
  search: async (q: string, kind: any) => [{ entityId: id, name: q, kind }],
  styleTags: async () => [{ id: 't', name: 'Sleek', group: 'Style' }],
};
const brief = {
  wantAccords: [],
  families: [],
  seasons: [],
  occasions: [],
  vibes: [],
  sillage: [],
  longevity: [],
  because: [],
};
const app = () =>
  buildApp({
    qloo,
    translator: { translate: async () => brief },
    catalog: { vocab: async () => PROVISIONAL_VOCAB, recommend: async () => [] },
  });

describe('api', () => {
  it('reports what is connected', async () => {
    const res = await app().inject('/api/status');
    expect(res.json()).toEqual({ qloo: true, gemini: false, catalog: 'fragologist' });
  });
  it('recommends with a Qloo handoff block', async () => {
    const res = await app().inject({
      method: 'POST',
      url: '/api/recommend',
      payload: {
        look: 'x',
        entities: [{ entityId: id, name: 'A', kind: 'person' }],
        budgetMaxUsd: 90,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().qloo.tags[0].name).toBe('Sleek');
    expect(res.json().qloo.dropped).toEqual([]);
  });
  it('rejects bad input and missing services cleanly', async () => {
    const a = app();
    expect(
      (
        await a.inject({
          method: 'POST',
          url: '/api/recommend',
          payload: { look: 'x', entities: [] },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await a.inject({ method: 'POST', url: '/api/suggest', payload: { text: 'hi' } })).statusCode,
    ).toBe(503);
    expect(
      (
        await a.inject({
          method: 'POST',
          url: '/api/entities/search',
          payload: { query: 'a', kind: 'nope' },
        })
      ).statusCode,
    ).toBe(400);
  });
  it('drops unresolved suggestions and duplicates', async () => {
    const out = await resolve(
      [
        { kind: 'person', name: 'A' },
        { kind: 'person', name: 'B' },
      ],
      {
        search: async (q) => (q === 'A' ? [{ entityId: id, name: 'A', kind: 'person' }] : []),
        styleTags: async () => [],
      },
    );
    expect(out.person?.map((e) => e.name)).toEqual(['A']);
  });
});
