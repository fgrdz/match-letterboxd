import Link from 'next/link';
import type { UserProfile } from '@/domain/models';
import type { MatchResult } from '@/domain/match/types';
import { MovieSection } from './MovieSection';
import { ProfileAvatar } from './ProfileAvatar';
import { RatingStylePanel } from './RatingStylePanel';
import { GenrePanel } from './GenrePanel';
import { GenreMovieBrowser } from './GenreMovieBrowser';
export function MatchResults({
  a,
  b,
  match,
  warnings = [],
  demo = false,
  tmdbEnabled = false,
}: {
  a: UserProfile;
  b: UserProfile;
  match: MatchResult;
  warnings?: string[];
  demo?: boolean;
  tmdbEnabled?: boolean;
}) {
  const names = { usernameA: a.username, usernameB: b.username, loadPosters: tmdbEnabled && !demo };
  const confidence = {
    low: 'Baixa confiança',
    medium: 'Confiança moderada',
    high: 'Alta confiança',
  }[match.confidence];
  return (
    <main className="results">
      <Link href="/" className="back-link">
        ← Nova comparação
      </Link>
      {demo && (
        <div className="notice">
          DEMONSTRAÇÃO · Perfis e avaliações fictícios. Nenhuma coleta foi realizada.
        </div>
      )}
      {warnings.map((w) => (
        <div className="notice" key={w}>
          {w}
        </div>
      ))}
      <section className="match-hero">
        <div className="eyebrow">O ENCONTRO DOS SEUS GOSTOS</div>
        <div className="match-trio">
          <div className="person">
            <ProfileAvatar name={a.displayName ?? a.username} avatarUrl={a.avatarUrl} variant="a" />
            <h1>{a.displayName ?? a.username}</h1>
            <span>@{a.username}</span>
            <small>
              {match.stats.moviesA} filmes{a.partial ? ' coletados' : ' assistidos'}
            </small>
          </div>
          <div className="match-score">
            <span>
              {match.compatibility === undefined ? '—' : Math.round(match.compatibility)}
              {match.compatibility !== undefined && <small>%</small>}
            </span>
            <strong>MOVIE MATCH</strong>
          </div>
          <div className="person">
            <ProfileAvatar name={b.displayName ?? b.username} avatarUrl={b.avatarUrl} variant="b" />
            <h2>{b.displayName ?? b.username}</h2>
            <span>@{b.username}</span>
            <small>
              {match.stats.moviesB} filmes{b.partial ? ' coletados' : ' assistidos'}
            </small>
          </div>
        </div>
        <p className="match-caption">
          {match.compatibility === undefined
            ? 'Ainda não há dados comparáveis suficientes para uma pontuação.'
            : `${match.stats.ratedByBoth} filmes avaliados pelos dois.`}
        </p>
        <span className="confidence">
          <i className="dot coral" />
          {confidence} · {match.confidenceScore}/100
        </span>
        {match.stats.ratedByBoth < 10 && (
          <p className="low-data">
            Poucas avaliações em comum: explore as descobertas sem tirar conclusões definitivas.
          </p>
        )}
      </section>
      <section className="stats" aria-label="Estatísticas">
        {[
          [match.stats.common, 'filmes em comum'],
          [match.stats.ratedByBoth, 'avaliados pelos dois'],
          [match.stats.averageRatingDifference?.toFixed(2) ?? '—', 'diferença média nas notas'],
          [match.stats.sharedFavorites, 'favoritos compartilhados'],
        ].map(([value, label]) => (
          <article key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </article>
        ))}
      </section>
      <MovieSection
        title="Os favoritos de vocês"
        subtitle="Quatro estrelas ou mais, dos dois lados. Tem coisa boa aqui."
        items={match.sharedFavorites}
        empty="Ainda não encontramos filmes com nota 4 ou mais dos dois."
        {...names}
      />
      <MovieSection
        title="Precisamos conversar sobre…"
        subtitle="As maiores diferenças de opinião. O começo de uma boa conversa."
        items={match.biggestDisagreements}
        empty="Nenhuma discordância nas avaliações comparáveis encontradas."
        {...names}
      />
      <MovieSection
        title="Um coração dos dois lados"
        subtitle="Filmes que receberam um coração dos dois lados."
        items={match.likes.sharedMovies.map((movie) => ({ movie }))}
        empty={
          match.likes.comparable
            ? 'Nenhum like compartilhado nos filmes comparáveis.'
            : 'Sem informação de likes comparável nesta coleta.'
        }
        {...names}
      />
      <GenrePanel
        match={match}
        usernameA={a.username}
        usernameB={b.username}
        tmdbEnabled={tmdbEnabled}
      />
      <GenreMovieBrowser
        items={match.commonMovies}
        usernameA={a.username}
        usernameB={b.username}
        loadPosters={tmdbEnabled && !demo}
      />
      <MovieSection
        title="Na lista dos dois"
        subtitle={`A vontade de assistir já é compartilhada.${a.watchlistPartial || b.watchlistPartial ? ' Interseção parcial das watchlists.' : ''}`}
        items={match.watchlistMatch?.map((movie) => ({ movie }))}
        empty={
          match.watchlistMatch === undefined
            ? 'Uma das watchlists não está disponível. Isso não afeta a comparação de notas.'
            : 'Nenhum filme em comum nas watchlists coletadas. Que tal uma indicação abaixo?'
        }
        {...names}
      />
      <MovieSection
        title={`Direto dos favoritos de ${a.displayName ?? a.username}`}
        subtitle={`Nota 4+ de @${a.username}, ainda não assistidos por @${b.username}.`}
        items={match.recommendations
          .filter((r) => r.from === 'a')
          .map((r) => ({ movie: r.movie, singleRating: r.movie.rating }))}
        empty={
          b.partial
            ? 'Indicações suspensas: a filmografia de destino está incompleta.'
            : 'Nenhuma indicação cruzada encontrada com os dados disponíveis.'
        }
        {...names}
      />
      <MovieSection
        title={`Direto dos favoritos de ${b.displayName ?? b.username}`}
        subtitle={`Nota 4+ de @${b.username}, ainda não assistidos por @${a.username}.`}
        items={match.recommendations
          .filter((r) => r.from === 'b')
          .map((r) => ({ movie: r.movie, singleRating: r.movie.rating }))}
        empty={
          a.partial
            ? 'Indicações suspensas: a filmografia de destino está incompleta.'
            : 'Nenhuma indicação cruzada encontrada com os dados disponíveis.'
        }
        {...names}
      />
      <MovieSection
        title="Todos os filmes em comum"
        subtitle="Duas histórias de cinema que se cruzam."
        items={match.commonMovies}
        empty="Nenhum filme em comum ainda. As recomendações cruzadas podem aproximar vocês."
        {...names}
      />
      <RatingStylePanel result={match.ratingStyle} usernameA={a.username} usernameB={b.username} />
      {tmdbEnabled && (
        <p className="tmdb-credit">
          This product uses the TMDB API but is not endorsed or certified by TMDB.{' '}
          <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">
            The Movie Database ↗
          </a>
        </p>
      )}
    </main>
  );
}
