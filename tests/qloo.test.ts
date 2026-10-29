import { describe, expect, it } from 'vitest';
import { createQloo, parseTags } from '../server/qloo';

const id = '11111111-1111-4111-8111-111111111111';
const fake = (body: unknown, capture?: (u: URL) => void): typeof fetch =>
  (async (input: URL | string) => {
    capture?.(new URL(String(input)));
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;

describe('qloo client', () => {
  it('asks only for style-namespace tags and parses them', async () => {
    let url!: URL;
    const qloo = createQloo({
      apiKey: 'k',
      fetch: fake(
        { results: { tags: [{ tag_id: 'a', name: 'Rugged Utility' }, { name: 'bad' }] } },
        (u) => (url = u),
      ),
    });
    const tags = await qloo.styleTags([id]);
    expect(tags).toEqual([{ id: 'a', name: 'Rugged Utility' }]);
    expect(url.searchParams.get('filter.tag.types')).toBe('urn:tag:aesthetic_property:qloo');
    expect(url.searchParams.get('filter.type')).toBe('urn:tag');
  });
  it('rejects a non-uuid entity id', async () => {
    const qloo = createQloo({ apiKey: 'k', fetch: fake({ results: {} }) });
    await expect(qloo.styleTags(['nope'])).rejects.toThrow();
  });
  it('resolves entities of the requested kind only', async () => {
    const qloo = createQloo({
      apiKey: 'k',
      fetch: fake({
        results: [
          { entity_id: id, name: 'Zoë Kravitz', types: ['urn:entity:person'] },
          { entity_id: id.replace(/1/g, '2'), name: 'Wrong', types: ['urn:entity:brand'] },
        ],
      }),
    });
    expect((await qloo.search('zoe', 'person')).map((e) => e.name)).toEqual(['Zoë Kravitz']);
  });
  it('dedupes tags', () => {
    expect(
      parseTags([
        { tag_id: 'a', name: 'X' },
        { tag_id: 'a', name: 'X' },
      ]),
    ).toHaveLength(1);
  });
});
