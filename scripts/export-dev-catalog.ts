// Read-only export of Fragologist's catalog + audit-2 wearing data into ignored .data/.
// Dev stand-in until Fragologist serves its keyed API. Never writes into Fragologist.
// Run: npm run export:catalog   (uses Fragologist's tsx so its TS data files load)
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.env.FRAGOLOGIST_DIR ?? `${process.env.HOME}/code/aux-apps/fragologist`;
const { fragrances } = await import(join(root, 'data/fragrances.ts'));
const { houses } = await import(join(root, 'data/houses.ts'));
const houseName = new Map<string, string>(
  houses.map((h: { id: string; name: string }) => [h.id, h.name]),
);
const audit = new Map<string, any>();
const dir = join(root, 'data/audit2');
for (const f of readdirSync(dir)) {
  const j = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  audit.set(j.id, j);
}
const rows = fragrances
  .filter((f: any) => !f.discontinued)
  .map((f: any) => {
    const a = audit.get(f.id);
    return {
      id: f.id,
      name: f.name,
      house: houseName.get(f.house_id) ?? f.house_id,
      house_id: f.house_id,
      concentration: f.concentration,
      gender:
        f.gender_marketed === 'for_men'
          ? 'masculine'
          : f.gender_marketed === 'for_women'
            ? 'feminine'
            : f.gender,
      price_usd: f.msrp_currency === 'USD' && f.msrp ? f.msrp : null,
      accords: f.accords ?? [],
      family: f.family,
      notes: [...f.notes.top, ...f.notes.heart, ...f.notes.base],
      rating: f.fragrantica_score ?? f.parfumo_score ?? null,
      votes: (f.fragrantica_votes ?? 0) + (f.parfumo_votes ?? 0),
      sillage: a?.performance?.sillage ?? null,
      longevity: a?.performance?.longevity ?? null,
      seasons: a?.wearing?.seasons ?? null,
      occasions: a?.wearing?.occasions ?? null,
    };
  });
mkdirSync('.data', { recursive: true });
writeFileSync('.data/catalog.json', JSON.stringify(rows));
console.log(
  rows.length,
  'fragrances,',
  rows.filter((r: any) => r.sillage).length,
  'with wearing profile,',
  rows.filter((r: any) => r.price_usd).length,
  'with USD price',
);
