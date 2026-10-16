/**
 * Watch-party catalog. Every entry points at a direct, progressive MP4 that a plain
 * <video> element can stream (no HLS/DASH, no auth), so "Play Now" works instantly.
 */

const GTV = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample';

export const DEFAULT_VIDEO_URL = `${GTV}/BigBuckBunny.mp4`;

const poster = (id, width = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;

export const MOCK_MOVIES = [
  // Movie 1 — local fallback served by Next.js from client/public/sample.mp4 (works offline)
  {
    id: 'local-sample',
    title: 'Hillside Pups',
    subtitle: 'A local clip served straight from /public.',
    meta: 'Local file · 32s',
    year: 2024,
    duration: '0m 32s',
    genre: 'Nature',
    genres: ['Nature', 'Short'],
    category: 'Local',
    rating: 'All',
    match: 'Offline ready',
    director: 'Home video',
    description:
      'Three dogs play tag on a misty hillside lawn. Served from the Next.js public folder, so it plays even without internet access.',
    image: poster('photo-1553336972-e104649d0554'),
    videoUrl: '/sample.mp4',
  },
  // Movie 2 — default stream for new rooms
  {
    id: 'big-buck-bunny',
    title: 'Big Buck Bunny',
    subtitle: 'A gentle giant gets even.',
    meta: '2008 · 10m',
    year: 2008,
    duration: '9m 56s',
    genre: 'Animation',
    genres: ['Animation', 'Comedy'],
    category: 'Featured',
    rating: 'All',
    match: '98% match',
    director: 'Sacha Goedegebure',
    description:
      'A large, good-natured rabbit is pushed too far by three bullying rodents and plots an elaborate, slapstick revenge. Blender Foundation open movie.',
    image: poster('photo-1682685797229-b2930538da47', 1600),
    videoUrl: DEFAULT_VIDEO_URL,
    isHero: true,
  },
  // Movie 3
  {
    id: 'elephants-dream',
    title: 'Elephants Dream',
    subtitle: 'Inside the Machine, nothing is what it seems.',
    meta: '2006 · 11m',
    year: 2006,
    duration: '10m 53s',
    genre: 'Sci-fi',
    genres: ['Animation', 'Sci-fi'],
    category: 'Open Movies',
    rating: '7+',
    match: '93% match',
    director: 'Bassam Kurdali',
    description:
      'Two men explore a vast, surreal mechanical world — one sees wonders, the other sees only a machine. The first Blender open movie.',
    image: poster('photo-1599060052009-24d6d0b0161c'),
    videoUrl: `${GTV}/ElephantsDream.mp4`,
  },
  // Movie 4
  {
    id: 'tears-of-steel',
    title: 'Tears of Steel',
    subtitle: 'Saving the world, one memory at a time.',
    meta: '2012 · 12m',
    year: 2012,
    duration: '12m 14s',
    genre: 'Sci-fi',
    genres: ['Sci-fi', 'Action'],
    category: 'Open Movies',
    rating: '13+',
    match: '95% match',
    director: 'Ian Hubert',
    description:
      'In a future Amsterdam, a group of scientists stage a desperate last stand against robots by recreating a painful moment from the past.',
    image: poster('photo-1568801556940-e5b3a55fa6ea'),
    videoUrl: `${GTV}/TearsOfSteel.mp4`,
  },
  {
    id: 'sintel',
    title: 'Sintel',
    subtitle: 'A lonely search for a lost dragon.',
    meta: '2010 · 15m',
    year: 2010,
    duration: '14m 48s',
    genre: 'Fantasy',
    genres: ['Animation', 'Fantasy', 'Drama'],
    category: 'Open Movies',
    rating: '13+',
    match: '91% match',
    director: 'Colin Levy',
    description:
      'A young woman crosses frozen wastes and hostile cities to find the baby dragon she once rescued and raised.',
    image: poster('photo-1552117978-5818fbb674bc'),
    videoUrl: `${GTV}/Sintel.mp4`,
  },
  {
    id: 'for-bigger-blazes',
    title: 'For Bigger Blazes',
    subtitle: 'Fifteen seconds of big-screen colour.',
    meta: 'Short · 15s',
    year: 2013,
    duration: '0m 15s',
    genre: 'Short',
    genres: ['Short', 'Action'],
    category: 'Shorts',
    rating: 'All',
    match: 'Quick test',
    director: 'Google',
    description: 'A short promo reel — handy for testing the queue auto-advance when a video ends.',
    image: poster('photo-1671408932328-c481eb33c527'),
    videoUrl: `${GTV}/ForBiggerBlazes.mp4`,
  },
];

export const DEFAULT_MOVIE = MOCK_MOVIES.find((m) => m.videoUrl === DEFAULT_VIDEO_URL);

export const CATEGORIES = ['All', 'Featured', 'Open Movies', 'Shorts', 'Local'];

export const GENRES = Array.from(new Set(MOCK_MOVIES.flatMap((m) => m.genres))).sort();

/** Finds catalog metadata for a URL (used to label custom / legacy room state). */
export function findMovieByUrl(url) {
  if (!url) return null;
  return MOCK_MOVIES.find((m) => m.videoUrl === url || (url.endsWith(m.videoUrl) && m.videoUrl.startsWith('/'))) || null;
}
