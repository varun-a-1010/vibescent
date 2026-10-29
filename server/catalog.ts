import { z } from 'zod';
import { vocabSchema, type Vocab } from './vocab';
import type { CatalogRequest } from './brief';

export const recommendationSchema = z.object({
  id: z.string(),
  name: z.string(),
  house: z.string(),
  concentration: z.string().nullish(),
  year: z.number().nullish(),
  gender: z.string().nullish(),
  price: z
    .object({ amount: z.number(), currency: z.string(), size_ml: z.number().nullish() })
    .nullish(),
  top_accords: z.array(z.object({ name: z.string(), weight: z.number() })),
  family: z.string().nullish(),
  notes: z
    .object({ top: z.array(z.string()), heart: z.array(z.string()), base: z.array(z.string()) })
    .nullish(),
  sillage: z.string().nullish(),
  longevity: z.string().nullish(),
  seasons: z.record(z.string(), z.number()).nullish(),
  occasions: z.array(z.string()).nullish(),
  vibes: z.array(z.string()).nullish(),
  time_of_day: z.array(z.string()).nullish(),
  formality: z.array(z.string()).nullish(),
  has_wearing_profile: z.boolean(),
  profile_confidence: z.string().nullish(),
  public_dossier_url: z.string().nullish(),
  score: z.number(),
  match_reasons: z.array(
    z.object({ field: z.string(), values: z.array(z.string()), contribution: z.number() }),
  ),
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
    if (response.status === 429)
      throw Object.assign(new Error('The fragrance catalog is busy. Try again in a few seconds.'), {
        statusCode: 429,
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
