import type { Movie, UserProfile } from '../models';
import { movieKey, uniqueMovies } from '../movieKey';

export function analyzeGenres(
  movies: Movie[],
  sample?: UserProfile['genreSample'],
  partial = false,
) {
  const population = uniqueMovies(movies);
  const keys = sample ? new Set(sample.movieKeys) : undefined;
  const selected = keys ? population.filter((movie) => keys.has(movieKey(movie))) : population;
  const counts = new Map<string, number>();
  const ratings = new Map<string, { count: number; sum: number }>();
  let resolved = 0;
  for (const movie of selected) {
    const genres = [...new Set(movie.genres?.filter((genre) => genre.trim()) ?? [])];
    if (!genres.length) continue;
    resolved++;
    for (const genre of genres) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1 / genres.length);
      if (movie.rating !== undefined) {
        const entry = ratings.get(genre) ?? { count: 0, sum: 0 };
        ratings.set(genre, { count: entry.count + 1, sum: entry.sum + movie.rating });
      }
    }
  }
  const sampled = selected.length < population.length;
  const resolution = selected.length ? resolved / selected.length : 0;
  const completed = sample?.completed ?? true;
  const eligible = !partial && completed && resolution >= 0.8 && resolved >= (sampled ? 100 : 10);
  return {
    shares: new Map([...counts].map(([genre, count]) => [genre, count / resolved])),
    report: {
      population: population.length,
      selected: selected.length,
      resolved,
      missing: selected.length - resolved,
      coverage: population.length ? resolved / population.length : 0,
      resolution,
      sampled,
      completed,
      partial,
      eligible,
      complete: !partial && !sampled && resolved === population.length && population.length > 0,
      preferences: [...ratings]
        .filter(([, entry]) => entry.count >= 5)
        .map(([genre, entry]) => ({
          genre,
          count: entry.count,
          meanRating: entry.sum / entry.count,
        }))
        .sort(
          (a, b) =>
            b.meanRating - a.meanRating || b.count - a.count || a.genre.localeCompare(b.genre),
        ),
    },
  };
}
