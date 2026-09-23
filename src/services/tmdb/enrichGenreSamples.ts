import 'server-only';
import type { Movie, UserProfile } from '@/domain/models';
import { movieKey } from '@/domain/movieKey';
import { selectCommonGenrePriority, selectGenreSample } from '@/domain/match/genreSample';
import { envNumber } from '@/lib/config';
import { enrichMovieGenres } from './client';

/** Select first, then resolve. Missing films remain in the denominator; no replacement sampling. */
export async function enrichGenreSamples(a: UserProfile, b: UserProfile): Promise<string[]> {
  const limit = envNumber('TMDB_GENRE_SAMPLE_SIZE', 300, 0, 2000);
  const commonLimit = envNumber('TMDB_GENRE_COMMON_LIMIT', 300, 0, 2000);
  const samples = [a, b].map((profile) =>
    selectGenreSample(profile.movies, limit, profile.username),
  );
  const common = selectCommonGenrePriority(a.movies, b.movies, commonLimit);
  [a, b].forEach((profile, i) => {
    profile.genreSample = { movieKeys: samples[i].map(movieKey), completed: false };
  });
  const started = Date.now();
  const budget = envNumber('TMDB_GENRE_TIME_BUDGET_MS', 240000, 1000, 900000);
  const resolved = new Map<string, Partial<Movie>>();
  const filmsByKey = new Map<string, Movie[]>();
  for (const profile of [a, b])
    for (const movie of profile.movies) {
      const key = movieKey(movie);
      filmsByKey.set(key, [...(filmsByKey.get(key) ?? []), movie]);
    }
  let interrupted = false;
  const attempted = new Set<string>();
  const resolve = async (movie: Movie) => {
    const key = movieKey(movie);
    if (attempted.has(key)) return;
    attempted.add(key);
    if (movie.genres?.length) return;
    if (Date.now() - started >= budget) {
      interrupted = true;
      return;
    }
    try {
      const metadata = resolved.get(key) ?? (await enrichMovieGenres(movie));
      resolved.set(key, metadata);
      if (metadata.genres?.length) {
        movie.genres = metadata.genres;
        for (const item of filmsByKey.get(key) ?? []) item.genres = metadata.genres;
      }
    } catch {
      console.warn('[tmdb] genre sample interrupted');
      interrupted = true;
    }
  };

  // Common films power the genre filter and are useful to both people. They
  // are resolved first but only count in a profile distribution if the
  // independent sample selected them.
  for (const movie of common) {
    await resolve(movie);
    if (interrupted) break;
  }
  // Interleave profiles so a time limit cannot spend the entire budget on only one person.
  for (let i = 0; !interrupted && i < Math.max(...samples.map((sample) => sample.length)); i++) {
    for (const sample of samples) {
      const movie = sample[i];
      if (!movie) continue;
      await resolve(movie);
      if (interrupted) break;
    }
  }
  [a, b].forEach((profile, i) => {
    profile.genreSample!.completed = !interrupted;
    console.info('[genres] sample', {
      username: profile.username,
      selected: samples[i].length,
      resolved: samples[i].filter((movie) => movie.genres?.length).length,
      completed: !interrupted,
      commonPrioritized: common.length,
    });
  });
  return interrupted
    ? [
        'A análise de gêneros foi interrompida e não entra no match. A comparação continua com os demais critérios.',
      ]
    : [];
}
