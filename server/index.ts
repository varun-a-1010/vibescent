import { existsSync } from 'node:fs';
import { buildApp } from './app';
import { createHttpCatalog } from './catalog';
import { loadDevCatalog } from './devCatalog';
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
let catalog;
let catalogLabel: 'fragologist' | 'dev-export' | undefined;
if (env.FRAGOLOGIST_API_URL && env.FRAGOLOGIST_API_KEY) {
  catalog = createHttpCatalog({
    baseUrl: env.FRAGOLOGIST_API_URL,
    apiKey: env.FRAGOLOGIST_API_KEY,
  });
  catalogLabel = 'fragologist';
} else if (existsSync('.data/catalog.json')) {
  catalog = loadDevCatalog();
  catalogLabel = 'dev-export';
}
const app = buildApp({
  qloo: env.QLOO_API_KEY ? createQloo({ apiKey: env.QLOO_API_KEY }) : undefined,
  suggester: hasVertex ? createGeminiSuggester(vertex) : undefined,
  translator: hasVertex ? createGeminiTranslator(vertex) : undefined,
  catalog,
  catalogLabel,
});
const port = Number(env.PORT ?? 3196);
await app.listen({ port, host: '127.0.0.1' });
console.log(`VibeScent API on http://127.0.0.1:${port} (catalog: ${catalogLabel ?? 'none'})`);
