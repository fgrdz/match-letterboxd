import type { Movie } from '@/domain/models';
import { movieKey } from '@/domain/movieKey';
export type PosterMovie = Pick<Movie, 'slug' | 'title' | 'year' | 'letterboxdId' | 'tmdbId'>;
export interface PosterResult {
  posterUrl: string | null;
}
// Include search inputs so an unrelated title cannot poison another film's cache entry.
export function posterKey(movie: PosterMovie): string {
  return JSON.stringify([movieKey(movie), movie.title, movie.year ?? null, movie.tmdbId ?? null]);
}
