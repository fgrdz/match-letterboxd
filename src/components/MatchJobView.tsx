'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { MatchJob, MatchJobStage } from '@/services/jobs/types';
import { LoadingMatch } from './LoadingMatch';
import { MatchResults } from './MatchResults';

const stageMessages: Record<MatchJobStage, string> = {
  queued: 'Sua comparação entrou na fila.',
  collecting_profiles: 'Buscando as filmografias públicas…',
  calculating_match: 'Comparando avaliações, likes e filmes em comum…',
  enriching_movies: 'Completando gêneros e detalhes dos filmes…',
  completed: 'Comparação concluída.',
  failed: 'A comparação foi interrompida.',
};

export function MatchJobView({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<MatchJob>();
  const [connectionError, setConnectionError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const response = await fetch(`/api/matches/${jobId}`, { cache: 'no-store' });
        const body = (await response.json()) as MatchJob & { error?: string };
        if (!response.ok) throw new Error(body.error || 'Não foi possível consultar o andamento.');
        if (cancelled) return;
        setJob(body);
        setConnectionError('');
        if (body.status === 'queued' || body.status === 'running') timer = setTimeout(poll, 2500);
      } catch (error) {
        if (cancelled) return;
        setConnectionError(error instanceof Error ? error.message : 'Falha temporária de conexão.');
        timer = setTimeout(poll, 4000);
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  if (job?.status === 'completed' && job.result) return <MatchResults {...job.result} />;

  if (job?.status === 'failed') {
    return (
      <main className="error-panel">
        <div className="eyebrow">SESSÃO INTERROMPIDA</div>
        <h1>
          Não foi possível
          <br />
          concluir o match.
        </h1>
        <p role="alert">{job.errorMessage}</p>
        <Link className="primary-button" href="/">
          Tentar novamente ↗
        </Link>
        <Link href="/match?demo=1">Explorar a demonstração</Link>
      </main>
    );
  }

  return (
    <LoadingMatch
      message={job ? stageMessages[job.stage] : 'Preparando o processamento…'}
      progress={job?.progress ?? 0}
      detail={
        connectionError || 'Você pode manter esta página aberta enquanto o trabalho continua.'
      }
    />
  );
}
