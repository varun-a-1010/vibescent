import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { constraintsSchema } from './brief';
import type { Catalog } from './catalog';
import { MAX_ENTITIES, recommend } from './recommend';
import { IMAGE_TYPES, type Suggester } from './suggester';
import type { Translator } from './translator';
import { PRIMARY_KINDS, SECONDARY_KINDS, type Qloo } from './qloo';

export type Deps = {
  qloo?: Qloo;
  suggester?: Suggester;
  translator?: Translator;
  catalog?: Catalog;
  catalogLabel?: 'fragologist';
};

const kind = z.enum([...PRIMARY_KINDS, ...SECONDARY_KINDS]);
const entity = z.object({
  entityId: z
    .string()
    .uuid()
    .transform((s) => s.toUpperCase()),
  name: z.string().min(1).max(200),
  kind,
});
const suggestBody = z.object({
  text: z.string().max(1000).default(''),
  image: z.object({ mimeType: z.enum(IMAGE_TYPES), data: z.string().max(6_000_000) }).optional(),
});
const replyBody = z.object({ text: z.string().min(1).max(1000) });
const searchBody = z.object({ query: z.string().min(1).max(100), kind });
const recommendBody = constraintsSchema.extend({
  look: z.string().min(1).max(1000),
  preferences: z.string().max(500).default(''),
  entities: z.array(entity).min(1).max(MAX_ENTITIES),
  deselectedTagIds: z.array(z.string().max(200)).max(50).default([]),
});

/** Small per-IP window limiter: the public demo spends Gemini and Qloo quota. */
function limiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string) => {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(key, recent);
    return recent.length <= max;
  };
}

export function buildApp(deps: Deps): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 9_000_000, trustProxy: '127.0.0.1' });
  const allow = limiter(30, 60_000);
  app.addHook('onRequest', async (req, reply) => {
    if (req.method === 'POST' && !allow(req.ip))
      return reply.code(429).send({ error: 'Too many requests. Try again in a minute.' });
  });
  const need = <T>(value: T | undefined, what: string): T => {
    if (!value) throw Object.assign(new Error(`${what} is not connected.`), { statusCode: 503 });
    return value;
  };
  app.setErrorHandler((error: Error & { statusCode?: number }, _req, reply) => {
    if (error instanceof z.ZodError) return reply.code(400).send({ error: 'Invalid request.' });
    const code = error.statusCode && error.statusCode < 500 ? error.statusCode : 502;
    if (error.statusCode === 503 || error.statusCode === 429)
      return reply.code(error.statusCode).send({ error: error.message });
    console.error('request failed:', error.message);
    return reply.code(code).send({ error: 'That step failed. Please try again.' });
  });
  app.get('/api/status', async () => ({
    qloo: Boolean(deps.qloo),
    gemini: Boolean(deps.suggester && deps.translator),
    catalog: deps.catalog ? (deps.catalogLabel ?? 'fragologist') : null,
  }));
  app.post('/api/suggest', async (req) => {
    const body = suggestBody.parse(req.body);
    if (!body.text.trim() && !body.image) throw new z.ZodError([]);
    return need(deps.suggester, 'Gemini').suggest(body, need(deps.qloo, 'Qloo'));
  });
  app.post('/api/reply', async (req) => {
    const body = replyBody.parse(req.body);
    return need(deps.suggester, 'Gemini').parseReply(body.text, need(deps.qloo, 'Qloo'));
  });
  app.post('/api/entities/search', async (req) => {
    const body = searchBody.parse(req.body);
    return { results: await need(deps.qloo, 'Qloo').search(body.query, body.kind) };
  });
  app.post('/api/recommend', async (req) => {
    const { look, preferences, entities, deselectedTagIds, ...constraints } = recommendBody.parse(
      req.body,
    );
    return recommend(
      {
        qloo: need(deps.qloo, 'Qloo'),
        translator: need(deps.translator, 'Gemini'),
        catalog: need(deps.catalog, 'The fragrance catalog'),
      },
      { look, preferences, constraints, entities, deselectedTagIds },
    );
  });
  return app;
}
