import { FatalError } from 'workflow';
import { envNumber } from '@/lib/config';
import { AppError, publicError } from '@/lib/errors';
import { completeComparison } from '@/services/compareProfiles';
import {
  completeJob,
  failJob,
  getProfileSnapshot,
  saveProfileSnapshot,
  saveEnrichedSnapshot,
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

async function collectProfile(jobId: string, username: string) {
  'use step';
  const started = Date.now();
  try {
    await updateJobProgress(jobId, 'collecting_profiles', 10);
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
  } finally {
    console.info('[workflow] profile duration', { username, ms: Date.now() - started });
  }
}

async function enrichAndComplete(jobId: string, usernameA: string, usernameB: string) {
  'use step';
  const started = Date.now();
  await updateJobProgress(jobId, 'enriching_movies', 60);
  const [a, b] = await Promise.all([
    getProfileSnapshot(snapshotKey(usernameA)),
    getProfileSnapshot(snapshotKey(usernameB)),
  ]);
  if (!a || !b) throw new FatalError('Os perfis coletados não foram encontrados.');
  const result = await completeComparison(a, b);
  await completeJob(jobId, result);
  // Best effort: an optional cache write must not repeat the entire enrichment.
  try {
    await Promise.all([
      saveEnrichedSnapshot(snapshotKey(usernameA), result.a),
      saveEnrichedSnapshot(snapshotKey(usernameB), result.b),
    ]);
  } catch {
    console.warn('[workflow] enriched profile cache write failed');
  }
  console.info('[workflow] comparison duration', { jobId, ms: Date.now() - started });
}

async function markFailed(jobId: string, message: string) {
  'use step';
  await failJob(jobId, message);
}

export async function runMatchWorkflow(jobId: string, usernameA: string, usernameB: string) {
  'use workflow';
  try {
    // At most two profile steps. Pagination remains sequential within each profile.
    const usernames = [...new Set([usernameA, usernameB])];
    const collected = await Promise.allSettled(
      usernames.map((username) => collectProfile(jobId, username)),
    );
    const failed = collected.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
  } catch (error) {
    console.error('[workflow] profile collection failed', error);
    await markFailed(
      jobId,
      'Não foi possível coletar um dos perfis. Confira os logs do Workflow e tente novamente.',
    );
    return { jobId };
  }

  try {
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
