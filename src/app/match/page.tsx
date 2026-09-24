import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { MatchResults } from '@/components/MatchResults';
import { LoadingMatch } from '@/components/LoadingMatch';
import { demoA, demoB } from '@/domain/demo';
import { calculateMatch } from '@/domain/match/calculateMatch';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Params = Record<string, string | string[] | undefined>;
async function Comparison({ params }: { params: Params }) {
  if (params.demo === '1')
    return <MatchResults a={demoA} b={demoB} match={calculateMatch(demoA, demoB)} demo />;
  redirect('/');
}
export default async function MatchPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  return (
    <Suspense fallback={<LoadingMatch />}>
      <Comparison params={params} />
    </Suspense>
  );
}
