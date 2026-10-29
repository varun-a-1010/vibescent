import assert from 'node:assert/strict';
import { createQloo } from '../server/qloo';

// Opt-in live check: resolve a few invented looks and print the style tags Qloo returns.
assert(process.env.QLOO_API_KEY, 'QLOO_API_KEY must be set (use npm run probe).');
let n = 0;
const qloo = createQloo({
  apiKey: process.env.QLOO_API_KEY,
  fetch: (i, init) => {
    assert(++n <= 30, 'request budget exhausted');
    return fetch(i, init);
  },
});
const looks: [string, ['person' | 'brand' | 'artist' | 'movie', string][]][] = [
  [
    'leather jacket, dark denim',
    [
      ['person', 'Zoë Kravitz'],
      ['brand', 'Saint Laurent'],
      ['artist', 'The Strokes'],
      ['movie', 'Drive'],
    ],
  ],
  [
    'linen coastal',
    [
      ['artist', 'Khruangbin'],
      ['brand', 'Loro Piana'],
    ],
  ],
];
for (const [label, seeds] of looks) {
  const ents = [];
  for (const [kind, name] of seeds) {
    const [e] = await qloo.search(name, kind);
    if (e) ents.push(e);
    else console.log('not found:', name);
  }
  const tags = await qloo.styleTags(ents.map((e) => e.entityId));
  console.log(
    `${label} [${ents.map((e) => e.name).join(', ')}] ->`,
    tags.map((t) => t.name).join(' | '),
  );
}
console.log('requests', n);
