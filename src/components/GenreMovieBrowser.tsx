'use client';

import { useState } from 'react';
import type { MovieComparison } from '@/domain/match/types';
import { commonGenreOptions, rankCommonMoviesByGenre } from '@/domain/match/genreMovieRanking';
import { MovieSection } from './MovieSection';

export function GenreMovieBrowser({
  items,
  usernameA,
  usernameB,
  loadPosters,
}: {
  items: MovieComparison[];
  usernameA: string;
  usernameB: string;
  loadPosters: boolean;
}) {
  const options = commonGenreOptions(items);
  const [selected, setSelected] = useState(options[0]?.genre ?? '');
  const ranked = selected ? rankCommonMoviesByGenre(items, selected) : [];

  return (
    <section className="genre-movie-browser" aria-labelledby="genre-browser-title">
      <div className="section-heading">
        <div>
          <h2 id="genre-browser-title">Mais bem avaliados por gênero em comum</h2>
          <p>Os destaques de cada gênero entre os filmes que vocês viram.</p>
        </div>
      </div>
      {options.length ? (
        <>
          <div className="genre-filters" aria-label="Filtrar filmes por gênero">
            {options.map((option) => (
              <button
                type="button"
                key={option.genre}
                aria-pressed={selected === option.genre}
                onClick={() => setSelected(option.genre)}
              >
                {option.genre} <span>{option.movies}</span>
              </button>
            ))}
          </div>
          <MovieSection
            key={selected}
            title={selected}
            subtitle={`${ranked.filter((item) => item.ratingsCount === 2).length} com nota dos dois · ${ranked.length} com pelo menos uma nota.`}
            items={ranked}
            empty="Nenhum filme avaliado encontrado para este gênero."
            usernameA={usernameA}
            usernameB={usernameB}
            loadPosters={loadPosters}
          />
        </>
      ) : (
        <div className="empty-state">
          Ainda não há filmes em comum com gêneros e avaliações disponíveis para filtrar.
        </div>
      )}
    </section>
  );
}
