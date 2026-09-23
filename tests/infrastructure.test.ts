import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryCache } from '@/lib/cache/memory';
import { validateUsername } from '@/lib/validation/username';
import { letterboxdUrl, fetchLetterboxd } from '@/services/letterboxd/client';
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('input and SSRF protection', () => {
  it.each(['https://evil.com', '../admin', 'a/b', 'a?x=1', 'a#x', '', 'a'.repeat(41), 'a\\b'])(
    'rejects %s',
    (input) => expect(() => validateUsername(input)).toThrow(),
  );
  it('normalizes valid usernames', () => expect(validateUsername(' JULIO_1 ')).toBe('julio_1'));
  it.each([
    'https://evil.com/jack/',
    '//evil.com/jack/',
    'http://letterboxd.com/jack/',
    '/jack/films/?url=x',
    '/jack/films/page/0/',
  ])('rejects unsafe upstream paths: %s', (path) => expect(() => letterboxdUrl(path)).toThrow());
  it('allows only known public collection paths', () =>
    expect(letterboxdUrl('/jack/films/page/2/').href).toBe(
      'https://letterboxd.com/jack/films/page/2/',
    ));
});
describe('cache', () => {
  it('expires entries with TTL', () => {
    vi.useFakeTimers();
    const cache = new MemoryCache<number>();
    cache.set('a', 1, 10);
    expect(cache.get('a')).toBe(1);
    vi.advanceTimersByTime(10001);
    expect(cache.get('a')).toBeUndefined();
  });
  it('bounds memory usage', () => {
    const cache = new MemoryCache<number>(1);
    cache.set('a', 1, 60);
    cache.set('b', 2, 60);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
  });
});
it('does not retry an explicit upstream block', async () => {
  const mock = vi.fn().mockResolvedValue(new Response('Blocked', { status: 403 }));
  vi.stubGlobal('fetch', mock);
  await expect(fetchLetterboxd('/jack/films/')).rejects.toMatchObject({ code: 'blocked' });
  expect(mock).toHaveBeenCalledTimes(1);
});
