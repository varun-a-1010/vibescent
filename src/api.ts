export type Kind =
  | 'person'
  | 'brand'
  | 'artist'
  | 'movie'
  | 'tv_show'
  | 'destination'
  | 'place'
  | 'book'
  | 'podcast'
  | 'video_game';
export type Entity = { entityId: string; name: string; kind: Kind };
export type Tag = { id: string; name: string };
export type Suggestion = {
  summary: string;
  followUp: string | null;
  carousels: Partial<Record<Kind, Entity[]>>;
};
export type Item = {
  id: string;
  name: string;
  house: string;
  concentration?: string | null;
  price_usd?: number | null;
  accords: string[];
  sillage?: string | null;
  longevity?: string | null;
  has_wearing_profile: boolean;
  match_reasons: string[];
  public_url?: string | null;
};
export type Brief = {
  wantAccords: { name: string; weight: number }[];
  families: string[];
  seasons: string[];
  occasions: string[];
  vibes: string[];
  sillage: string[];
  longevity: string[];
  because: { cue: string; effect: string }[];
};
export type Result = {
  qloo: { entities: Entity[]; tags: Tag[]; dropped: Tag[] };
  brief: Brief;
  items: Item[];
};
export type Status = { qloo: boolean; gemini: boolean; catalog: string | null };
export type Photo = { mimeType: 'image/jpeg'; data: string };

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(
    path,
    body === undefined
      ? undefined
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong.');
  return data as T;
}
export const api = {
  status: () => call<Status>('/api/status'),
  suggest: (text: string, image?: Photo) => call<Suggestion>('/api/suggest', { text, image }),
  search: (query: string, kind: Kind) =>
    call<{ results: Entity[] }>('/api/entities/search', { query, kind }),
  recommend: (body: unknown) => call<Result>('/api/recommend', body),
};

/** Downscale to keep the upload small; the photo is only sent to Gemini and never stored. */
export async function toPhoto(file: File): Promise<Photo> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL('image/jpeg', 0.85);
  return { mimeType: 'image/jpeg', data: url.slice(url.indexOf(',') + 1) };
}
