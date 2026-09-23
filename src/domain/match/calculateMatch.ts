import type { UserProfile } from '../models';
import { movieKey, uniqueMovies } from '../movieKey';
import { ratingSimilarity } from './ratingSimilarity';
import { genreSimilarity } from './genreSimilarity';
import { recommendations } from './recommendations';
import type { MatchResult, MovieComparison } from './types';
import { formulaVersion, matchWeights } from './formula';
import { likesSimilarity } from './likesSimilarity';
import { ratingStyle } from './ratingStyle';
export function calculateMatch(profileA: UserProfile, profileB: UserProfile): MatchResult {
  const a = uniqueMovies(profileA.movies),
    b = uniqueMovies(profileB.movies);
  const indexB = new Map(b.map((m) => [movieKey(m), m]));
  const commonMovies: MovieComparison[] = [];
  for (const movie of a) {
    const other = indexB.get(movieKey(movie));
    if (!other) continue;
    const rated = movie.rating !== undefined && other.rating !== undefined;
    commonMovies.push({
      movie,
      ratingA: movie.rating,
      ratingB: other.rating,
      difference: rated ? Math.abs(movie.rating! - other.rating!) : undefined,
      average: rated ? (movie.rating! + other.rating!) / 2 : undefined,
    });
  }
  const differences = commonMovies.flatMap((m) =>
    m.difference === undefined ? [] : [m.difference],
  );
  const ratings = ratingSimilarity(differences);
  const union = a.length + b.length - commonMovies.length;
  const overlapSimilarity = union ? (100 * commonMovies.length) / union : 0;
  const genre = genreSimilarity(a, b, {
    sampleA: profileA.genreSample,
    sampleB: profileB.genreSample,
    partialA: profileA.partial,
    partialB: profileB.partial,
  });
  const likes = likesSimilarity(a, b);
  const preferenceScores = [
    [ratings, matchWeights.ratings],
    [genre.similarity, matchWeights.genres],
    [likes.similarity, matchWeights.likes],
  ] as const;
  const available = preferenceScores.filter(([score]) => score !== undefined);
  const hasEvidence = available.length > 0;
  const weight = available.reduce((sum, [, weight]) => sum + weight, Number(matchWeights.overlap));
  const compatibility = hasEvidence
    ? (available.reduce((sum, [score, weight]) => sum + score! * weight, 0) +
        overlapSimilarity * matchWeights.overlap) /
      weight
    : undefined;
  const partial = Boolean(profileA.partial || profileB.partial);
  const confidenceScore = Math.round(Math.min(partial ? 49 : 100, (differences.length / 50) * 100));
  const sharedFavorites = commonMovies
    .filter((m) => (m.ratingA ?? 0) >= 4 && (m.ratingB ?? 0) >= 4)
    .sort((x, y) => y.average! - x.average!);
  const watchB = new Set(profileB.watchlist?.map(movieKey));
  return {
    formulaVersion,
    likes,
    ratingStyle: ratingStyle(a, b, partial),
    compatibility,
    ratingSimilarity: ratings,
    overlapSimilarity,
    genreSimilarity: genre.similarity,
    genres: genre.genres,
    genreCoverage: genre.coverage,
    genreAnalysis: genre.analysis,
    confidenceScore,
    confidence: confidenceScore >= 100 ? 'high' : confidenceScore >= 20 ? 'medium' : 'low',
    commonMovies,
    sharedFavorites,
    biggestDisagreements: commonMovies
      .filter((m) => m.difference !== undefined && m.difference > 0)
      .sort((x, y) => y.difference! - x.difference!),
    recommendations: recommendations(a, b, profileA.partial, profileB.partial),
    watchlistMatch:
      profileA.watchlist && profileB.watchlist
        ? uniqueMovies(profileA.watchlist).filter((m) => watchB.has(movieKey(m)))
        : undefined,
    stats: {
      moviesA: a.length,
      moviesB: b.length,
      common: commonMovies.length,
      union,
      ratedByBoth: differences.length,
      averageRatingDifference: differences.length
        ? differences.reduce((sum, d) => sum + d, 0) / differences.length
        : undefined,
      sharedFavorites: sharedFavorites.length,
    },
  };
}
