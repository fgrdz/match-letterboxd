import type { Movie, Rating } from '../models';
import type { formulaVersion } from './formula';
import type { likesSimilarity } from './likesSimilarity';
import type { RatingStyleResult } from './ratingStyle';
import type { genreSimilarity } from './genreSimilarity';
export interface MovieComparison {
  movie: Movie;
  ratingA?: Rating;
  ratingB?: Rating;
  difference?: number;
  average?: number;
}
export interface MovieRecommendation {
  movie: Movie;
  from: 'a' | 'b';
}
export interface GenreComparison {
  genre: string;
  shareA: number;
  shareB: number;
  similarity: number;
}
export interface MatchResult {
  formulaVersion: typeof formulaVersion;
  likes: ReturnType<typeof likesSimilarity>;
  ratingStyle: RatingStyleResult;
  compatibility?: number;
  ratingSimilarity?: number;
  genreSimilarity?: number;
  overlapSimilarity: number;
  genreCoverage: { a: number; b: number };
  genreAnalysis: ReturnType<typeof genreSimilarity>['analysis'];
  genres: GenreComparison[];
  confidence: 'low' | 'medium' | 'high';
  confidenceScore: number;
  commonMovies: MovieComparison[];
  sharedFavorites: MovieComparison[];
  biggestDisagreements: MovieComparison[];
  recommendations: MovieRecommendation[];
  watchlistMatch?: Movie[];
  stats: {
    moviesA: number;
    moviesB: number;
    common: number;
    union: number;
    ratedByBoth: number;
    averageRatingDifference?: number;
    sharedFavorites: number;
  };
}
