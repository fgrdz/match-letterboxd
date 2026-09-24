import { FatalError } from 'workflow';
import { calculateMatch } from '@/domain/match/calculateMatch';
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

async function calculateCore(usernameA: string, usernameB: string) {
  'use step';
  try {
    const [a, b] = await Promise.all([
      getProfileSnapshot(snapshotKey(usernameA)),
      getProfileSnapshot(snapshotKey(usernameB)),
    ]);
    if (!a || !b) throw new FatalError('Os perfis coletados não foram encontrados.');
    const match = calculateMatch(a, b);
    console.info(`[match] core calculated from ${match.stats.ratedByBoth} comparable movies`);
  } catch (error) {
    if (error instanceof FatalError) throw error;
    throw new Error('Não foi possível calcular o resultado agora.');
  }
}

async function enrichAndComplete(jobId: string, usernameA: string, usernameB: string) {
  'use step';
  try {
    const [a, b] = await Promise.all([
      getProfileSnapshot(snapshotKey(usernameA)),
      getProfileSnapshot(snapshotKey(usernameB)),
    ]);
    if (!a || !b) throw new FatalError('Os perfis coletados não foram encontrados.');
    const result = await completeComparison(a, b);
    await completeJob(jobId, result);
  } catch (error) {
    if (error instanceof FatalError) throw error;
    throw new Error('Não foi possível concluir o enriquecimento dos filmes agora.');
  }
}

async function markFailed(jobId: string, message: string) {
  'use step';
  await failJob(jobId, message);
}

function workflowErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Não foi possível concluir a comparação. Tente novamente mais tarde.';
}

export async function runMatchWorkflow(jobId: string, usernameA: string, usernameB: string) {
  'use workflow';
  try {
    await setProgress(jobId, 'collecting_profiles', 10);
    await collectProfile(usernameA);
    // Keep collection conservative across serverless invocations and paid upstream requests.
    await setProgress(jobId, 'collecting_profiles', 30);
    await collectProfile(usernameB);
    await setProgress(jobId, 'calculating_match', 50);
    await calculateCore(usernameA, usernameB);
    await setProgress(jobId, 'enriching_movies', 60);
    await enrichAndComplete(jobId, usernameA, usernameB);
  } catch (error) {
    await markFailed(jobId, workflowErrorMessage(error));
  }
  return { jobId };
}
