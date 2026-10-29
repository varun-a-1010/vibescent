import { readFileSync } from 'node:fs';
import type { Catalog, Recommendation } from './catalog';
import type { CatalogRequest } from './brief';
import type { Vocab } from './vocab';

export type DevRow = {
  id: string;
  name: string;
  house: string;
  house_id: string;
  concentration: string | null;
  gender: 'masculine' | 'feminine' | 'unisex';
  price_usd: number | null;
  accords: { name: string; weight: number }[];
  family: string;
  notes: string[];
  rating: number | null;
  votes: number;
  sillage: string | null;
  longevity: string | null;
  seasons: Record<string, number> | null;
  occasions: string[] | null;
};

const MIN_VOTES = 100;
const MAX_PER_HOUSE = 2;
const EXCLUDE_ACCORD_WEIGHT = 0.3;
const lower = (s: string) => s.toLowerCase();

/**
 * Local stand-in for Fragologist's keyed service, built from a read-only export
 * (scripts/export-dev-catalog.ts). Same Catalog interface, so the app is unchanged
 * when the real endpoint ships. Vibes are not in the export, so they are ignored.
 */
export function createDevCatalog(rows: DevRow[]): Catalog {
  const sorted = (xs: Iterable<string>) => [...new Set(xs)].sort();
  const vocab: Vocab = {
    accords: sorted(rows.flatMap((r) => r.accords.map((a) => a.name))),
    families: sorted(rows.map((r) => r.family)),
    seasons: ['spring', 'summer', 'fall', 'winter'],
    occasions: sorted(rows.flatMap((r) => r.occasions ?? [])),
    sillage: sorted(rows.flatMap((r) => (r.sillage ? [r.sillage] : []))),
    longevity: sorted(rows.flatMap((r) => (r.longevity ? [r.longevity] : []))),
    vibes: [],
  };
  return {
    async vocab() {
      return vocab;
    },
    async recommend(req: CatalogRequest) {
      return rank(rows, req);
    },
  };
}

export function loadDevCatalog(path = '.data/catalog.json'): Catalog {
  return createDevCatalog(JSON.parse(readFileSync(path, 'utf8')));
}

export function rank(rows: DevRow[], req: CatalogRequest): Recommendation[] {
  const banAccords = new Set(req.exclude_accords.map(lower));
  const banNotes = req.exclude_notes.map(lower);
  const scored: { row: DevRow; score: number; reasons: string[] }[] = [];
  for (const r of rows) {
    if (r.votes < MIN_VOTES) continue;
    if (req.gender !== 'any' && r.gender !== req.gender && r.gender !== 'unisex') continue;
    if (
      req.budget_max_usd !== undefined &&
      r.price_usd !== null &&
      r.price_usd > req.budget_max_usd
    )
      continue;
    if (r.accords.some((a) => a.weight >= EXCLUDE_ACCORD_WEIGHT && banAccords.has(lower(a.name))))
      continue;
    if (banNotes.length && r.notes.some((n) => banNotes.some((b) => lower(n).includes(b))))
      continue;
    let score = 0;
    const reasons: string[] = [];
    for (const want of req.want_accords) {
      const have = r.accords.find((a) => a.name === want.name);
      if (have) {
        score += want.weight * have.weight;
        if (have.weight >= 0.5) reasons.push(`${want.name} accord`);
      }
    }
    if (req.families.includes(r.family)) {
      score += 0.3;
      reasons.push(`${r.family} family`);
    }
    const profiled = r.sillage !== null;
    if (profiled) {
      const fit = (ok: boolean, label: string, weight: number) => {
        if (ok) {
          score += weight;
          reasons.push(label);
        }
      };
      if (req.sillage.length)
        fit(req.sillage.includes(r.sillage!), `${r.sillage} projection`, 0.25);
      if (req.longevity.length && r.longevity)
        fit(req.longevity.includes(r.longevity), `${r.longevity} longevity`, 0.2);
      const season = req.seasons.map((s) => (r.seasons?.[s] ?? 0) / 3);
      if (season.length) {
        const avg = season.reduce((a, b) => a + b, 0) / season.length;
        score += 0.3 * avg;
        if (avg >= 0.6) reasons.push(`suits ${req.seasons.join('/')}`);
      }
      const occ = req.occasions.filter((o) => r.occasions?.includes(o));
      if (occ.length) {
        score += 0.25 * (occ.length / req.occasions.length);
        reasons.push(`good for ${occ.join(', ')}`);
      }
    }
    // Popular, well-rated fragrances break ties; never outweigh a real match.
    score += 0.05 * ((r.rating ?? 6) / 10) + 0.02 * Math.min(1, Math.log10(r.votes + 1) / 4);
    if (req.budget_max_usd !== undefined && r.price_usd === null) {
      score -= 0.05;
      reasons.push('price not confirmed');
    }
    if (reasons.length) scored.push({ row: r, score, reasons });
  }
  scored.sort((a, b) => b.score - a.score || a.row.id.localeCompare(b.row.id));
  const perHouse = new Map<string, number>();
  const out: Recommendation[] = [];
  for (const s of scored) {
    const n = perHouse.get(s.row.house_id) ?? 0;
    if (n >= MAX_PER_HOUSE) continue;
    perHouse.set(s.row.house_id, n + 1);
    out.push({
      id: s.row.id,
      name: s.row.name,
      house: s.row.house,
      concentration: s.row.concentration,
      price_usd: s.row.price_usd,
      accords: s.row.accords.slice(0, 5).map((a) => a.name),
      sillage: s.row.sillage,
      longevity: s.row.longevity,
      has_wearing_profile: s.row.sillage !== null,
      match_reasons: s.reasons,
      public_url: null,
    });
    if (out.length >= Math.min(req.limit, 50)) break;
  }
  return out;
}
