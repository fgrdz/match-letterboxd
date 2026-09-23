import type { Rating } from '../models';
import type { MovieComparison } from './types';

export interface CommonGenreOption {
  genre: string;
  movies: number;
  ratedByBoth: number;
}

function ratings(item: MovieComparison) {
  return [item.ratingA, item.ratingB].filter((rating): rating is Rating => rating !== undefined);
}

export function commonGenreOptions(items: MovieComparison[]): CommonGenreOption[] {
  const counts = new Map<string, { movies: number; ratedByBoth: number }>();
  for (const item of items) {
    if (!ratings(item).length) continue;
    for (const genre of new Set(item.movie.genres ?? [])) {
      const current = counts.get(genre) ?? { movies: 0, ratedByBoth: 0 };
      current.movies++;
      if (item.ratingA !== undefined && item.ratingB !== undefined) current.ratedByBoth++;
      counts.set(genre, current);
    }
  }
  return [...counts]
    .map(([genre, count]) => ({ genre, ...count }))
    .sort(
      (a, b) =>
        b.ratedByBoth - a.ratedByBoth || b.movies - a.movies || a.genre.localeCompare(b.genre),
    );
}

export function rankCommonMoviesByGenre(items: MovieComparison[], genre: string) {
  return items
    .filter((item) => new Set(item.movie.genres ?? []).has(genre) && ratings(item).length)
    .map((item) => {
      const values = ratings(item);
      return {
        ...item,
        average: values.reduce((sum, rating) => sum + rating, 0) / values.length,
        ratingsCount: values.length,
      };
    })
    .sort(
      (a, b) =>
        b.average - a.average ||
        b.ratingsCount - a.ratingsCount ||
        a.movie.title.localeCompare(b.movie.title),
    );
}
