import assert from 'node:assert/strict';
import { createQloo } from '../server/qloo';
import { createGeminiTranslator } from '../server/translator';
import { constraintsSchema } from '../server/brief';
import { PROVISIONAL_VOCAB } from '../server/vocab';

// Opt-in live check of Qloo tags -> Gemini scent brief (provisional vocabulary, no catalog).
const { QLOO_API_KEY, VERTEX_LLM_PROJECT_ID, VERTEX_LLM_SERVICE_ACCOUNT, VERTEX_LLM_REGION } =
  process.env;
assert(
  QLOO_API_KEY && VERTEX_LLM_PROJECT_ID && VERTEX_LLM_SERVICE_ACCOUNT,
  'Run via npm run probe:brief.',
);
const qloo = createQloo({ apiKey: QLOO_API_KEY });
const translator = createGeminiTranslator({
  project: VERTEX_LLM_PROJECT_ID,
  serviceAccount: VERTEX_LLM_SERVICE_ACCOUNT,
  location: VERTEX_LLM_REGION,
});
const vocab = {
  ...PROVISIONAL_VOCAB,
  vibes: ['rugged', 'polished', 'cozy', 'edgy', 'clean', 'romantic'],
};
const seeds: ['person' | 'brand' | 'artist' | 'movie', string][] = [
  ['person', 'Zoë Kravitz'],
  ['brand', 'Saint Laurent'],
  ['artist', 'The Strokes'],
  ['movie', 'Drive'],
];
const entities = [];
for (const [kind, name] of seeds) {
  const [e] = await qloo.search(name, kind);
  if (e) entities.push(e);
}
const tags = await qloo.styleTags(entities.map((e) => e.entityId));
const brief = await translator.translate(
  {
    look: 'Boxy leather jacket and dark denim, going to a rooftop bar on a cool night',
    preferences: 'nothing too sweet',
    constraints: constraintsSchema.parse({ budgetMaxUsd: 120 }),
    entities,
    tags,
  },
  vocab,
);
console.log(JSON.stringify(brief, null, 2));
