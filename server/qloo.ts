import { z } from 'zod';

export const QLOO_ORIGIN = 'https://hackathon.api.qloo.com';
/** Primary anchor categories shown as carousels; the rest only when the user names them. */
export const PRIMARY_KINDS = ['person', 'brand', 'artist', 'movie', 'tv_show'] as const;
export const SECONDARY_KINDS = ['place', 'book', 'podcast', 'video_game'] as const;
export type Kind = (typeof PRIMARY_KINDS)[number] | (typeof SECONDARY_KINDS)[number];
export type Entity = { entityId: string; name: string; kind: Kind };
export type StyleTag = { id: string; name: string; group: string };
/**
 * Tag namespaces used as style evidence (checked live 2026-10-29). `aesthetic_property` alone was
 * mostly silhouette words, so personal style and emotional tone lead and it is capped.
 */
export const STYLE_NAMESPACES = [
  { type: 'urn:tag:personal_style:qloo', group: 'Style', take: 8 },
  { type: 'urn:tag:emotional_tone:qloo', group: 'Mood', take: 6 },
  { type: 'urn:tag:aesthetic_property:qloo', group: 'Look', take: 6 },
  { type: 'urn:tag:ambience:qloo', group: 'Setting', take: 4 },
] as const;
const MAX_SILHOUETTE_TAGS = 1;

export interface Qloo {
  search(query: string, kind: Kind): Promise<Entity[]>;
  /** Describing tags for a set of confirmed entities (taste analysis), style namespaces only. */
  styleTags(entityIds: string[]): Promise<StyleTag[]>;
}

const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const array = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const text = (v: unknown, length = 200) => (typeof v === 'string' ? v.slice(0, length) : '');
const uuid = z.string().uuid();

export function parseEntity(raw: unknown, kind: Kind): Entity | null {
  const r = record(raw);
  if (
    !uuid.safeParse(r.entity_id).success ||
    !text(r.name) ||
    ![...array(r.types), r.subtype].includes(`urn:entity:${kind}`)
  )
    return null;
  return { entityId: String(r.entity_id).toUpperCase(), name: text(r.name), kind };
}

export function parseTags(raw: unknown, group = ''): StyleTag[] {
  const seen = new Set<string>();
  return array(raw).flatMap((t) => {
    const r = record(t);
    const name = text(r.name, 60);
    const id = text(r.tag_id ?? r.id, 200);
    if (!name || !id || seen.has(id)) return [];
    seen.add(id);
    return [{ id, name, group }];
  });
}

const wait = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));
const MAX_ATTEMPTS = 4;

/**
 * Read-only client: one origin, no redirects, bounded time and bytes. A look asks for dozens of
 * names at once and Qloo rate-limits bursts, so calls share a pace and retry instead of vanishing.
 */
export function createQloo(
  options: {
    apiKey: string;
    fetch?: typeof fetch;
    timeoutMs?: number;
    paceMs?: number;
    retryMs?: number;
  } = { apiKey: '' },
): Qloo {
  const key = options.apiKey.trim();
  if (!key) throw new Error('QLOO_API_KEY is required.');
  const paceMs = options.paceMs ?? 110;
  const retryMs = options.retryMs ?? 400;
  let nextSlot = 0;
  async function turn() {
    const now = Date.now();
    const start = Math.max(now, nextSlot);
    nextSlot = start + paceMs;
    if (start > now) await wait(start - now);
  }
  async function send(url: URL) {
    for (let attempt = 1; ; attempt++) {
      await turn();
      const response = await (options.fetch ?? fetch)(url, {
        headers: { 'X-Api-Key': key, Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
      });
      const busy = response.status === 429 || response.status >= 500;
      if (!busy || attempt === MAX_ATTEMPTS) return response;
      await wait(retryMs * 2 ** (attempt - 1));
    }
  }
  async function get(path: string, params: Record<string, string>) {
    const url = new URL(path, QLOO_ORIGIN);
    url.search = new URLSearchParams(params).toString();
    const response = await send(url);
    if (response.status === 404 && path === '/search') return { results: [] };
    if (!response.ok) throw new Error(`Qloo ${path} returned HTTP ${response.status}`);
    const body = await response.text();
    if (body.length > 2_000_000) throw new Error('Oversized body');
    const data = record(JSON.parse(body));
    if (data.success === false || !('results' in data)) throw new Error('Unexpected response');
    return data;
  }
  return {
    async search(query, kind) {
      const q = query.trim().slice(0, 100);
      if (!q) return [];
      const data = await get('/search', { query: q, types: `urn:entity:${kind}`, take: '5' });
      return array(data.results)
        .map((r) => parseEntity(r, kind))
        .filter((e): e is Entity => e !== null);
    },
    async styleTags(entityIds) {
      const ids = [
        ...new Set(
          z
            .array(uuid)
            .min(1)
            .max(10)
            .parse(entityIds)
            .map((s) => s.toUpperCase()),
        ),
      ];
      const groups = await Promise.all(
        STYLE_NAMESPACES.map(async (ns) => {
          try {
            const data = await get('/v2/insights', {
              'filter.type': 'urn:tag',
              'signal.interests.entities': ids.join(','),
              'filter.tag.types': ns.type,
              take: String(ns.take + 6),
            });
            return limitSilhouettes(parseTags(record(data.results).tags, ns.group)).slice(
              0,
              ns.take,
            );
          } catch {
            return []; // one namespace failing should not lose the others
          }
        }),
      );
      const seen = new Set<string>();
      return groups.flat().filter((t) => {
        const key = t.name.toLowerCase();
        return seen.has(key) ? false : (seen.add(key), true);
      });
    },
  };
}

/** Silhouette variants dominate the look namespace and say little; keep one. */
export function limitSilhouettes(tags: StyleTag[]): StyleTag[] {
  let kept = 0;
  return tags.filter((t) => !/silhouette/i.test(t.name) || ++kept <= MAX_SILHOUETTE_TAGS);
}
