import 'server-only';
import { uniqueMovies } from '@/domain/movieKey';
import { AppError } from '@/lib/errors';
import { envNumber } from '@/lib/config';
import { fetchLetterboxd } from './client';
import { parseMoviesPage } from './parsers/pages';
export async function scrapeCollection(username: string, collection: 'films' | 'watchlist') {
  const maxPages = envNumber('LETTERBOXD_MAX_PAGES', Infinity);
  const movies = [];
  let page = 1;
  let path: string | undefined = `/${username}/${collection}/`;
  let first: ReturnType<typeof parseMoviesPage> | undefined;
  while (path) {
    const parsed = parseMoviesPage(await fetchLetterboxd(path), username);
    first ??= parsed;
    movies.push(...parsed.movies);
    console.info(
      `[letterboxd] ${username} ${collection} page ${page}: ${parsed.movies.length} movies`,
    );
    if (parsed.next && parsed.next !== `/${username}/${collection}/page/${page + 1}/`)
      throw new AppError('parser');
    if (parsed.next && !parsed.movies.length) throw new AppError('parser');
    if (page >= maxPages)
      return { ...first, movies: uniqueMovies(movies), partial: Boolean(parsed.next) };
    path = parsed.next;
    page++;
  }
  return { ...first, movies: uniqueMovies(movies), partial: false };
}
