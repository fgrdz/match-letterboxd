import 'server-only';
import postgres, { type Sql } from 'postgres';
import type { UserProfile } from '@/domain/models';
import { formulaVersion } from '@/domain/match/formula';
import { envNumber } from '@/lib/config';
import type {
  CreatedMatchJob,
  MatchJob,
  MatchJobStage,
  MatchJobStatus,
  StoredMatchResult,
} from './types';

interface JobRow {
  id: string;
  username_a: string;
  username_b: string;
  status: MatchJobStatus;
  stage: MatchJobStage;
  progress: number;
  workflow_run_id: string | null;
  result: unknown;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

let client: Sql | undefined;
let schemaPromise: Promise<void> | undefined;

function connectionString(): string {
  const value = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!value) {
    throw new Error(
      'Banco não configurado. Conecte um Postgres pelo Vercel Marketplace e defina DATABASE_URL.',
    );
  }
  return value;
}

function database(): Sql {
  if (client) return client;
  const url = connectionString();
  const local = /^postgres(?:ql)?:\/\/(?:[^@]+@)?(?:localhost|127\.0\.0\.1)(?::|\/)/i.test(url);
  client = postgres(url, {
    max: 2,
    prepare: false,
    ssl: local ? false : 'require',
    connect_timeout: 10,
    idle_timeout: 20,
  });
  return client;
}

async function ensureSchema(): Promise<void> {
  if (schemaPromise) return schemaPromise;
  const sql = database();
  schemaPromise = (async () => {
    // A warm database needs one read, not four DDL statements per cold instance.
    const [schema] = await sql<Array<{ ready: boolean }>>`
      select to_regclass('match_jobs') is not null
        and to_regclass('profile_snapshots') is not null
        and to_regclass('match_jobs_reuse_idx') is not null
        and to_regclass('profile_snapshots_expiry_idx') is not null as ready
    `;
    if (schema.ready) return;
    await sql`
      create table if not exists match_jobs (
        id uuid primary key,
        username_a text not null,
        username_b text not null,
        pair_key text not null,
        formula_version text not null,
        status text not null check (status in ('queued', 'running', 'completed', 'failed')),
        stage text not null,
        progress integer not null default 0 check (progress between 0 and 100),
        workflow_run_id text,
        result jsonb,
        error_message text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        completed_at timestamptz
      )
    `;
    await sql`
      create index if not exists match_jobs_reuse_idx
      on match_jobs (pair_key, formula_version, created_at desc)
    `;
    await sql`
      create table if not exists profile_snapshots (
        cache_key text primary key,
        username text not null,
        profile jsonb not null,
        fetched_at timestamptz not null default now(),
        expires_at timestamptz not null
      )
    `;
    await sql`
      create index if not exists profile_snapshots_expiry_idx
      on profile_snapshots (expires_at)
    `;
  })().catch((error) => {
    schemaPromise = undefined;
    throw error;
  });
  return schemaPromise;
}

function pairKey(usernameA: string, usernameB: string): string {
  return [usernameA.toLowerCase(), usernameB.toLowerCase()].sort().join(':');
}

/** Older writes could store a JSON string inside jsonb instead of an object. */
function decodeStoredJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function isStoredProfile(value: unknown): value is UserProfile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Partial<UserProfile>;
  return (
    typeof profile.username === 'string' &&
    typeof profile.fetchedAt === 'string' &&
    Array.isArray(profile.movies) &&
    Array.isArray(profile.warnings) &&
    (profile.watchlist === undefined || Array.isArray(profile.watchlist))
  );
}

function readStoredResult(value: unknown): StoredMatchResult | undefined {
  const decoded = decodeStoredJson(value);
  if (!decoded || typeof decoded !== 'object') return undefined;
  const result = decoded as Partial<StoredMatchResult>;
  if (
    !isStoredProfile(result.a) ||
    !isStoredProfile(result.b) ||
    !result.match ||
    !Array.isArray(result.warnings) ||
    typeof result.tmdbEnabled !== 'boolean'
  ) {
    return undefined;
  }
  return result as StoredMatchResult;
}

function toJob(row: JobRow): MatchJob {
  return {
    id: row.id,
    usernameA: row.username_a,
    usernameB: row.username_b,
    status: row.status,
    stage: row.stage,
    progress: row.progress,
    workflowRunId: row.workflow_run_id ?? undefined,
    result: readStoredResult(row.result),
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    completedAt: row.completed_at?.toISOString(),
  };
}

