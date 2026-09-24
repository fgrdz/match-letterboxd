import { FatalError } from 'workflow';
import { envNumber } from '@/lib/config';
import { AppError, publicError } from '@/lib/errors';
import { completeComparison } from '@/services/compareProfiles';
import {
  completeJob,
  failJob,
  getProfileSnapshot,
  saveProfileSnapshot,
  updateJobProgress,
} from '@/services/jobs/repository';
import { movieProvider } from '@/services/provider';

function snapshotKey(username: string): string {
  return [
    'profile-v1',
    process.env.LETTERBOXD_TRANSPORT ?? 'direct',
    process.env.LETTERBOXD_MAX_PAGES ?? 'all',
    username.toLowerCase(),
  ].join(':');
}

async function setProgress(
  jobId: string,
  stage: 'collecting_profiles' | 'calculating_match' | 'enriching_movies',
  progress: number,
) {
  'use step';
  await updateJobProgress(jobId, stage, progress);
}

async function collectProfile(username: string) {
  'use step';
  try {
    const key = snapshotKey(username);
    const cached = await getProfileSnapshot(key);
    if (cached) {
      console.info('[jobs] persistent profile cache hit:', username);
      return;
    }
    const profile = await movieProvider.getUserProfile(username);
    const ttl = profile.warnings.length ? 300 : envNumber('PROFILE_CACHE_TTL_SECONDS', 86400);
    await saveProfileSnapshot(key, profile, ttl);
  } catch (error) {
    if (error instanceof AppError && !error.retryable) throw new FatalError(publicError(error));
    throw new Error(
      error instanceof AppError
        ? publicError(error)
        : 'Um serviço temporário impediu a coleta do perfil.',
    );
  }
}

async function enrichAndComplete(jobId: string, usernameA: string, usernameB: string) {
  'use step';
  const [a, b] = await Promise.all([
    getProfileSnapshot(snapshotKey(usernameA)),
    getProfileSnapshot(snapshotKey(usernameB)),
  ]);
  if (!a || !b) throw new FatalError('Os perfis coletados não foram encontrados.');
  const result = await completeComparison(a, b);
  await completeJob(jobId, result);
}

async function markFailed(jobId: string, message: string) {
  'use step';
  await failJob(jobId, message);
}

export async function runMatchWorkflow(jobId: string, usernameA: string, usernameB: string) {
  'use workflow';
  try {
    await setProgress(jobId, 'collecting_profiles', 10);
    await collectProfile(usernameA);
    // Keep collection conservative across serverless invocations and paid upstream requests.
    await setProgress(jobId, 'collecting_profiles', 30);
    await collectProfile(usernameB);
  } catch (error) {
    console.error('[workflow] profile collection failed', error);
    await markFailed(
      jobId,
      'Não foi possível coletar um dos perfis. Confira os logs do Workflow e tente novamente.',
    );
    return { jobId };
  }

  try {
    await setProgress(jobId, 'calculating_match', 50);
    await setProgress(jobId, 'enriching_movies', 60);
    await enrichAndComplete(jobId, usernameA, usernameB);
  } catch (error) {
    console.error('[workflow] comparison failed', error);
    await markFailed(
      jobId,
      'Os perfis foram coletados, mas não foi possível calcular o resultado. Tente novamente.',
    );
  }
  return { jobId };
}
