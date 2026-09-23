import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { enrichMovie, enrichMovieGenres } from '@/services/tmdb/client';
beforeEach(() => {
  vi.stubEnv('TMDB_API_KEY', 'test-key');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('gets genres from exact search results, caches them and does not pollute full metadata cache', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        results: [{ id: 810, title: 'Genre Film', release_date: '2000-01-01', genre_ids: [18] }],
      }),
    )
    .mockResolvedValueOnce(Response.json({ genres: [{ id: 18, name: 'Drama' }] }))
    .mockResolvedValueOnce(
      Response.json({
        id: 810,
        title: 'Genre Film',
        genres: [{ id: 18, name: 'Drama' }],
        poster_path: '/genre.jpg',
      }),
    );
  vi.stubGlobal('fetch', fetch);
  const movie = { slug: 'genre-film', title: 'Genre Film', year: 2000 };
  expect(await enrichMovieGenres(movie)).toEqual({ tmdbId: 810, genres: ['Drama'] });
  await enrichMovieGenres(movie);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect((await enrichMovie(movie)).posterUrl).toBe('https://image.tmdb.org/t/p/w500/genre.jpg');
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(String(fetch.mock.calls[2][0])).toContain('/movie/810');
});
it('reuses cached full metadata without any additional genre request', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      Response.json({ id: 811, title: 'Full', genres: [{ id: 18, name: 'Drama' }] }),
    );
  vi.stubGlobal('fetch', fetch);
  const movie = { slug: 'full', title: 'Full', tmdbId: 811 };
  await enrichMovie(movie);
  expect((await enrichMovieGenres(movie)).genres).toEqual(['Drama']);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('coalesces genre requests and uses direct TMDB IDs without credits', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      Response.json({ id: 812, title: 'Shared', genres: [{ id: 18, name: 'Drama' }] }),
    );
  vi.stubGlobal('fetch', fetch);
  const movie = { slug: 'shared-genre', title: 'Shared', tmdbId: 812 };
  const results = await Promise.all([enrichMovieGenres(movie), enrichMovieGenres(movie)]);
  expect(results[0]).toEqual(results[1]);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(String(fetch.mock.calls[0][0])).not.toContain('credits');
});
it('does not guess among ambiguous movies and caches misses', async () => {
  const fetch = vi.fn().mockResolvedValue(
    Response.json({
      results: [
        { id: 813, title: 'Ambiguous Genre', release_date: '2000-01-01', genre_ids: [18] },
        { id: 814, title: 'Ambiguous Genre', release_date: '2000-01-01', genre_ids: [18] },
      ],
    }),
  );
  vi.stubGlobal('fetch', fetch);
  const movie = { slug: 'ambiguous-genre', title: 'Ambiguous Genre', year: 2000 };
  expect(await enrichMovieGenres(movie)).toEqual({});
  expect(await enrichMovieGenres(movie)).toEqual({});
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('does not make requests without a key, without a known year, or with genres already present', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  expect(await enrichMovieGenres({ slug: 'missing-year', title: 'Missing year' })).toEqual({});
  vi.stubEnv('TMDB_API_KEY', '');
  expect(await enrichMovieGenres({ slug: 'no-key', title: 'No key', year: 2000 })).toEqual({});
  expect(await enrichMovieGenres({ slug: 'known', title: 'Known', genres: ['Drama'] })).toEqual({
    genres: ['Drama'],
  });
  expect(fetch).not.toHaveBeenCalled();
});
it('caches failures briefly instead of repeatedly hitting the upstream', async () => {
  const fetch = vi.fn().mockRejectedValue(new Error('network'));
  vi.stubGlobal('fetch', fetch);
  const movie = { slug: 'failed-genre', title: 'Failed', tmdbId: 815 };
  await expect(enrichMovieGenres(movie)).rejects.toThrow();
  await expect(enrichMovieGenres(movie)).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1);
});
