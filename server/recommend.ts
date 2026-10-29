import { toCatalogRequest, type Constraints } from './brief';
import type { Catalog, Recommendation } from './catalog';
import type { Entity, Qloo, StyleTag } from './qloo';
import type { Translator } from './translator';

export type RecommendInput = {
  look: string;
  preferences?: string;
  constraints: Constraints;
  /** Entities the user confirmed from the carousels (already resolved to Qloo ids). */
  entities: Entity[];
  /** Tag ids the user switched off after seeing the Qloo handoff. */
  deselectedTagIds?: string[];
};

export type RecommendResult = {
  /** Shown as the Qloo handoff panel so Qloo data is distinguishable from LLM interpretation. */
  qloo: { entities: Entity[]; tags: StyleTag[]; dropped: StyleTag[] };
  brief: Awaited<ReturnType<Translator['translate']>>;
  items: Recommendation[];
};

export const MIN_ENTITIES = 1;
export const MAX_ENTITIES = 5;

export async function recommend(
  deps: { qloo: Qloo; translator: Translator; catalog: Catalog },
  input: RecommendInput,
): Promise<RecommendResult> {
  if (input.entities.length < MIN_ENTITIES || input.entities.length > MAX_ENTITIES)
    throw new Error(`Choose between ${MIN_ENTITIES} and ${MAX_ENTITIES} cultural references.`);
  const [vocab, allTags] = await Promise.all([
    deps.catalog.vocab(),
    deps.qloo.styleTags(input.entities.map((e) => e.entityId)),
  ]);
  const off = new Set(input.deselectedTagIds ?? []);
  const tags = allTags.filter((t) => !off.has(t.id));
  const brief = await deps.translator.translate(
    {
      look: input.look,
      preferences: input.preferences ?? '',
      constraints: input.constraints,
      entities: input.entities,
      tags,
    },
    vocab,
  );
  // The catalog rejects unknown terms, so hard exclusions are checked against its vocabulary first.
  const known = (terms: string[], allowed: string[]) =>
    terms.filter((t) => allowed.includes(t.toLowerCase()));
  const constraints = {
    ...input.constraints,
    excludeAccords: known(input.constraints.excludeAccords, vocab.accords),
    excludeNotes: known(input.constraints.excludeNotes, vocab.notes),
  };
  const items = await deps.catalog.recommend(toCatalogRequest(brief, constraints));
  return {
    qloo: { entities: input.entities, tags, dropped: allTags.filter((t) => off.has(t.id)) },
    brief,
    items,
  };
}
