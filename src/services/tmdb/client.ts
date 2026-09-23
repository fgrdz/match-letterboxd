import 'server-only';
import type { Movie } from '@/domain/models';
import { posterKey } from '@/lib/posters/types';
import { MemoryCache } from '@/lib/cache/memory';
import { RequestQueue } from '@/lib/http/queue';
import type { TmdbMovie } from './types';
const cache = new MemoryCache<Partial<Movie> | null>(1000);
const failures = new MemoryCache<boolean>(1000);
const pending = new Map<string, Promise<Partial<Movie>>>();
const genreCache = new MemoryCache<Partial<Movie>>(5000);
const genrePending = new Map<string, Promise<Partial<Movie>>>();
const genreCatalog = new MemoryCache<Map<number, string>>(1);
const queue = new RequestQueue(250);
const normalize = (s: string) => s.normalize('NFKC').toLowerCase().trim();
async function request(path: string, params: Record<string, string> = {}): Promise<unknown> {
  return queue.run(async () => {
    const url = new URL(`https://api.themoviedb.org/3/${path}`);
    url.search = new URLSearchParams({
      ...params,
      api_key: process.env.TMDB_API_KEY!,
      language: 'en-US',
    }).toString();
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`TMDB status ${response.status}`);
    return response.json();
  });
}
function isMovie(value: unknown): value is TmdbMovie {
  return (
    !!value &&
    typeof value === 'object' &&
    'id' in value &&
    typeof value.id === 'number' &&
    'title' in value &&
    typeof value.title === 'string'
  );
}
function image(path: string | null | undefined, size: string) {
  return path && /^\/[a-zA-Z0-9._-]+$/.test(path)
    ? `https://image.tmdb.org/t/p/${size}${path}`
    : undefined;
}
export async function enrichMovie(movie: Movie): Promise<Partial<Movie>> {
  if (!process.env.TMDB_API_KEY) return {};
  const key = posterKey(movie);
  const cached = cache.get(key);
  if (cached !== undefined) return cached ?? {};
  if (failures.get(key)) throw new Error('TMDB temporarily unavailable');
  const existing = pending.get(key);
  if (existing) return existing;
  const task = fetchMetadata(movie, key)
    .catch(() => {
      failures.set(key, true, 30);
      throw new Error('TMDB temporarily unavailable');
    })
    .finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}
async function fetchMetadata(movie: Movie, key: string): Promise<Partial<Movie>> {
  let id = movie.tmdbId ?? genreCache.get(key)?.tmdbId;
  if (!id) {
    // No fuzzy first-result match: exact title + known year, and exactly one candidate.
    if (!movie.year) return {};
    const match = await findExactMovie(movie);
    if (!match) {
      cache.set(key, null, 3600);
      return {};
    }
    id = match.id;
  }
  const detail = await request(`movie/${id}`, { append_to_response: 'credits' });
  if (!isMovie(detail)) throw new Error('TMDB invalid response');
  const metadata: Partial<Movie> = {
    tmdbId: detail.id,
    posterUrl: image(detail.poster_path, 'w500'),
    backdropUrl: image(detail.backdrop_path, 'w1280'),
    genres: detail.genres?.map((g) => g.name),
    runtime: detail.runtime || undefined,
    releaseDate: detail.release_date || undefined,
    director: detail.credits?.crew.find((c) => c.job === 'Director')?.name,
    cast: detail.credits?.cast.slice(0, 5).map((c) => c.name),
  };
  cache.set(key, metadata, 86400);
  if (metadata.tmdbId) cache.set(posterKey({ ...movie, tmdbId: metadata.tmdbId }), metadata, 86400);
  return metadata;
}

async function findExactMovie(movie: Movie): Promise<TmdbMovie | undefined> {
  if (!movie.year) return undefined;
  const search = await request('search/movie', {
    query: movie.title,
    year: String(movie.year),
    include_adult: 'false',
  });
  if (
    !search ||
    typeof search !== 'object' ||
    !('results' in search) ||
    !Array.isArray(search.results)
  ) {
    throw new Error('TMDB invalid search response');
  }
  const matches = search.results
    .filter(isMovie)
    .filter(
      (candidate) =>
        [candidate.title, candidate.original_title ?? ''].some(
          (title) => normalize(title) === normalize(movie.title),
        ) && candidate.release_date?.startsWith(`${movie.year}-`),
    );
  return matches.length === 1 ? matches[0] : undefined;
}

async function getGenreCatalog() {
  const cached = genreCatalog.get('en-US');
  if (cached) return cached;
  const response = await request('genre/movie/list');
  if (
    !response ||
    typeof response !== 'object' ||
    !('genres' in response) ||
    !Array.isArray(response.genres)
  ) {
    throw new Error('TMDB invalid genre catalog');
  }
  const catalog = new Map<number, string>();
  for (const genre of response.genres) {
    if (
      !genre ||
      typeof genre !== 'object' ||
      typeof genre.id !== 'number' ||
      typeof genre.name !== 'string'
    ) {
      throw new Error('TMDB invalid genre');
    }
    catalog.set(genre.id, genre.name);
  }
  genreCatalog.set('en-US', catalog, 86400);
  return catalog;
}

/** Genre-only lookup: reuses full metadata, otherwise reads search genre IDs without credits/posters. */
export async function enrichMovieGenres(movie: Movie): Promise<Partial<Movie>> {
  if (movie.genres?.length) return { genres: movie.genres };
  if (!process.env.TMDB_API_KEY) return {};
  const key = posterKey(movie);
  const full = cache.get(key);
  if (full?.genres?.length) return { tmdbId: full.tmdbId, genres: full.genres };
  if (full === null) return {};
  const cached = genreCache.get(key);
  if (cached !== undefined) return structuredClone(cached);
  if (failures.get(key)) throw new Error('TMDB temporarily unavailable');
  const existing = genrePending.get(key);
  if (existing) return structuredClone(await existing);
  const task = fetchGenres(movie)
    .then((metadata) => {
      genreCache.set(key, metadata, metadata.genres?.length ? 86400 : 3600);
      if (metadata.tmdbId)
        genreCache.set(posterKey({ ...movie, tmdbId: metadata.tmdbId }), metadata, 86400);
      return metadata;
    })
    .catch(() => {
      failures.set(key, true, 30);
      throw new Error('TMDB temporarily unavailable');
    })
    .finally(() => genrePending.delete(key));
  genrePending.set(key, task);
  return structuredClone(await task);
}

async function fetchGenres(movie: Movie): Promise<Partial<Movie>> {
  if (movie.tmdbId) {
    const detail = await request(`movie/${movie.tmdbId}`);
    if (!isMovie(detail) || detail.id !== movie.tmdbId) throw new Error('TMDB invalid response');
    return { tmdbId: detail.id, genres: detail.genres?.map((genre) => genre.name) };
  }
  const match = await findExactMovie(movie);
  if (!match) return {};
  if (!match.genre_ids?.length) return { tmdbId: match.id };
  const catalog = await getGenreCatalog();
  const genres = match.genre_ids.map((id) => catalog.get(id));
  // Do not silently drop unknown genres and distort a movie's fractional vote.
  return {
    tmdbId: match.id,
    genres: genres.every((genre): genre is string => genre !== undefined) ? genres : undefined,
  };
}
