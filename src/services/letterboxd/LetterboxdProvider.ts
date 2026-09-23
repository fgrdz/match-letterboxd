import 'server-only';
import type { MovieProvider, UserProfile } from '@/domain/models';
import { MemoryCache, type Cache } from '@/lib/cache/memory';
import { envNumber } from '@/lib/config';
import { AppError, publicError } from '@/lib/errors';
import { validateUsername } from '@/lib/validation/username';
import { scrapeCollection } from './scraper';
import { getTransport } from './transports';
export class LetterboxdProvider implements MovieProvider {
  private pending = new Map<string, Promise<UserProfile>>();
  constructor(private cache: Cache<UserProfile> = new MemoryCache(100)) {}
  async getUserProfile(input: string): Promise<UserProfile> {
    const username = validateUsername(input);
    const key = `likes-v1:${getTransport().name}:${username}:${process.env.LETTERBOXD_MAX_PAGES ?? 'all'}`;
    const cached = this.cache.get(key);
    if (cached) {
      console.info('[letterboxd] profile cache hit:', username);
      return structuredClone(cached);
    }
    let task = this.pending.get(key);
    if (!task) {
      task = this.fetchProfile(username)
        .then((profile) => {
          this.cache.set(
            key,
            profile,
            profile.warnings.length ? 300 : envNumber('CACHE_TTL_SECONDS', 3600),
          );
          return profile;
        })
        .finally(() => this.pending.delete(key));
      this.pending.set(key, task);
    }
    return structuredClone(await task);
  }
  private async fetchProfile(username: string): Promise<UserProfile> {
    const films = await scrapeCollection(username, 'films');
    let watch: Awaited<ReturnType<typeof scrapeCollection>> | undefined;
    const warnings: string[] = [];
    try {
      watch = await scrapeCollection(username, 'watchlist');
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      warnings.push(`Watchlist de @${username}: ${publicError(error)}`);
    }
    if (films.partial)
      warnings.push(
        `Filmografia de @${username} limitada por LETTERBOXD_MAX_PAGES. Recomendações para essa pessoa foram suspensas.`,
      );
    if (watch?.partial) warnings.push(`Watchlist de @${username} coletada parcialmente.`);
    return {
      username,
      displayName: films.displayName,
      avatarUrl: films.avatarUrl,
      movies: films.movies,
      watchlist: watch?.movies,
      partial: films.partial,
      watchlistPartial: watch?.partial,
      warnings,
      fetchedAt: new Date().toISOString(),
    };
  }
}
