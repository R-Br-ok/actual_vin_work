/**
 * Watch-party catalog — every title is a local MP4 served by Next.js from client/public/,
 * so playback works offline and on any LAN without external CDNs.
 * Posters are frames extracted from each clip (client/public/posters/).
 */

export const DEFAULT_VIDEO_URL = '/sample.mp4';

export const MOCK_MOVIES = [
  // Movie 1 — default for new rooms
  {
    id: 'hillside-pups',
    title: 'Hillside Pups',
    subtitle: 'Three dogs, one misty lawn, zero rules.',
    meta: 'Local · 0:32',
    year: 2024,
    duration: '0:32',
    genre: 'Animals',
    genres: ['Animals', 'Nature', 'Short'],
    category: 'Featured',
    rating: 'All',
    match: 'Room default',
    director: 'Home video',
    description:
      'A trio of dogs play tag across a terraced hillside garden under a soft mountain mist. Short, charming and perfect for a quick sync test.',
    image: '/posters/sample.jpg',
    videoUrl: '/sample.mp4',
    isHero: true,
  },
  // Movie 2
  {
    id: 'forest-stream',
    title: 'Forest Stream',
    subtitle: 'White water through a green canyon.',
    meta: 'Local · 0:58',
    year: 2024,
    duration: '0:58',
    genre: 'Nature',
    genres: ['Nature', 'Water', 'Ambient'],
    category: 'Nature',
    rating: 'All',
    match: 'Calm',
    director: 'Relaxing Tree',
    description:
      'A clear mountain stream tumbles over mossy boulders beneath a canopy of fresh spring leaves. A full minute of natural sound and motion.',
    image: '/posters/sample2.jpg',
    videoUrl: '/sample2.mp4',
  },
  // Movie 3
  {
    id: 'ember-sky',
    title: 'Ember Sky',
    subtitle: 'The sun goes down behind the pines.',
    meta: 'Local · 0:33',
    year: 2024,
    duration: '0:33',
    genre: 'Timelapse',
    genres: ['Timelapse', 'Sunset', 'Nature'],
    category: 'Sunsets',
    rating: 'All',
    match: 'Golden hour',
    director: 'Round the Clock',
    description:
      'Clouds catch fire as the sun sinks behind a line of silhouetted pines — a burning-orange timelapse of the last half hour of daylight.',
    image: '/posters/sample3.jpg',
    videoUrl: '/sample3.mp4',
  },
  // Movie 4
  {
    id: 'shoreline-sunset',
    title: 'Shoreline Sunset',
    subtitle: 'Waves, wet sand and a pink horizon.',
    meta: 'Local · 0:20',
    year: 2024,
    duration: '0:20',
    genre: 'Ambient',
    genres: ['Ambient', 'Sunset', 'Water'],
    category: 'Sunsets',
    rating: 'All',
    match: 'Quick loop',
    director: 'Motics',
    description:
      'Gentle waves roll onto a beach as the sun dips below heavy pink clouds. Twenty seconds — handy for testing queue auto-advance.',
    image: '/posters/sample4.jpg',
    videoUrl: '/sample4.mp4',
  },
];

export const DEFAULT_MOVIE = MOCK_MOVIES.find((m) => m.videoUrl === DEFAULT_VIDEO_URL);

export const CATEGORIES = ['All', ...Array.from(new Set(MOCK_MOVIES.map((m) => m.category)))];

export const GENRES = Array.from(new Set(MOCK_MOVIES.flatMap((m) => m.genres))).sort();

/** Finds catalog metadata for a URL (used to label custom / legacy room state). */
export function findMovieByUrl(url) {
  if (!url) return null;
  return MOCK_MOVIES.find((m) => m.videoUrl === url || (url.endsWith(m.videoUrl) && m.videoUrl.startsWith('/'))) || null;
}
