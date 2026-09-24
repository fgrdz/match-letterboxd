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
  result: StoredMatchResult | null;
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

function toJob(row: JobRow): MatchJob {
  return {
    id: row.id,
    usernameA: row.username_a,
    usernameB: row.username_b,
    status: row.status,
    stage: row.stage,
    progress: row.progress,
    workflowRunId: row.workflow_run_id ?? undefined,
    result: row.result ?? undefined,
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
  await database()`
    update match_jobs
    set status = 'completed', stage = 'completed', progress = 100,
        result = ${JSON.stringify(result)}::jsonb, error_message = null,
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
  const rows = await database()<Array<{ profile: UserProfile }>>`
    select profile from profile_snapshots
    where cache_key = ${cacheKey} and expires_at > now()
    limit 1
  `;
  return rows[0]?.profile ? structuredClone(rows[0].profile) : undefined;
}

export async function saveProfileSnapshot(
  cacheKey: string,
  profile: UserProfile,
  ttlSeconds: number,
): Promise<void> {
  await ensureSchema();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  await database()`
    insert into profile_snapshots (cache_key, username, profile, fetched_at, expires_at)
    values (
      ${cacheKey}, ${profile.username}, ${JSON.stringify(profile)}::jsonb, now(), ${expiresAt}
    )
    on conflict (cache_key) do update
    set profile = excluded.profile, fetched_at = now(), expires_at = excluded.expires_at
  `;
}
