import type { Movie } from '../models';
import { movieKey, uniqueMovies } from '../movieKey';

export function likesSimilarity(a: Movie[], b: Movie[]) {
  const indexB = new Map(uniqueMovies(b).map((movie) => [movieKey(movie), movie]));
  const sharedMovies: Movie[] = [];
  let union = 0;
  let comparable = 0;
  for (const movie of uniqueMovies(a)) {
    const other = indexB.get(movieKey(movie));
    if (movie.liked === undefined || other?.liked === undefined) continue;
    comparable++;
    if (movie.liked || other.liked) union++;
    if (movie.liked && other.liked) sharedMovies.push(movie);
  }
  return {
    similarity: union ? (100 * sharedMovies.length) / union : undefined,
    sharedMovies,
    comparable,
    union,
  };
}
