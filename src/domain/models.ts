export type Rating = 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5;
export interface Movie {
  letterboxdId?: string;
  slug: string;
  title: string;
  year?: number;
  rating?: Rating;
  liked?: boolean;
  posterUrl?: string;
  tmdbId?: number;
  genres?: string[];
  backdropUrl?: string;
  runtime?: number;
  releaseDate?: string;
  director?: string;
  cast?: string[];
}
export interface UserProfile {
  username: string;
  displayName?: string;
  avatarUrl?: string;
  movies: Movie[];
  genreSample?: {
    movieKeys: string[];
    completed: boolean;
  };
  watchlist?: Movie[];
  partial?: boolean;
  watchlistPartial?: boolean;
  warnings: string[];
  fetchedAt: string;
}
export interface MovieProvider {
  getUserProfile(username: string): Promise<UserProfile>;
}
