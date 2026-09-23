import { describe, expect, it } from 'vitest';
import type { Movie, Rating, UserProfile } from '@/domain/models';
import { ratingStyle } from '@/domain/match/ratingStyle';
import { calculateMatch } from '@/domain/match/calculateMatch';

const movies = (ratings: Rating[]): Movie[] =>
  ratings.map((rating, index) => ({ slug: String(index), title: String(index), rating }));
const alternating = (low: Rating, high: Rating) =>
  movies(Array.from({ length: 10 }, (_, i) => (i % 2 ? high : low)));

describe('rating style', () => {
  it('removes a consistent one-star offset without changing the raw difference', () => {
    const result = ratingStyle(alternating(2, 3), alternating(3, 4));
    expect(result.a.mean).toBe(2.5);
    expect(result.b.mean).toBe(3.5);
    expect(result.rawDifference).toBe(1);
    expect(result.adjustedDifference).toBe(0);
    expect(result.meanGapOnCommon).toBe(-1);
    expect(result.unavailableReason).toBeUndefined();
  });
  it('preserves opposing opinions after removing the mean', () => {
    expect(ratingStyle(alternating(1, 5), alternating(5, 1)).adjustedDifference).toBe(4);
  });
  it('uses all rated films for personal means, but only shared rated films for comparison', () => {
    const a = [...alternating(2, 3), { slug: 'only-a', title: 'A', rating: 5 as const }];
    const b = alternating(3, 4);
    const result = ratingStyle(a, b);
    expect(result.a.mean).toBeCloseTo(30 / 11);
    expect(result.comparable).toBe(10);
    expect(result.adjustedDifference).toBeCloseTo(30 / 11 - 2.5);
    expect(result.meanGapOnCommon).toBe(-1);
  });
  it('deduplicates and ignores missing ratings in means and histograms', () => {
    const a = [
      ...alternating(2, 4),
      { slug: '0', title: 'Duplicate', rating: 2 as const },
      { slug: 'unrated', title: 'Unrated' },
    ];
    const result = ratingStyle(a, a);
    expect(result.a.count).toBe(10);
    expect(result.a.mean).toBe(3);
    expect(result.a.highRatingShare).toBe(0.5);
    expect(result.a.distribution.find((bucket) => bucket.rating === 2)).toMatchObject({
      count: 5,
      share: 0.5,
    });
    expect(result.a.distribution.reduce((sum, bucket) => sum + bucket.share, 0)).toBe(1);
    expect(result.adjustedDifference).toBe(0);
  });
  it('keeps empty statistics undefined, rather than inventing zeros', () => {
    const result = ratingStyle([], []);
    expect(result.a.mean).toBeUndefined();
    expect(result.a.highRatingShare).toBeUndefined();
    expect(result.rawDifference).toBeUndefined();
    expect(result.adjustedDifference).toBeUndefined();
    expect(result.meanGapOnCommon).toBeUndefined();
    expect(result.unavailableReason).toBe('insufficient_data');
  });
  it('requires at least ten personal ratings and five shared ratings', () => {
    const a = alternating(2, 3);
    expect(ratingStyle(a.slice(0, 9), a).adjustedDifference).toBeUndefined();
    const b = a.map((movie, i) => (i < 4 ? movie : { ...movie, slug: `b${i}` }));
    expect(ratingStyle(a, b).unavailableReason).toBe('insufficient_data');
    b[4] = a[4];
    expect(ratingStyle(a, b).adjustedDifference).toBe(0);
  });
  it('does not present constant rating habits as adjusted agreement', () => {
    const result = ratingStyle(alternating(4, 4), alternating(5, 5));
    expect(result.rawDifference).toBe(1);
    expect(result.adjustedDifference).toBeUndefined();
    expect(result.unavailableReason).toBe('constant_ratings');
  });
  it('is symmetric, nonnegative, and labels partial data', () => {
    const a = alternating(1.5, 4);
    const b = alternating(3, 4.5);
    const forward = ratingStyle(a, b, true);
    const reverse = ratingStyle(b, a);
    expect(forward.adjustedDifference).toBe(reverse.adjustedDifference);
    expect(forward.adjustedDifference).toBeGreaterThanOrEqual(0);
    expect(forward.meanGapOnCommon).toBe(-reverse.meanGapOnCommon!);
    expect(forward.partial).toBe(true);
  });
  it('matches stable identifiers even when movie slugs change', () => {
    const a = alternating(2, 3).map((movie) => ({ ...movie, letterboxdId: movie.slug }));
    const b = a.map((movie) => ({ ...movie, slug: `renamed-${movie.slug}` }));
    expect(ratingStyle(a, b).comparable).toBe(10);
  });
  it('adds the analysis without changing the compatibility formula or mutating profiles', () => {
    const profile = (films: Movie[]): UserProfile => ({
      username: 'test',
      movies: films,
      warnings: [],
      fetchedAt: '2026-09-23',
    });
    const a = profile(alternating(2, 3));
    const b = profile(alternating(3, 4));
    const before = structuredClone([a, b]);
    const result = calculateMatch(a, b);
    expect(result.ratingStyle.adjustedDifference).toBe(0);
    expect(result.compatibility).toBeCloseTo(
      (80 * (100 * (1 - 1 / 4.5)) + (80 / 7) * 100) / (80 + 80 / 7),
    );
    expect(result.formulaVersion).toBe('1.5');
    expect([a, b]).toEqual(before);
  });
});
