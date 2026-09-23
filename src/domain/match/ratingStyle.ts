import type { Movie, Rating } from '../models';
import { movieKey, uniqueMovies } from '../movieKey';

export const ratingStyleMinimums = { ratedPerProfile: 10, commonRatings: 5 } as const;

function summarize(movies: Movie[]) {
  const ratings = movies.flatMap((movie) => (movie.rating === undefined ? [] : [movie.rating]));
  const mean = ratings.length
    ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
    : undefined;
  const distribution = Array.from({ length: 10 }, (_, index) => {
    const rating = ((index + 1) / 2) as Rating;
    const count = ratings.filter((value) => value === rating).length;
    return { rating, count, share: ratings.length ? count / ratings.length : 0 };
  });
  return {
    count: ratings.length,
    mean,
    highRatingShare: ratings.length
      ? ratings.filter((rating) => rating >= 4).length / ratings.length
      : undefined,
    distribution,
    hasVariation: new Set(ratings).size > 1,
  };
}

export function ratingStyle(moviesA: Movie[], moviesB: Movie[], partial = false) {
  const a = uniqueMovies(moviesA);
  const b = uniqueMovies(moviesB);
  const summaryA = summarize(a);
  const summaryB = summarize(b);
  const indexB = new Map(b.map((movie) => [movieKey(movie), movie]));
  const pairs = a.flatMap((movie) => {
    const other = indexB.get(movieKey(movie));
    return movie.rating !== undefined && other?.rating !== undefined
      ? [{ a: movie.rating, b: other.rating }]
      : [];
  });
  const insufficient =
    summaryA.count < ratingStyleMinimums.ratedPerProfile ||
    summaryB.count < ratingStyleMinimums.ratedPerProfile ||
    pairs.length < ratingStyleMinimums.commonRatings;
  const unavailableReason = insufficient
    ? ('insufficient_data' as const)
    : !summaryA.hasVariation || !summaryB.hasVariation
      ? ('constant_ratings' as const)
      : undefined;
  const rawDifference = pairs.length
    ? pairs.reduce((sum, pair) => sum + Math.abs(pair.a - pair.b), 0) / pairs.length
    : undefined;
  // Center each rating using the mean of that person's entire collected filmography.
  // Keep the result in stars rather than inventing a second compatibility percentage.
  const adjustedDifference =
    unavailableReason === undefined
      ? pairs.reduce(
          (sum, pair) => sum + Math.abs(pair.a - summaryA.mean! - (pair.b - summaryB.mean!)),
          0,
        ) / pairs.length
      : undefined;
  const meanGapOnCommon =
    pairs.length >= ratingStyleMinimums.commonRatings
      ? pairs.reduce((sum, pair) => sum + pair.a - pair.b, 0) / pairs.length
      : undefined;
  return {
    a: summaryA,
    b: summaryB,
    comparable: pairs.length,
    rawDifference,
    adjustedDifference,
    meanGapOnCommon,
    unavailableReason,
    partial,
  };
}

export type RatingStyleResult = ReturnType<typeof ratingStyle>;
