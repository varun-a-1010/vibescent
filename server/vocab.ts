import { z } from 'zod';

/**
 * Controlled vocabulary the scent brief must stay inside. Fragologist owns the real
 * lists and serves them from GET /api/public/v1/vocab; this provisional copy lets the
 * brief schema and tests run before that endpoint exists. Never invent terms outside it.
 */
export const vocabSchema = z.object({
  accords: z.array(z.string()).min(1),
  families: z.array(z.string()).min(1),
  seasons: z.array(z.string()).min(1),
  occasions: z.array(z.string()).min(1),
  sillage: z.array(z.string()).min(1),
  longevity: z.array(z.string()).min(1),
  vibes: z.array(z.string()),
  notes: z.array(z.string()).default([]),
});
export type Vocab = z.infer<typeof vocabSchema>;

/** Enums observed in Fragologist's audit-2 data (2026-10-29); accords and vibes come from the API. */
export const PROVISIONAL_VOCAB: Vocab = {
  accords: [
    'leather',
    'woody',
    'smoky',
    'sweet',
    'fresh',
    'citrus',
    'floral',
    'musky',
    'amber',
    'powdery',
  ],
  families: ['fresh', 'floral', 'gourmand', 'amber', 'woody', 'fougere', 'leather', 'chypre'],
  seasons: ['spring', 'summer', 'fall', 'winter'],
  occasions: ['casual', 'evening', 'outdoor', 'office', 'cozy', 'formal', 'date', 'club'],
  sillage: ['skin-scent', 'intimate', 'moderate', 'room-filling', 'enormous'],
  longevity: ['fleeting', 'moderate', 'long', 'very-long'],
  vibes: [],
  notes: [],
};
