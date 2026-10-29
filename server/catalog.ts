import { z } from 'zod';
import { vocabSchema, type Vocab } from './vocab';
import type { CatalogRequest } from './brief';

export const recommendationSchema = z.object({
  id: z.string(),
  name: z.string(),
  house: z.string(),
  concentration: z.string().nullish(),
  price_usd: z.number().nullish(),
  accords: z.array(z.string()),
  sillage: z.string().nullish(),
  longevity: z.string().nullish(),
  has_wearing_profile: z.boolean(),
  match_reasons: z.array(z.string()),
  public_url: z.string().nullish(),
});
export type Recommendation = z.infer<typeof recommendationSchema>;

/** Fragologist's keyed catalog service (contract requested 2026-10-29, not yet built). */
export interface Catalog {
  vocab(): Promise<Vocab>;
  recommend(request: CatalogRequest): Promise<Recommendation[]>;
}

export function createHttpCatalog(options: {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}): Catalog {
  const base = options.baseUrl.replace(/\/$/, '');
  async function call(path: string, init: RequestInit = {}) {
    const response = await (options.fetch ?? fetch)(`${base}${path}`, {
      ...init,
      headers: { 'X-Api-Key': options.apiKey, 'Content-Type': 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
    });
    if (!response.ok) throw new Error(`Catalog ${path} returned HTTP ${response.status}`);
    return response.json();
  }
  return {
    async vocab() {
      return vocabSchema.parse(await call('/api/public/v1/vocab'));
    },
    async recommend(request) {
      const data = z
        .object({ items: z.array(recommendationSchema) })
        .parse(
          await call('/api/public/v1/recommend', { method: 'POST', body: JSON.stringify(request) }),
        );
      return data.items;
    },
  };
}
