import { describe, expect, it, vi } from 'vitest';
import { createHttpCatalog } from '../server/catalog';
import type { CatalogRequest } from '../server/brief';

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });
const request = { limit: 10 } as unknown as CatalogRequest;
const catalogWith = (fetchMock: unknown) =>
  createHttpCatalog({
    baseUrl: 'https://catalog.test',
    apiKey: 'k',
    fetch: fetchMock as typeof fetch,
    sleep: async () => {},
  });

describe('fragrance catalog client', () => {
  it('spends the shared bucket once for an identical request', async () => {
    const fetchMock = vi.fn(async () => json({ items: [] }));
    const catalog = catalogWith(fetchMock);
    await catalog.recommend(request);
    await catalog.recommend(request);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('waits out a short Retry-After, then continues', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({}, 429, { 'retry-after': '12' }))
      .mockResolvedValueOnce(json({ items: [] }));
    await expect(catalogWith(fetchMock).recommend(request)).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports a long wait as busy instead of holding the request open', async () => {
    const fetchMock = vi.fn(async () => json({}, 429, { 'retry-after': '120' }));
    await expect(catalogWith(fetchMock).recommend(request)).rejects.toMatchObject({
      statusCode: 429,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
