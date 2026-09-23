import { describe, expect, it } from 'vitest';
import type { Movie, UserProfile } from '@/domain/models';
import { calculateMatch } from '@/domain/match/calculateMatch';
import { likesSimilarity } from '@/domain/match/likesSimilarity';
import { matchWeights } from '@/domain/match/formula';

const movie = (slug: string, extra: Partial<Movie> = {}): Movie => ({
  slug,
  title: slug,
  ...extra,
});
const profile = (movies: Movie[]): UserProfile => ({
  username: 'test',
  movies,
  warnings: [],
  fetchedAt: '2026-09-23',
});

describe('likes similarity', () => {
  it('uses Jaccard only among commonly watched movies, independent of ratings', () => {
    const a = [
      movie('a', { liked: true, rating: 1 }),
      movie('b', { liked: true }),
      movie('unwatched', { liked: true }),
    ];
    const b = [movie('a', { liked: true }), movie('b', { liked: false })];
    const result = likesSimilarity(a, b);
    expect(result.similarity).toBe(50);
    expect(result.comparable).toBe(2);
    expect(result.sharedMovies).toEqual([a[0]]);
    expect(likesSimilarity(b, a).similarity).toBe(50);
  });
  it('excludes unknown states, deduplicates movies, and does not reward mutual non-likes', () => {
    const a = [
      movie('a', { liked: true }),
      movie('a', { liked: true }),
      movie('b', { liked: true }),
      movie('c', { liked: false }),
    ];
    const b = [movie('a', { liked: true }), movie('b'), movie('c', { liked: false })];
    expect(likesSimilarity(a, b)).toMatchObject({ similarity: 100, comparable: 2, union: 1 });
    const empty = [movie('a', { liked: false })];
    expect(likesSimilarity(empty, empty).similarity).toBeUndefined();
    expect(likesSimilarity([], []).similarity).toBeUndefined();
  });
  it('retains zero when there are known likes but none are shared', () => {
    expect(
      likesSimilarity([movie('a', { liked: true })], [movie('a', { liked: false })]).similarity,
    ).toBe(0);
  });
  it('preserves known likes when duplicate records omit them, including an explicit false', () => {
    const other = [movie('a', { liked: true })];
    expect(
      likesSimilarity([movie('a', { liked: true }), movie('a', { liked: undefined })], other)
        .similarity,
    ).toBe(100);
    expect(
      likesSimilarity([movie('a', { liked: true }), movie('a', { liked: false })], other)
        .similarity,
    ).toBe(0);
  });
  it('matches IDs instead of titles', () => {
    expect(
      likesSimilarity(
        [movie('a', { letterboxdId: '1', liked: true })],
        [movie('renamed', { letterboxdId: '1', liked: true })],
      ).similarity,
    ).toBe(100);
    expect(
      likesSimilarity(
        [movie('a', { letterboxdId: '1', liked: true })],
        [movie('a', { letterboxdId: '2', liked: true })],
      ).similarity,
    ).toBeUndefined();
  });
});

describe('formula v1.5 with likes', () => {
  it('preserves the remaining 2:4:1 ratio with 80% for ratings', () => {
    expect(matchWeights.ratings).toBe(80);
    expect(matchWeights.genres / matchWeights.likes).toBeCloseTo(2);
    expect(matchWeights.overlap / matchWeights.likes).toBeCloseTo(4);
    expect(matchWeights.genres + matchWeights.overlap + matchWeights.likes).toBeCloseTo(20);
  });
  it('weights all four criteria, keeping known zero scores in the denominator', () => {
    const a = profile(
      Array.from({ length: 10 }, (_, i) =>
        movie(String(i), { rating: 5, genres: ['Drama'], liked: i < 2 }),
      ),
    );
    const b = profile(
      Array.from({ length: 10 }, (_, i) =>
        movie(String(i), { rating: 5, genres: ['Comedy'], liked: i === 0 }),
      ),
    );
    expect(Object.values(matchWeights).reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(100);
    // Ratings=100, genres=0, overlap=100, likes=50.
    expect(calculateMatch(a, b).compatibility).toBeCloseTo(650 / 7);
    expect(calculateMatch(b, a).compatibility).toBeCloseTo(650 / 7);
    expect(calculateMatch(a, b).formulaVersion).toBe('1.5');
  });
  it('uses likes without ratings, while keeping confidence low', () => {
    const a = profile([movie('a', { liked: true })]);
    expect(calculateMatch(a, a)).toMatchObject({
      compatibility: 100,
      confidence: 'low',
      confidenceScore: 0,
    });
    const b = profile([movie('a', { liked: false })]);
    expect(calculateMatch(a, b).compatibility).toBe(80);
  });
  it('does not manufacture preference evidence and caps confidence for partial filmographies', () => {
    const unrated = profile([movie('a', { liked: false })]);
    expect(calculateMatch(unrated, unrated).compatibility).toBeUndefined();
    const complete = profile(
      Array.from({ length: 50 }, (_, i) => movie(String(i), { rating: 5, liked: true })),
    );
    expect(calculateMatch({ ...complete, partial: true }, complete).confidenceScore).toBe(49);
  });
});
