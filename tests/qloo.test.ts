import { describe, expect, it, vi } from 'vitest';
import { createQloo, parseTags } from '../server/qloo';

const id = '11111111-1111-4111-8111-111111111111';
const fake = (body: unknown, capture?: (u: URL) => void): typeof fetch =>
  (async (input: URL | string) => {
    capture?.(new URL(String(input)));
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;

describe('qloo client', () => {
  it('merges style namespaces, dedupes and keeps one silhouette tag', async () => {
    const urls: URL[] = [];
    const qloo = createQloo({
      apiKey: 'k',
      fetch: fake(
        {
          results: {
            tags: [
              { tag_id: 'a', name: 'Bold Silhouettes' },
              { tag_id: 'b', name: 'Oversized Silhouettes' },
              { tag_id: 'c', name: 'Edgy' },
              { name: 'bad' },
            ],
          },
        },
        (u) => urls.push(u),
      ),
    });
    const tags = await qloo.styleTags([id]);
    // Every namespace returns the same fake list, so dedupe by name leaves each name once.
    expect(tags.map((t) => t.name)).toEqual(['Bold Silhouettes', 'Edgy']);
    expect(tags[0].group).toBe('Style');
    expect(urls.map((u) => u.searchParams.get('filter.tag.types'))).toContain(
      'urn:tag:personal_style:qloo',
    );
    expect(urls.every((u) => u.searchParams.get('filter.type') === 'urn:tag')).toBe(true);
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

  it('retries a rate limit so a name is not silently lost', async () => {
    const ok = new Response(
      JSON.stringify({
        results: [
          {
            entity_id: id,
            name: 'Tom Ford',
            types: ['urn:entity:brand'],
          },
        ],
      }),
    );
    const replies = [new Response('', { status: 429 }), new Response('', { status: 503 }), ok];
    const fetcher = vi.fn(async () => replies.shift()!);
    const qloo = createQloo({
      apiKey: 'k',
      fetch: fetcher as unknown as typeof fetch,
      paceMs: 0,
      retryMs: 0,
    });
    expect((await qloo.search('Tom Ford', 'brand'))[0]?.name).toBe('Tom Ford');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
