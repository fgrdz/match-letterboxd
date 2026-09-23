'use client';
import { useState } from 'react';
import { MovieCard, type CardItem } from './MovieCard';
export function MovieSection({
  title,
  subtitle,
  items,
  empty,
  usernameA,
  usernameB,
  loadPosters = false,
}: {
  title: string;
  subtitle: string;
  items?: CardItem[];
  empty: string;
  usernameA: string;
  usernameB: string;
  loadPosters?: boolean;
}) {
  const [visible, setVisible] = useState(6);
  return (
    <section className="movie-section">
      <div className="section-heading">
        <div>
          <h2>
            {title} <span className="count">{items?.length ?? '—'}</span>
          </h2>
          <p>{subtitle}</p>
        </div>
      </div>
      {items?.length ? (
        <>
          <div className="movie-grid">
            {items.slice(0, visible).map((item) => (
              <MovieCard
                key={item.movie.letterboxdId ?? item.movie.slug}
                item={item}
                usernameA={usernameA}
                usernameB={usernameB}
                loadPosters={loadPosters}
              />
            ))}
          </div>
          {items.length > visible && (
            <button className="text-button" onClick={() => setVisible((n) => n + 18)}>
              Mostrar mais ({items.length - visible}) ↓
            </button>
          )}
        </>
      ) : (
        <div className="empty-state">{empty}</div>
      )}
    </section>
  );
}
