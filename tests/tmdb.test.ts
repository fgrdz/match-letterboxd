import { afterEach, expect, it, vi } from 'vitest';
import { enrichMovie } from '@/services/tmdb/client';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it('does not call the network without a server-side key', async () => {
  vi.stubEnv('TMDB_API_KEY', '');
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  expect(await enrichMovie({ slug: 'none', title: 'None', year: 2000 })).toEqual({});
  expect(fetch).not.toHaveBeenCalled();
});
it('only enriches an unambiguous exact title/year match and caches it', async () => {
  vi.stubEnv('TMDB_API_KEY', 'test-secret');
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ results: [{ id: 10, title: 'Example', release_date: '2001-02-03' }] }),
    )
    .mockResolvedValueOnce(
      Response.json({
        id: 10,
        title: 'Example',
        genres: [{ id: 1, name: 'Drama' }],
        poster_path: '/poster.jpg',
        runtime: 99,
        credits: { crew: [{ job: 'Director', name: 'Someone' }], cast: [] },
      }),
    );
  vi.stubGlobal('fetch', fetch);
  const movie = { slug: 'example', title: 'Example', year: 2001 };
  expect(await enrichMovie(movie)).toMatchObject({
    tmdbId: 10,
    genres: ['Drama'],
    director: 'Someone',
    runtime: 99,
    posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
  });
  await enrichMovie(movie);
  expect(fetch).toHaveBeenCalledTimes(2);
});
it('does not guess between ambiguous results', async () => {
  vi.stubEnv('TMDB_API_KEY', 'test-secret');
  const fetch = vi.fn().mockResolvedValue(
    Response.json({
      results: [
        { id: 11, title: 'Ambiguous', release_date: '2001-01-01' },
        { id: 12, title: 'Ambiguous', release_date: '2001-02-01' },
      ],
    }),
  );
  vi.stubGlobal('fetch', fetch);
  expect(await enrichMovie({ slug: 'ambiguous', title: 'Ambiguous', year: 2001 })).toEqual({});
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('coalesces simultaneous enrichment for the same movie', async () => {
  vi.stubEnv('TMDB_API_KEY', 'test-secret');
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ id: 73, title: 'Shared', poster_path: '/shared.jpg' }));
  vi.stubGlobal('fetch', fetch);
  const movie = { slug: 'shared', title: 'Shared', tmdbId: 73 };
  const [a, b] = await Promise.all([enrichMovie(movie), enrichMovie(movie)]);
  expect(a.posterUrl).toBe('https://image.tmdb.org/t/p/w500/shared.jpg');
  expect(b).toEqual(a);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('keeps search inputs isolated even when a caller reuses another movie identity', async () => {
  vi.stubEnv('TMDB_API_KEY', 'test-secret');
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ id: 74, title: 'Original', poster_path: '/original.jpg' }),
    )
    .mockResolvedValueOnce(Response.json({ id: 75, title: 'Other', poster_path: '/other.jpg' }));
  vi.stubGlobal('fetch', fetch);
  const first = await enrichMovie({ slug: 'same-slug', title: 'Original', tmdbId: 74 });
  const second = await enrichMovie({ slug: 'same-slug', title: 'Other', tmdbId: 75 });
  expect(first.posterUrl).not.toBe(second.posterUrl);
  expect(fetch).toHaveBeenCalledTimes(2);
});
it('temporarily caches failures to prevent repeated upstream calls across cards', async () => {
  vi.stubEnv('TMDB_API_KEY', 'test-secret');
  const fetch = vi.fn().mockRejectedValue(new Error('network'));
  vi.stubGlobal('fetch', fetch);
  const movie = { slug: 'failed', title: 'Failed', tmdbId: 76 };
  await expect(enrichMovie(movie)).rejects.toThrow('temporarily unavailable');
  await expect(enrichMovie(movie)).rejects.toThrow('temporarily unavailable');
  expect(fetch).toHaveBeenCalledTimes(1);
});
