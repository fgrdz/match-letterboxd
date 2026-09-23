import { Suspense } from 'react';
import Link from 'next/link';
import { MatchResults } from '@/components/MatchResults';
import { LoadingMatch } from '@/components/LoadingMatch';
import { demoA, demoB } from '@/domain/demo';
import { calculateMatch } from '@/domain/match/calculateMatch';
import { compareProfiles } from '@/services/compareProfiles';
import { movieProvider } from '@/services/provider';
import { AppError, publicError } from '@/lib/errors';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Params = Record<string, string | string[] | undefined>;
async function Comparison({ params }: { params: Params }) {
  if (params.demo === '1')
    return <MatchResults a={demoA} b={demoB} match={calculateMatch(demoA, demoB)} demo />;
  let result: Awaited<ReturnType<typeof compareProfiles>>;
  try {
    if (typeof params.a !== 'string' || typeof params.b !== 'string')
      throw new AppError('invalid_username');
    result = await compareProfiles(movieProvider, params.a, params.b);
  } catch (error) {
    console.warn(
      '[match] comparison failed',
      error instanceof AppError ? error.code : 'unexpected',
    );
    return (
      <main className="error-panel">
        <div className="eyebrow">INTERVALO NA SESSÃO</div>
        <h1>
          Essa sessão vai
          <br />
          precisar esperar.
        </h1>
        <p role="alert">{publicError(error)}</p>
        <Link className="primary-button" href="/">
          Voltar e conferir os perfis ↗
        </Link>
        <Link href="/match?demo=1">Explorar a demonstração</Link>
      </main>
    );
  }
  return <MatchResults {...result} />;
}
export default async function MatchPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  return (
    <Suspense fallback={<LoadingMatch />}>
      <Comparison params={params} />
    </Suspense>
  );
}
