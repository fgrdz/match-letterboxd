import type { RatingStyleResult } from '@/domain/match/ratingStyle';
import styles from './RatingStylePanel.module.css';

const number = (value: number) =>
  value.toLocaleString('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

function ProfileStyle({
  name,
  summary,
  variant,
}: {
  name: string;
  summary: RatingStyleResult['a'];
  variant: 'a' | 'b';
}) {
  return (
    <article className={`${styles.profile} ${styles[variant]}`}>
      <h3>@{name}</h3>
      <p className={styles.average}>
        {summary.mean === undefined ? '—' : number(summary.mean)} <span>★ de média</span>
      </p>
      <p>{summary.count} filmes avaliados</p>
      <ul className={styles.histogram} aria-label={`Distribuição das notas de @${name}`}>
        {summary.distribution.map((bucket) => (
          <li
            key={bucket.rating}
            aria-label={`${bucket.rating} estrelas: ${bucket.count} filmes`}
            title={`${bucket.rating} ★ · ${bucket.count} filmes`}
          >
            <div className={styles.track} aria-hidden="true">
              <span style={{ height: `${bucket.share * 100}%` }} />
            </div>
            <span aria-hidden="true">{String(bucket.rating).replace('.', ',')}</span>
          </li>
        ))}
      </ul>
      <p>
        {summary.highRatingShare === undefined
          ? 'Ainda sem notas disponíveis.'
          : `${Math.round(summary.highRatingShare * 100)}% das notas são 4 estrelas ou mais.`}
      </p>
    </article>
  );
}

export function RatingStylePanel({
  result,
  usernameA,
  usernameB,
}: {
  result: RatingStyleResult;
  usernameA: string;
  usernameB: string;
}) {
  const gap = result.meanGapOnCommon;
  const tendency =
    gap === undefined
      ? 'Precisamos de mais filmes avaliados pelos dois para comparar a tendência das notas.'
      : Math.abs(gap) < 0.25
        ? 'Nos filmes avaliados pelos dois, as médias ficam a menos de ¼ de estrela de distância.'
        : `Nos filmes avaliados pelos dois, @${gap > 0 ? usernameA : usernameB} dá, em média, ${number(Math.abs(gap))} estrela(s) a mais.`;
  return (
    <section className={styles.panel} aria-labelledby="rating-style-title">
      <div className="section-heading">
        <div>
          <h2 id="rating-style-title">Cada um tem sua régua</h2>
          <p>Uma nota 4 pode ser um grande elogio para uma pessoa e algo habitual para outra.</p>
        </div>
      </div>
      <div className={styles.profiles}>
        <ProfileStyle name={usernameA} summary={result.a} variant="a" />
        <ProfileStyle name={usernameB} summary={result.b} variant="b" />
      </div>
      <div className={styles.comparison}>
        <h3>Sintonia além das estrelas</h3>
        <p>{tendency}</p>
        <dl className={styles.metrics}>
          <div>
            <dt>Diferença original</dt>
            <dd>
              {result.rawDifference === undefined ? '—' : `${number(result.rawDifference)} ★`}
            </dd>
          </div>
          <div>
            <dt>Diferença ajustada ao estilo</dt>
            <dd>
              {result.adjustedDifference === undefined
                ? '—'
                : `${number(result.adjustedDifference)} ★`}
            </dd>
          </div>
        </dl>
        <p>{result.comparable} filmes avaliados pelos dois.</p>
      </div>
    </section>
  );
}
