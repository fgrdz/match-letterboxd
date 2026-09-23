import type { PosterMovie } from '@/lib/posters/types';
export function validatePosterMovie(value: unknown): PosterMovie | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  if (
    !('slug' in value) ||
    typeof value.slug !== 'string' ||
    !/^[a-z0-9_-]{1,250}$/.test(value.slug)
  )
    return undefined;
  if (
    !('title' in value) ||
    typeof value.title !== 'string' ||
    !value.title.trim() ||
    value.title.length > 300
  )
    return undefined;
  const year = 'year' in value ? value.year : undefined;
  const tmdbId = 'tmdbId' in value ? value.tmdbId : undefined;
  const letterboxdId = 'letterboxdId' in value ? value.letterboxdId : undefined;
  if (
    year !== undefined &&
    (typeof year !== 'number' || !Number.isInteger(year) || year < 1800 || year > 2200)
  )
    return undefined;
  if (
    tmdbId !== undefined &&
    (typeof tmdbId !== 'number' || !Number.isSafeInteger(tmdbId) || tmdbId <= 0)
  )
    return undefined;
  if (
    letterboxdId !== undefined &&
    (typeof letterboxdId !== 'string' || !/^\d{1,20}$/.test(letterboxdId))
  )
    return undefined;
  return { slug: value.slug, title: value.title, year, tmdbId, letterboxdId };
}
