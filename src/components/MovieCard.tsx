import type { Movie } from '@/domain/models';
import { MoviePoster } from './MoviePoster';
export function stars(rating: number | undefined): string {
  return rating === undefined
    ? 'Sem nota'
    : '★'.repeat(Math.floor(rating)) + (rating % 1 ? '½' : '');
}
export interface CardItem {
  movie: Movie;
  ratingA?: number;
  ratingB?: number;
  difference?: number;
  singleRating?: number;
}
export function MovieCard({
  item,
  usernameA,
  usernameB,
  loadPosters = false,
}: {
  item: CardItem;
  usernameA: string;
  usernameB: string;
  loadPosters?: boolean;
}) {
  const { movie } = item;
  return (
    <article className="movie-card">
      <a
        href={`https://letterboxd.com/film/${encodeURIComponent(movie.slug)}/`}
        target="_blank"
        rel="noreferrer"
        className="movie-poster"
        aria-label={`${movie.title} no Letterboxd (nova aba)`}
      >
        <MoviePoster movie={movie} enabled={loadPosters} />
        {item.difference !== undefined && (
          <span className="difference-badge">Δ {item.difference.toFixed(1)}</span>
        )}
      </a>
      <h3>{movie.title}</h3>
      <p className="movie-year">
        {movie.year ?? 'Ano indisponível'}
        {movie.runtime ? ` · ${movie.runtime} min` : ''}
      </p>
      {item.singleRating !== undefined ? (
        <p className="rating coral-text" aria-label={`${item.singleRating} de 5 estrelas`}>
          {stars(item.singleRating)}
        </p>
      ) : (
        (item.ratingA !== undefined || item.ratingB !== undefined) && (
          <div className="rating-pair">
            <span title={`@${usernameA}: ${item.ratingA ?? 'sem nota'}`} className="coral-text">
              <small>@{usernameA}</small>
              {stars(item.ratingA)}
            </span>
            <span title={`@${usernameB}: ${item.ratingB ?? 'sem nota'}`} className="lavender-text">
              <small>@{usernameB}</small>
              {stars(item.ratingB)}
            </span>
          </div>
        )
      )}
    </article>
  );
}
