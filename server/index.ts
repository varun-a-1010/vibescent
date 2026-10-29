import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildApp } from './app';
import { createHttpCatalog } from './catalog';
import { createQloo } from './qloo';
import { createGeminiSuggester } from './suggester';
import { createGeminiTranslator } from './translator';

const env = process.env;
const vertex = {
  project: env.VERTEX_LLM_PROJECT_ID,
  serviceAccount: env.VERTEX_LLM_SERVICE_ACCOUNT,
  location: env.VERTEX_LLM_REGION,
};
const hasVertex = Boolean(vertex.project && vertex.serviceAccount);
const catalogKey = env.FRAGOLOGIST_API_KEY;
const catalog = catalogKey
  ? createHttpCatalog({
      baseUrl: env.FRAGOLOGIST_API_URL ?? 'https://fragologist.buzz',
      apiKey: catalogKey,
    })
  : undefined;
const catalogLabel = catalog ? ('fragologist' as const) : undefined;
const app = buildApp({
  qloo: env.QLOO_API_KEY ? createQloo({ apiKey: env.QLOO_API_KEY }) : undefined,
  suggester: hasVertex ? createGeminiSuggester(vertex) : undefined,
  translator: hasVertex ? createGeminiTranslator(vertex) : undefined,
  catalog,
  catalogLabel,
});
if (env.NODE_ENV === 'production' && existsSync('dist')) {
  const { default: fastifyStatic } = await import('@fastify/static');
  await app.register(fastifyStatic, { root: resolve('dist') });
}
const port = Number(env.PORT ?? 3196);
await app.listen({ port, host: '127.0.0.1' });
console.log(`VibeScent API on http://127.0.0.1:${port} (catalog: ${catalogLabel ?? 'none'})`);
