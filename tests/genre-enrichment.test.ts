import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Movie, UserProfile } from '@/domain/models';
import { movieKey } from '@/domain/movieKey';
import { selectGenreSample } from '@/domain/match/genreSample';
import { enrichGenreSamples } from '@/services/tmdb/enrichGenreSamples';
import { enrichMovieGenres } from '@/services/tmdb/client';
vi.mock('@/services/tmdb/client', () => ({ enrichMovieGenres: vi.fn() }));
const profile = (username: string, count: number): UserProfile => ({
  username,
  warnings: [],
  fetchedAt: '',
  movies: Array.from({ length: count }, (_, i) => ({
    slug: `${username}-${i}`,
    title: `${username} ${i}`,
    year: 2000,
  })),
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('TMDB_GENRE_SAMPLE_SIZE', '10');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it('selects before resolving, never replaces missing films, and alternates the two profiles', async () => {
  const a = profile('a', 100),
    b = profile('b', 100);
  const expected = selectGenreSample(a.movies, 10, a.username).map(movieKey);
  vi.mocked(enrichMovieGenres).mockResolvedValue({});
  expect(await enrichGenreSamples(a, b)).toEqual([]);
  expect(a.genreSample?.movieKeys).toEqual(expected);
  expect(a.genreSample?.completed).toBe(true);
  expect(enrichMovieGenres).toHaveBeenCalledTimes(20);
  expect(vi.mocked(enrichMovieGenres).mock.calls[0][0].slug).toMatch(/^a-/);
  expect(vi.mocked(enrichMovieGenres).mock.calls[1][0].slug).toMatch(/^b-/);
});
it('resolves shared movies once, preserves ratings, and reuses already known genres', async () => {
  const a = profile('a', 10),
    b = structuredClone(a);
  a.movies[0].genres = ['Comedy'];
  b.movies[0].genres = ['Comedy'];
  a.movies[1].rating = 5;
  b.movies[1].rating = 1;
  vi.mocked(enrichMovieGenres).mockResolvedValue({ genres: ['Drama'] });
  await enrichGenreSamples(a, b);
  expect(enrichMovieGenres).toHaveBeenCalledTimes(9);
  expect(a.movies[1].rating).toBe(5);
  expect(b.movies[1].rating).toBe(1);
  expect(a.movies[1].genres).toEqual(['Drama']);
});
it('marks both selections interrupted on an upstream error without retrying every movie', async () => {
  vi.mocked(enrichMovieGenres).mockRejectedValue(new Error('outage'));
  const a = profile('a', 20),
    b = profile('b', 20);
  expect(await enrichGenreSamples(a, b)).toHaveLength(1);
  expect(enrichMovieGenres).toHaveBeenCalledTimes(1);
  expect(a.genreSample?.completed).toBe(false);
  expect(b.genreSample?.completed).toBe(false);
});
it('stops on its time budget and does not pretend that a truncated selection is complete', async () => {
  let now = 0;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  vi.stubEnv('TMDB_GENRE_TIME_BUDGET_MS', '1000');
  vi.mocked(enrichMovieGenres).mockImplementation(async () => {
    now += 1001;
    return { genres: ['Drama'] };
  });
  const a = profile('a', 20),
    b = profile('b', 20);
  expect(await enrichGenreSamples(a, b)).toHaveLength(1);
  expect(enrichMovieGenres).toHaveBeenCalledTimes(1);
  expect(a.genreSample?.completed).toBe(false);
});
it('supports a full census and does not skip films without a year when selecting', async () => {
  vi.stubEnv('TMDB_GENRE_SAMPLE_SIZE', '0');
  const a = profile('a', 20),
    b = profile('b', 20);
  a.movies[0].year = undefined;
  vi.mocked(enrichMovieGenres).mockImplementation(async (movie: Movie) =>
    movie.year ? { genres: ['Drama'] } : {},
  );
  await enrichGenreSamples(a, b);
  expect(a.genreSample?.movieKeys).toHaveLength(20);
  expect(a.genreSample?.movieKeys).toContain(movieKey(a.movies[0]));
  expect(a.movies[0].genres).toBeUndefined();
});
it('resolves highly rated common movies before the independent profile samples', async () => {
  vi.stubEnv('TMDB_GENRE_SAMPLE_SIZE', '2');
  vi.stubEnv('TMDB_GENRE_COMMON_LIMIT', '2');
  const a = profile('a', 10);
  const b = profile('b', 10);
  a.movies[0] = { slug: 'shared-best', title: 'Best', year: 2000, rating: 5 };
  b.movies[0] = { slug: 'shared-best', title: 'Best', year: 2000, rating: 5 };
  a.movies[1] = { slug: 'shared-low', title: 'Low', year: 2000, rating: 2 };
  b.movies[1] = { slug: 'shared-low', title: 'Low', year: 2000, rating: 3 };
  vi.mocked(enrichMovieGenres).mockResolvedValue({ genres: ['Drama'] });
  await enrichGenreSamples(a, b);
  expect(
    vi
      .mocked(enrichMovieGenres)
      .mock.calls.slice(0, 2)
      .map(([movie]) => movie.slug),
  ).toEqual(['shared-best', 'shared-low']);
  expect(a.genreSample?.movieKeys).toEqual(
    selectGenreSample(a.movies, 2, a.username).map(movieKey),
  );
});
