import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const movie = { slug: 'alien', title: 'Alien', year: 1979 };
const posterUrl = 'https://image.tmdb.org/t/p/w500/alien.jpg';
beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('deduplicates in-flight requests and caches successful results across sections', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ posterUrl }));
  vi.stubGlobal('fetch', fetch);
  const { loadPoster } = await import('@/lib/posters/client');
  const results = await Promise.all([loadPoster(movie), loadPoster(movie)]);
  expect(results).toEqual([{ posterUrl }, { posterUrl }]);
  await loadPoster(movie);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('limits concurrency to two even when a whole section is expanded', async () => {
  const releases: (() => void)[] = [];
  const fetch = vi.fn(
    () =>
      new Promise<Response>((resolve) =>
        releases.push(() => resolve(Response.json({ posterUrl }))),
      ),
  );
  vi.stubGlobal('fetch', fetch);
  const { loadPoster } = await import('@/lib/posters/client');
  const tasks = Array.from({ length: 7 }, (_, i) => loadPoster({ ...movie, slug: `film-${i}` }));
  expect(fetch).toHaveBeenCalledTimes(2);
  for (let i = 0; i < tasks.length; i++) {
    releases[i]();
    await tasks[i];
    expect(fetch.mock.calls.length).toBeLessThanOrEqual(i + 3);
  }
  await Promise.all(tasks);
  expect(fetch).toHaveBeenCalledTimes(7);
});
it('negative caches missing posters and briefly caches transient failures', async () => {
  vi.useFakeTimers();
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response('', { status: 503 }))
    .mockResolvedValueOnce(Response.json({ posterUrl: null }));
  vi.stubGlobal('fetch', fetch);
  const { loadPoster } = await import('@/lib/posters/client');
  expect(await loadPoster(movie)).toEqual({ posterUrl: null });
  await loadPoster(movie);
  expect(fetch).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(31000);
  await loadPoster(movie);
  vi.advanceTimersByTime(31000);
  await loadPoster(movie);
  expect(fetch).toHaveBeenCalledTimes(2);
});
it('refuses arbitrary image hosts', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json({ posterUrl: 'https://evil.test/image.jpg' })),
  );
  const { loadPoster } = await import('@/lib/posters/client');
  expect(await loadPoster(movie)).toEqual({ posterUrl: null });
});
