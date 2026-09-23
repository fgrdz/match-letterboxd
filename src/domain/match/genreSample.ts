import type { Movie, Rating } from '../models';
import { movieKey, uniqueMovies } from '../movieKey';

/** Seeded Fisher–Yates over stable identities: independent of ratings, genres and input order. */
export function selectGenreSample(movies: Movie[], limit: number, seed: string): Movie[] {
  const selected = uniqueMovies(movies).sort((a, b) =>
    movieKey(a).localeCompare(movieKey(b), 'en'),
  );
  let state = 2166136261;
  for (const character of `genres-v1:${seed.toLowerCase()}`) {
    state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = selected.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [selected[i], selected[j]] = [selected[j], selected[i]];
  }
  return limit === 0 ? selected : selected.slice(0, Math.max(0, Math.floor(limit)));
}

/**
 * Common movies are resolved first for browsing. This list does not define the
 * genre distribution used by the score, so prioritization cannot bias it.
 */
export function selectCommonGenrePriority(a: Movie[], b: Movie[], limit: number): Movie[] {
  const indexB = new Map(uniqueMovies(b).map((movie) => [movieKey(movie), movie]));
  return uniqueMovies(a)
    .flatMap((movie) => {
      const other = indexB.get(movieKey(movie));
      if (!other) return [];
      const ratings = [movie.rating, other.rating].filter(
        (rating): rating is Rating => rating !== undefined,
      );
      return [
        {
          movie,
          ratedByBoth: ratings.length === 2,
          score: ratings.length
            ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
            : -1,
        },
      ];
    })
    .sort(
      (x, y) =>
        Number(y.ratedByBoth) - Number(x.ratedByBoth) ||
        y.score - x.score ||
        movieKey(x.movie).localeCompare(movieKey(y.movie), 'en'),
    )
    .slice(0, Math.max(0, Math.floor(limit)))
    .map(({ movie }) => movie);
}
