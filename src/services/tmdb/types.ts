export interface TmdbMovie {
  id: number;
  title: string;
  original_title?: string;
  release_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  runtime?: number;
  genres?: { id: number; name: string }[];
  genre_ids?: number[];
  credits?: { crew: { job: string; name: string }[]; cast: { name: string }[] };
}
