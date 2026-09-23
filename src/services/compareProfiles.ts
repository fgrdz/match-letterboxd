import 'server-only';
import type { MovieProvider, UserProfile } from '@/domain/models';
import { movieKey, uniqueMovies } from '@/domain/movieKey';
import { calculateMatch } from '@/domain/match/calculateMatch';
import { envNumber } from '@/lib/config';
import { AppError } from '@/lib/errors';
import { validateUsername } from '@/lib/validation/username';
import { enrichMovie } from './tmdb/client';
import { enrichGenreSamples } from './tmdb/enrichGenreSamples';
let active = 0;
export async function compareProfiles(provider: MovieProvider, inputA: string, inputB: string) {
  const usernameA = validateUsername(inputA),
    usernameB = validateUsername(inputB);
  if (active >= 3) throw new AppError('busy');
  active++;
  try {
    // allSettled keeps the concurrency slot until both jobs have actually finished.
    const results = await Promise.allSettled([
      provider.getUserProfile(usernameA),
      provider.getUserProfile(usernameB),
    ]);
    const failed = results.find((r) => r.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    const [a, b] = results.map((r) =>
      structuredClone((r as PromiseFulfilledResult<UserProfile>).value),
    );
    const initial = calculateMatch(a, b);
    const selected = uniqueMovies([
      ...initial.sharedFavorites.slice(0, 6).map((c) => c.movie),
      ...initial.biggestDisagreements.slice(0, 6).map((c) => c.movie),
      ...(initial.watchlistMatch ?? []).slice(0, 6),
      ...initial.recommendations
        .filter((r) => r.from === 'a')
        .slice(0, 6)
        .map((r) => r.movie),
      ...initial.recommendations
        .filter((r) => r.from === 'b')
        .slice(0, 6)
        .map((r) => r.movie),
      ...initial.commonMovies.slice(0, 6).map((c) => c.movie),
    ]).slice(0, envNumber('TMDB_MAX_MOVIES', 18, 0, 60));
    const warnings = [...new Set([...a.warnings, ...b.warnings])];
    let tmdbUnavailable = false;
    for (const movie of selected) {
      try {
        const metadata = await enrichMovie(movie);
        for (const profile of [a, b])
          for (const item of [...profile.movies, ...(profile.watchlist ?? [])]) {
            if (movieKey(item) === movieKey(movie))
              Object.assign(
                item,
                Object.fromEntries(Object.entries(metadata).filter(([, v]) => v !== undefined)),
              );
          }
      } catch {
        tmdbUnavailable = true;
        console.warn('[tmdb] enrichment unavailable; stopping optional enrichment');
        warnings.push(
          'O TMDB está indisponível. A comparação continua com os dados do Letterboxd.',
        );
        break;
      }
    }
    if (!tmdbUnavailable) warnings.push(...(await enrichGenreSamples(a, b)));
    else {
      // Do not let the UI-selected metadata become the analytical population after an outage.
      a.genreSample = { movieKeys: [], completed: false };
      b.genreSample = { movieKeys: [], completed: false };
    }
    const match = calculateMatch(a, b);
    console.info(`[match] ${match.stats.ratedByBoth} comparable movies`);
    return { a, b, match, warnings, tmdbEnabled: Boolean(process.env.TMDB_API_KEY) };
  } finally {
    active--;
  }
}
