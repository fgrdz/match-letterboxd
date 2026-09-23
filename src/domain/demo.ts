import type { UserProfile, Movie } from './models';
const film = (
  slug: string,
  title: string,
  year: number,
  rating: Movie['rating'],
  genres: string[],
): Movie => ({
  slug,
  title,
  year,
  rating,
  genres,
  liked: rating === undefined ? undefined : rating >= 4,
});
const common = [
  film('whiplash-2014', 'Whiplash', 2014, 5, ['Drama', 'Music']),
  film('arrival-2016', 'Arrival', 2016, 4.5, ['Science Fiction', 'Drama']),
  film('parasite-2019', 'Parasite', 2019, 5, ['Thriller', 'Drama']),
  film('la-la-land', 'La La Land', 2016, 4.5, ['Romance', 'Music']),
  film('the-lighthouse-2019', 'The Lighthouse', 2019, 5, ['Horror']),
  film('inception', 'Inception', 2010, 4, ['Science Fiction', 'Thriller']),
];
const base = { warnings: [], fetchedAt: '2026-09-23T00:00:00Z' };
export const demoA: UserProfile = {
  ...base,
  username: 'alex-demo',
  displayName: 'Alex',
  movies: [
    ...common,
    film('perfect-days-2023', 'Perfect Days', 2023, 4.5, ['Drama']),
    film('past-lives', 'Past Lives', 2023, 5, ['Romance', 'Drama']),
  ],
  watchlist: [film('in-the-mood-for-love', 'In the Mood for Love', 2000, undefined, ['Romance'])],
};
export const demoB: UserProfile = {
  ...base,
  username: 'sam-demo',
  displayName: 'Sam',
  movies: [
    ...common.map((m, i) => ({ ...m, rating: ([4.5, 5, 5, 4, 1.5, 4.5] as const)[i] })),
    film('interstellar', 'Interstellar', 2014, 5, ['Science Fiction', 'Drama']),
    film('aftersun', 'Aftersun', 2022, 4.5, ['Drama']),
  ],
  watchlist: demoA.watchlist,
};
