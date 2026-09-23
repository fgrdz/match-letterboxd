import { MemoryCache } from '@/lib/cache/memory';
import { posterKey, type PosterMovie, type PosterResult } from './types';
const cache = new MemoryCache<PosterResult>(1000);
const pending = new Map<string, Promise<PosterResult>>();
const waiting: (() => void)[] = [];
let active = 0;
async function scheduled<T>(task: () => Promise<T>): Promise<T> {
  if (active >= 2) await new Promise<void>((resolve) => waiting.push(resolve));
  else active++;
  try {
    return await task();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}
export function loadPoster(movie: PosterMovie): Promise<PosterResult> {
  const key = posterKey(movie);
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  const existing = pending.get(key);
  if (existing) return existing;
  const task = scheduled(async () => {
    try {
      const { slug, title, year, tmdbId, letterboxdId } = movie;
      const response = await fetch('/api/movie-poster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, title, year, tmdbId, letterboxdId }),
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) throw new Error('Poster unavailable');
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object' || !('posterUrl' in data))
        throw new Error('Invalid poster');
      const url = data.posterUrl;
      if (
        url !== null &&
        (typeof url !== 'string' ||
          !/^https:\/\/image\.tmdb\.org\/t\/p\/w500\/[a-zA-Z0-9._-]+$/.test(url))
      )
        throw new Error('Invalid poster');
      const result = { posterUrl: url };
      cache.set(key, result, url ? 86400 : 3600);
      return result;
    } catch {
      const result = { posterUrl: null };
      cache.set(key, result, 30);
      return result;
    }
  }).finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}
