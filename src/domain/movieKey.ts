import type { Movie } from './models';
const normalize = (value: string) => value.normalize('NFKC').trim().toLowerCase();
export function movieKey(movie: Movie): string {
  if (movie.letterboxdId) return `lb:${movie.letterboxdId.replace(/^film:/, '')}`;
  if (movie.slug) return `slug:${normalize(movie.slug).replace(/^\/+|\/+$/g, '')}`;
  if (movie.tmdbId) return `tmdb:${movie.tmdbId}`;
  return `title:${normalize(movie.title)}:${movie.year ?? 'unknown'}`;
}
export function uniqueMovies(movies: Movie[]): Movie[] {
  const map = new Map<string, Movie>();
  for (const movie of movies) {
    const key = movieKey(movie);
    const previous = map.get(key);
    map.set(
      key,
      previous
        ? {
            ...previous,
            ...movie,
            rating: movie.rating ?? previous.rating,
            liked: movie.liked ?? previous.liked,
          }
        : movie,
    );
  }
  return [...map.values()];
}
