import type { BandmateDef, GenreDef } from './schema';

export const BANDMATES: BandmateDef[] = [
  { id: 'mira', name: 'Mira', instrument: 'vocals', wants: 'recognition', fears: 'selling out' },
  { id: 'theo', name: 'Theo', instrument: 'drums', wants: 'rest', fears: 'burning out again' },
  { id: 'jun', name: 'Jun', instrument: 'guitar/production', wants: 'sonic experimentation', fears: 'creative stagnation' },
  { id: 'rowan', name: 'Rowan', instrument: 'bass', wants: 'to be seen', fears: 'being replaceable' },
];

export const GENRES: GenreDef[] = [
  { id: 'dream_pop', label: 'Dream Pop' },
  { id: 'indie_rock', label: 'Indie Rock' },
  { id: 'electronic', label: 'Electronic' },
  { id: 'folk', label: 'Folk' },
];

export const WHY_TOUR_BEATS: string[] = [
  'One last shot before day jobs win.',
  'A label finally said yes.',
  'A promise made at a funeral.',
  'Nothing left to lose at home.',
];
