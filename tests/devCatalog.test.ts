import { describe, expect, it } from 'vitest';
import { rank, type DevRow } from '../server/devCatalog';
import type { CatalogRequest } from '../server/brief';

const row = (id: string, over: Partial<DevRow> = {}): DevRow => ({
  id,
  name: id,
  house: 'H' + id,
  house_id: 'h' + id,
  concentration: 'EDP',
  gender: 'unisex',
  price_usd: 100,
  accords: [{ name: 'leather', weight: 1 }],
  family: 'leather',
  notes: ['vanilla'],
  rating: 8,
  votes: 500,
  sillage: 'moderate',
  longevity: 'long',
  seasons: { fall: 3 },
  occasions: ['evening'],
  ...over,
});
const req = (over: Partial<CatalogRequest> = {}): CatalogRequest => ({
  gender: 'any',
  exclude_accords: [],
  exclude_notes: [],
  want_accords: [{ name: 'leather', weight: 1 }],
  families: [],
  seasons: [],
  occasions: [],
  vibes: [],
  sillage: [],
  longevity: [],
  limit: 5,
  ...over,
});

describe('dev catalog ranking', () => {
  it('filters by budget but keeps unknown prices with a note', () => {
    const out = rank(
      [row('a', { price_usd: 300 }), row('b', { price_usd: null })],
      req({ budget_max_usd: 120 }),
    );
    expect(out.map((o) => o.id)).toEqual(['b']);
    expect(out[0].match_reasons).toContain('price not confirmed');
  });
  it('drops excluded accords and notes', () => {
    const rows = [
      row('a', {
        accords: [
          { name: 'sweet', weight: 1 },
          { name: 'leather', weight: 0.9 },
        ],
      }),
      row('b', { notes: ['Tonka bean'] }),
      row('c'),
    ];
    expect(
      rank(rows, req({ exclude_accords: ['Sweet'], exclude_notes: ['tonka'] })).map((o) => o.id),
    ).toEqual(['c']);
  });
  it('caps results per house', () => {
    const rows = ['a', 'b', 'c'].map((id) => row(id, { house_id: 'same' }));
    expect(rank(rows, req())).toHaveLength(2);
  });
  it('filters by gender but allows unisex', () => {
    const rows = [
      row('a', { gender: 'feminine' }),
      row('b', { gender: 'unisex' }),
      row('c', { gender: 'masculine' }),
    ];
    expect(
      rank(rows, req({ gender: 'masculine' }))
        .map((o) => o.id)
        .sort(),
    ).toEqual(['b', 'c']);
  });
  it('prefers matching season and occasion for profiled fragrances and flags unprofiled', () => {
    const rows = [
      row('good'),
      row('plain', { sillage: null, longevity: null, seasons: null, occasions: null }),
    ];
    const out = rank(rows, req({ seasons: ['fall'], occasions: ['evening'] }));
    expect(out[0].id).toBe('good');
    expect(out[1].has_wearing_profile).toBe(false);
  });
  it('ignores fragrances with too few votes', () => {
    expect(rank([row('a', { votes: 3 })], req())).toEqual([]);
  });
});
