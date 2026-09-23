import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMoviesPage } from '@/services/letterboxd/parsers/pages';
const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
describe('observed Letterboxd HTML', () => {
  it('extracts identifiers, title/year, rating, profile and pagination', () => {
    const result = parseMoviesPage(fixture('films.html'), 'jack');
    expect(result.movies).toHaveLength(3);
    expect(result.movies[0]).toMatchObject({
      title: 'Resident Evil',
      slug: 'resident-evil-2026',
      year: 2026,
      letterboxdId: '1302717',
      rating: 3.5,
      liked: true,
    });
    expect(result.movies[0].posterUrl).toBeUndefined();
    expect(result.displayName).toBe('Jack Moulton');
    expect(result.next).toBe('/jack/films/page/2/');
    expect(result.movies[1].liked).toBe(false);
  });
  it('accepts a confirmed empty public watchlist', () =>
    expect(parseMoviesPage(fixture('empty-watchlist.html'), 'usernamesignin').movies).toEqual([]));
  it('rejects unexpected HTML and incorrect profile ownership', () => {
    expect(() => parseMoviesPage('<html>Oops</html>', 'jack')).toThrow();
    expect(() => parseMoviesPage(fixture('films.html'), 'other')).toThrow();
  });
  it('fails on renamed movie selectors instead of silently returning zero', () =>
    expect(() =>
      parseMoviesPage(fixture('films.html').replaceAll('LazyPoster', 'NewPoster'), 'jack'),
    ).toThrow());
  it('rejects broken rating extraction instead of silently changing compatibility', () =>
    expect(() =>
      parseMoviesPage(fixture('films.html').replaceAll('rated-7', 'changed-7'), 'jack'),
    ).toThrow());
  it('recognizes protection pages', () =>
    expect(() => parseMoviesPage('<title>Just a moment...</title>', 'jack')).toThrow(/restringiu/));
  it('does not misclassify passive CDN scripts or login CAPTCHA widgets as blocks', () =>
    expect(
      parseMoviesPage(
        fixture('films.html') +
          '<script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script><form data-captcha-action="signin"></form>',
        'jack',
      ).movies,
    ).toHaveLength(3));
});

describe('likes from observed markup', () => {
  it('does not infer likes when viewing metadata or the known heart state is missing', () => {
    const unknown = parseMoviesPage(
      fixture('films.html').replaceAll('poster-viewingdata', 'changed-data'),
      'jack',
    );
    expect(unknown.movies[0].liked).toBeUndefined();
    const changed = parseMoviesPage(
      fixture('films.html').replaceAll('icon-liked', 'icon-new'),
      'jack',
    );
    expect(changed.movies[0].liked).toBeUndefined();
  });
});