export async function createOrReuseJob(
  usernameA: string,
  usernameB: string,
): Promise<CreatedMatchJob> {
  await ensureSchema();
  const sql = database();
  const cutoff = new Date(
    Date.now() - envNumber('MATCH_RESULT_TTL_SECONDS', 86400, 60, 2592000) * 1000,
  );
  const existing = await sql<JobRow[]>`
    select * from match_jobs
    where pair_key = ${pairKey(usernameA, usernameB)}
      and formula_version = ${formulaVersion}
      and created_at >= ${cutoff}
      and status in ('queued', 'running', 'completed')
    order by created_at desc
    limit 1
  `;
  if (existing[0]) return { job: toJob(existing[0]), reused: true };

  const id = crypto.randomUUID();
  const inserted = await sql<JobRow[]>`
    insert into match_jobs (
      id, username_a, username_b, pair_key, formula_version, status, stage, progress
    ) values (
      ${id}, ${usernameA}, ${usernameB}, ${pairKey(usernameA, usernameB)},
      ${formulaVersion}, 'queued', 'queued', 0
    )
    returning *
  `;
  return { job: toJob(inserted[0]), reused: false };
}

export async function getJob(id: string): Promise<MatchJob | undefined> {
  await ensureSchema();
  const rows = await database()<JobRow[]>`select * from match_jobs where id = ${id} limit 1`;
  return rows[0] ? toJob(rows[0]) : undefined;
}

export async function attachWorkflowRun(id: string, runId: string): Promise<void> {
  await ensureSchema();
  await database()`
    update match_jobs
    set workflow_run_id = ${runId}, updated_at = now()
    where id = ${id}
  `;
}

export async function updateJobProgress(
  id: string,
  stage: MatchJobStage,
  progress: number,
): Promise<void> {
  await ensureSchema();
  await database()`
    update match_jobs
    set status = 'running', stage = ${stage}, progress = ${progress}, updated_at = now()
    where id = ${id} and status <> 'completed'
  `;
}

export async function completeJob(id: string, result: StoredMatchResult): Promise<void> {
  await ensureSchema();
  // Explicit text typing prevents the driver's JSON serializer from encoding this string again.
  await database()`
    update match_jobs
    set status = 'completed', stage = 'completed', progress = 100,
        result = ${JSON.stringify(result)}::text::jsonb, error_message = null,
        completed_at = now(), updated_at = now()
    where id = ${id}
  `;
}

export async function failJob(id: string, message: string): Promise<void> {
  await ensureSchema();
  await database()`
    update match_jobs
    set status = 'failed', stage = 'failed', error_message = ${message}, updated_at = now()
    where id = ${id}
  `;
}

export async function getProfileSnapshot(cacheKey: string): Promise<UserProfile | undefined> {
  await ensureSchema();
  const rows = await database()<Array<{ profile: unknown }>>`
    select profile from profile_snapshots
    where cache_key = ${cacheKey} and expires_at > now()
    limit 1
  `;
  if (!rows[0]) return undefined;
  const profile = decodeStoredJson(rows[0].profile);
  if (!isStoredProfile(profile)) {
    console.warn('[jobs] invalid profile snapshot; recollection required');
    return undefined;
  }
  return structuredClone(profile);
}

export async function saveProfileSnapshot(
  cacheKey: string,
  profile: UserProfile,
  ttlSeconds: number,
): Promise<void> {
  await ensureSchema();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  // Serialize once: send text, then let PostgreSQL cast it to a JSON object.
  await database()`
    insert into profile_snapshots (cache_key, username, profile, fetched_at, expires_at)
    values (
      ${cacheKey}, ${profile.username}, ${JSON.stringify(profile)}::text::jsonb, now(), ${expiresAt}
    )
    on conflict (cache_key) do update
    set profile = excluded.profile, fetched_at = now(), expires_at = excluded.expires_at
  `;
}

/** Retain source freshness: enrichment must never extend the scraping TTL. */
export async function saveEnrichedSnapshot(cacheKey: string, profile: UserProfile): Promise<void> {
  await ensureSchema();
  const snapshot = { ...profile };
  delete snapshot.genreSample;
  await database()`
    update profile_snapshots
    set profile = ${JSON.stringify(snapshot)}::text::jsonb
    where cache_key = ${cacheKey} and expires_at > now()
      and (
        case when jsonb_typeof(profile) = 'string'
          then (profile #>> '{}')::jsonb
          else profile
        end
      )->>'fetchedAt' = ${profile.fetchedAt}
  `;
}
