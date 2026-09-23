import type { MatchResult } from '@/domain/match/types';

function Preferences({
  name,
  report,
}: {
  name: string;
  report: MatchResult['genreAnalysis']['a'];
}) {
  return (
    <div>
      <h3>@{name}</h3>
      <h4>Gêneros mais bem avaliados</h4>
      {report.preferences.length ? (
        <ul>
          {report.preferences.slice(0, 3).map((item) => (
            <li key={item.genre}>
              {item.genre}: {item.meanRating.toFixed(2)} ★ · {item.count} filmes avaliados
            </li>
          ))}
        </ul>
      ) : (
        <p>Ainda não há destaques suficientes.</p>
      )}
    </div>
  );
}

export function GenrePanel({
  match,
  usernameA,
  usernameB,
  tmdbEnabled,
}: {
  match: MatchResult;
  usernameA: string;
  usernameB: string;
  tmdbEnabled: boolean;
}) {
  const shared = match.genres.filter((genre) => genre.shareA > 0 && genre.shareB > 0);
  return (
    <section className="genre-analysis" aria-labelledby="genre-title">
      <div className="genre-panel">
        <div>
          <div className="eyebrow">SEUS UNIVERSOS EM COMUM</div>
          <h2 id="genre-title">
            Os gêneros que
            <br />
            vocês assistem.
          </h2>
          <p>
            {match.genreSimilarity === undefined
              ? 'Ainda não há gêneros suficientes para comparar.'
              : `${match.genreAnalysis.estimated ? 'Afinidade estimada' : 'Afinidade'} de gêneros: ${match.genreSimilarity.toFixed(1)}%.`}
          </p>
        </div>
        <div className="genre-bars">
          {shared.length ? (
            shared.slice(0, 5).map((genre) => (
              <div key={genre.genre}>
                <div>
                  <span>{genre.genre}</span>
                  <strong>
                    {Math.round(genre.similarity)}% <small>similaridade</small>
                  </strong>
                </div>
                <div className="bar">
                  <span style={{ width: `${genre.similarity}%` }} />
                </div>
                <small>
                  {(genre.shareA * 100).toFixed(1)}% da distribuição A ·{' '}
                  {(genre.shareB * 100).toFixed(1)}% da distribuição B
                </small>
              </div>
            ))
          ) : (
            <p>
              {tmdbEnabled ? 'Nenhum gênero compartilhado encontrado.' : 'Gêneros indisponíveis.'}
            </p>
          )}
        </div>
      </div>
      <div className="genre-sample-details">
        <Preferences name={usernameA} report={match.genreAnalysis.a} />
        <Preferences name={usernameB} report={match.genreAnalysis.b} />
      </div>
    </section>
  );
}
