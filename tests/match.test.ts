import { describe, expect, it } from 'vitest';
import { calculateMatch } from '@/domain/match/calculateMatch';
import { ratingSimilarity } from '@/domain/match/ratingSimilarity';
import { genreSimilarity } from '@/domain/match/genreSimilarity';
import { movieKey } from '@/domain/movieKey';
import type { Movie, UserProfile } from '@/domain/models';
const movie = (slug: string, rating?: Movie['rating']): Movie => ({ slug, title: slug, rating });
const profile = (movies: Movie[], extra: Partial<UserProfile> = {}): UserProfile => ({
  username: 'test',
  movies,
  warnings: [],
  fetchedAt: '2026-09-23',
  ...extra,
});
describe('rating similarity', () => {
  it.each([
    [5, 5, 100],
    [5, 4.5, 88.8888889],
    [5, 1, 11.1111111],
    [5, 0.5, 0],
  ])('%s vs %s', (a, b, expected) =>
    expect(ratingSimilarity([Math.abs(a - b)])).toBeCloseTo(expected),
  );
  it('does not invent similarity without comparable ratings', () =>
    expect(ratingSimilarity([])).toBeUndefined());
});
describe('identity', () => {
  it('prioritizes Letterboxd ID, then slug, then TMDB, then title + year', () => {
    expect(movieKey({ ...movie('X'), letterboxdId: 'film:42', tmdbId: 7 })).toBe('lb:42');
    expect(movieKey({ ...movie('X'), tmdbId: 7 })).toBe('slug:x');
    expect(movieKey({ ...movie(''), tmdbId: 7 })).toBe('tmdb:7');
    expect(movieKey({ ...movie(''), title: 'Alien', year: 1979 })).toBe('title:alien:1979');
  });
  it('never conflates distinct films by title when slugs exist', () => {
    expect(
      calculateMatch(
        profile([{ ...movie('one'), title: 'Same' }]),
        profile([{ ...movie('two'), title: 'Same' }]),
      ).stats.common,
    ).toBe(0);
  });
});
describe('match engine v1', () => {
  it('calculates intersection and union without duplicates', () => {
    const result = calculateMatch(
      profile([movie('a', 5), movie('a'), movie('b')]),
      profile([movie('a', 4), movie('c')]),
    );
    expect(result.stats).toMatchObject({
      common: 1,
      union: 3,
      moviesA: 2,
      moviesB: 2,
      ratedByBoth: 1,
    });
    expect(result.overlapSimilarity).toBeCloseTo(100 / 3);
  });
  it('orders favorites by mean and disagreements by absolute difference', () => {
    const r = calculateMatch(
      profile([movie('a', 4), movie('b', 5), movie('c', 5)]),
      profile([movie('a', 4), movie('b', 4.5), movie('c', 1)]),
    );
    expect(r.sharedFavorites.map((m) => m.movie.slug)).toEqual(['b', 'a']);
    expect(r.biggestDisagreements.map((m) => m.movie.slug)).toEqual(['c', 'b']);
    expect(r.biggestDisagreements[0].difference).toBe(4);
  });
  it('recommends highly rated unwatched films in both directions', () => {
    const r = calculateMatch(
      profile([movie('a', 5), movie('common', 5), movie('low', 3.5)]),
      profile([movie('b', 4), movie('common')]),
    );
    expect(r.recommendations.map((x) => [x.movie.slug, x.from])).toEqual([
      ['a', 'a'],
      ['b', 'b'],
    ]);
  });
  it('suppresses unverified unwatched recommendations for partial destinations', () => {
    const r = calculateMatch(profile([movie('a', 5)]), profile([movie('b', 5)], { partial: true }));
    expect(r.recommendations.map((x) => x.from)).toEqual(['b']);
  });
  it('redistributes absent genre and likes weights: 80 ratings / (80/7) overlap', () => {
    const r = calculateMatch(profile([movie('a', 5), movie('b')]), profile([movie('a', 5)]));
    expect(r.compatibility).toBeCloseTo((100 * 80 + 50 * (80 / 7)) / (80 + 80 / 7));
    expect(r.formulaVersion).toBe('1.5');
  });
  it('does not manufacture compatibility for empty or unrated profiles', () => {
    expect(calculateMatch(profile([]), profile([])).compatibility).toBeUndefined();
    const r = calculateMatch(profile([movie('a')]), profile([movie('a')]));
    expect(r.compatibility).toBeUndefined();
    expect(r.stats.averageRatingDifference).toBeUndefined();
  });
  it('computes shared watchlist, preserving unavailable vs empty', () => {
    const a = profile([], { watchlist: [movie('x'), movie('x'), movie('y')] });
    expect(
      calculateMatch(a, profile([], { watchlist: [movie('x')] })).watchlistMatch?.map(
        (m) => m.slug,
      ),
    ).toEqual(['x']);
    expect(calculateMatch(a, profile([])).watchlistMatch).toBeUndefined();
    expect(calculateMatch(a, profile([], { watchlist: [] })).watchlistMatch).toEqual([]);
  });
  it.each([
    [3, 'low', 6],
    [10, 'medium', 20],
    [49, 'medium', 98],
    [50, 'high', 100],
    [250, 'high', 100],
  ])('confidence with %i ratings', (n, level, score) => {
    const p = profile(Array.from({ length: n }, (_, i) => movie(String(i), 5)));
    expect(calculateMatch(p, p)).toMatchObject({ confidence: level, confidenceScore: score });
  });
  it('caps confidence for incomplete filmographies', () => {
    const p = profile(
      Array.from({ length: 100 }, (_, i) => movie(String(i), 5)),
      { partial: true },
    );
    expect(calculateMatch(p, p)).toMatchObject({ confidence: 'medium', confidenceScore: 49 });
  });
  it('is symmetric and bounded', () => {
    const a = profile([movie('x', 5), movie('y', 1)]),
      b = profile([movie('x', 0.5), movie('z', 3)]);
    expect(calculateMatch(a, b).compatibility).toEqual(calculateMatch(b, a).compatibility);
    expect(calculateMatch(a, b).compatibility).toBeGreaterThanOrEqual(0);
    expect(calculateMatch(a, a).compatibility).toBe(100);
  });
});
describe('genres', () => {
  const movies = (genres: string[]) =>
    Array.from({ length: 10 }, (_, i) => ({ ...movie(String(i), 5), genres }));
  it('uses normalized fractional movie votes and histogram intersection', () => {
    const result = genreSimilarity(movies(['Drama', 'Comedy']), movies(['Drama']));
    expect(result.similarity).toBe(50);
    expect(result.genres.find((g) => g.genre === 'Drama')).toMatchObject({
      shareA: 0.5,
      shareB: 1,
      similarity: 50,
    });
  });
  it('includes genres in the final documented formula when eligible', () => {
    expect(
      calculateMatch(profile(movies(['Drama', 'Comedy'])), profile(movies(['Drama'])))
        .compatibility,
    ).toBeCloseTo((100 * 80 + 50 * (40 / 7) + 100 * (80 / 7)) / (80 + 120 / 7));
  });
  it('excludes tiny or sparse enriched samples', () => {
    expect(
      genreSimilarity(movies(['Drama']).slice(0, 3), movies(['Drama'])).similarity,
    ).toBeUndefined();
    expect(
      genreSimilarity(
        [...movies(['Drama']), ...Array.from({ length: 10 }, (_, i) => movie(`extra${i}`))],
        movies(['Drama']),
      ).similarity,
    ).toBeUndefined();
  });
});
