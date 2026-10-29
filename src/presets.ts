export type Preset = {
  id: string;
  title: string;
  look: string;
  budget?: number;
  gender: 'any' | 'masculine' | 'feminine' | 'unisex';
  avoid: string[];
  prefs: string;
  /** Two colours for the card, chosen to suggest the mood. */
  colors: [string, string];
};

/** Deliberately varied: seasons, formality, gender, budget and mood, so the demo shows range. */
export const PRESETS: Preset[] = [
  {
    id: 'rooftop',
    title: 'Rooftop leather',
    look: 'Boxy leather jacket, dark denim and boots, heading to a rooftop bar on a cool night.',
    budget: 120,
    gender: 'any',
    avoid: ['sweet'],
    prefs: '',
    colors: ['#2b1d17', '#8c5424'],
  },
  {
    id: 'amalfi',
    title: 'Linen on the coast',
    look: 'Loose linen shirt, white trousers and loafers, a long seaside lunch in the Amalfi sun.',
    budget: 250,
    gender: 'any',
    avoid: [],
    prefs: 'bright and airy',
    colors: ['#1d3a44', '#6ba1b5'],
  },
  {
    id: 'quiet',
    title: 'Quiet luxury',
    look: 'Camel cashmere coat, tailored trousers and a plain white tee, presenting to the board on Monday morning.',
    budget: 250,
    gender: 'any',
    avoid: [],
    prefs: 'understated, never loud',
    colors: ['#3a3128', '#b89b72'],
  },
  {
    id: 'festival',
    title: 'Desert festival',
    look: 'Flowy printed dress, suede boots and layered jewellery, a full day at a desert music festival in the heat.',
    budget: 120,
    gender: 'feminine',
    avoid: ['powdery'],
    prefs: '',
    colors: ['#5a2a1c', '#d9a05b'],
  },
  {
    id: 'street',
    title: 'Streetwear night',
    look: 'Oversized hoodie, chunky sneakers and a chain, a hip-hop show downtown with friends.',
    budget: 50,
    gender: 'masculine',
    avoid: ['floral'],
    prefs: 'fresh and energetic',
    colors: ['#1c1c24', '#6a5acd'],
  },
  {
    id: 'academia',
    title: 'Dark academia',
    look: 'Tweed blazer, black turtleneck and worn leather satchel, an old library on a rainy autumn evening.',
    gender: 'unisex',
    avoid: [],
    prefs: 'warm, bookish, a little smoky',
    colors: ['#241a14', '#6b4a2b'],
  },
  {
    id: 'wedding',
    title: 'Garden wedding',
    look: 'Pastel linen suit or midi dress, a garden wedding on a warm spring afternoon.',
    budget: 120,
    gender: 'any',
    avoid: ['smoky'],
    prefs: 'romantic but not heavy',
    colors: ['#4a2c3a', '#e3a6b5'],
  },
  {
    id: 'club',
    title: 'Sequins and bass',
    look: 'Sequin mini dress and platform heels, a packed club on a Saturday night.',
    budget: 120,
    gender: 'feminine',
    avoid: [],
    prefs: 'I want people to notice me from across the room',
    colors: ['#2a1138', '#d65db1'],
  },
  {
    id: 'cabin',
    title: 'Cabin weekend',
    look: 'Chunky wool sweater, flannel and hiking boots, a snowy cabin weekend by the fire.',
    budget: 120,
    gender: 'any',
    avoid: ['citrus'],
    prefs: 'cozy',
    colors: ['#1c2a22', '#8a6b3a'],
  },
];
