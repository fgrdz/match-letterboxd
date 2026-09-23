import type { Movie } from '../models';
import { movieKey } from '../movieKey';
import type { MovieRecommendation } from './types';
export function recommendations(
  a: Movie[],
  b: Movie[],
  partialA = false,
  partialB = false,
): MovieRecommendation[] {
  const keysA = new Set(a.map(movieKey)),
    keysB = new Set(b.map(movieKey));
  return [
    ...(!partialB
      ? a
          .filter((m) => (m.rating ?? 0) >= 4 && !keysB.has(movieKey(m)))
          .map((movie) => ({ movie, from: 'a' as const }))
      : []),
    ...(!partialA
      ? b
          .filter((m) => (m.rating ?? 0) >= 4 && !keysA.has(movieKey(m)))
          .map((movie) => ({ movie, from: 'b' as const }))
      : []),
  ].sort((x, y) => (y.movie.rating ?? 0) - (x.movie.rating ?? 0));
}
