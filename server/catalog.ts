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

const VOCAB_TTL_MS = 3_600_000;
const RESULT_TTL_MS = 1_800_000;
const MAX_RETRY_WAIT_S = 13;

export function createHttpCatalog(options: {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}): Catalog {
  const base = options.baseUrl.replace(/\/$/, '');
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  async function call(path: string, init: RequestInit = {}, retry = true): Promise<unknown> {
    const response = await (options.fetch ?? fetch)(`${base}${path}`, {
      ...init,
      headers: { 'X-Api-Key': options.apiKey, 'Content-Type': 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
    });
    if (response.status === 429) {
      const wait = Number(response.headers.get('retry-after'));
      if (retry && wait > 0 && wait <= MAX_RETRY_WAIT_S) {
        await sleep(wait * 1000);
        return call(path, init, false);
      }
      throw Object.assign(new Error('The fragrance catalog is busy. Try again in a few seconds.'), {
        statusCode: 429,
      });
    }
    if (!response.ok) throw new Error(`Catalog ${path} returned HTTP ${response.status}`);
    return response.json();
  }
  // Every partner request draws on one small shared bucket, so nothing is fetched twice.
  let vocab: { value: Vocab; expires: number } | undefined;
  const results = new Map<string, { items: Recommendation[]; expires: number }>();
  return {
    async vocab() {
      if (vocab && vocab.expires > Date.now()) return vocab.value;
      const value = vocabSchema.parse(await call('/api/public/v1/vocab'));
      vocab = { value, expires: Date.now() + VOCAB_TTL_MS };
      return value;
    },
    async recommend(request) {
      const body = JSON.stringify(request);
      const cached = results.get(body);
      if (cached && cached.expires > Date.now()) return cached.items;
      const { items } = z
        .object({ items: z.array(recommendationSchema) })
        .parse(await call('/api/public/v1/recommend', { method: 'POST', body }));
      if (results.size >= 200) results.delete(results.keys().next().value!);
      results.set(body, { items, expires: Date.now() + RESULT_TTL_MS });
      return items;
    },
  };
}
