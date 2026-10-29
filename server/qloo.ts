import { z } from 'zod';

export const QLOO_ORIGIN = 'https://hackathon.api.qloo.com';
/** Primary anchor categories shown as carousels; the rest only when the user names them. */
export const PRIMARY_KINDS = [
  'person',
  'brand',
  'artist',
  'movie',
  'tv_show',
  'destination',
] as const;
export const SECONDARY_KINDS = ['place', 'book', 'podcast', 'video_game'] as const;
export type Kind = (typeof PRIMARY_KINDS)[number] | (typeof SECONDARY_KINDS)[number];
export type Entity = { entityId: string; name: string; kind: Kind };
export type StyleTag = { id: string; name: string };
/** The only tag namespace verified to give clean style descriptors; others were noisy. */
export const STYLE_NAMESPACES = ['urn:tag:aesthetic_property:qloo'];

export interface Qloo {
  search(query: string, kind: Kind): Promise<Entity[]>;
  /** Describing tags for a set of confirmed entities (taste analysis), style namespaces only. */
  styleTags(entityIds: string[], take?: number): Promise<StyleTag[]>;
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

export function parseTags(raw: unknown): StyleTag[] {
  const seen = new Set<string>();
  return array(raw).flatMap((t) => {
    const r = record(t);
    const name = text(r.name, 60);
    const id = text(r.tag_id ?? r.id, 200);
    if (!name || !id || seen.has(id)) return [];
    seen.add(id);
    return [{ id, name }];
  });
}

/** Read-only client: one origin, no redirects, bounded time and bytes, no retries. */
export function createQloo(
  options: { apiKey: string; fetch?: typeof fetch; timeoutMs?: number } = { apiKey: '' },
): Qloo {
  const key = options.apiKey.trim();
  if (!key) throw new Error('QLOO_API_KEY is required.');
  async function get(path: string, params: Record<string, string>) {
    const url = new URL(path, QLOO_ORIGIN);
    url.search = new URLSearchParams(params).toString();
    const response = await (options.fetch ?? fetch)(url, {
      headers: { 'X-Api-Key': key, Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
    });
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
    async styleTags(entityIds, take = 12) {
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
      const data = await get('/v2/insights', {
        'filter.type': 'urn:tag',
        'signal.interests.entities': ids.join(','),
        'filter.tag.types': STYLE_NAMESPACES.join(','),
        take: String(take),
      });
      return parseTags(record(data.results).tags);
    },
  };
}
