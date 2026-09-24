import { NextResponse } from 'next/server';
import { start } from 'workflow/api';
import { publicError } from '@/lib/errors';
import { validateUsername } from '@/lib/validation/username';
import { attachWorkflowRun, createOrReuseJob, failJob } from '@/services/jobs/repository';
import { runMatchWorkflow } from '@/workflows/match';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface RequestBody {
  a?: unknown;
  b?: unknown;
}

export async function POST(request: Request) {
  let createdJobId: string | undefined;
  try {
    const body = (await request.json()) as RequestBody;
    const usernameA = validateUsername(body.a);
    const usernameB = validateUsername(body.b);
    const { job, reused } = await createOrReuseJob(usernameA, usernameB);
    createdJobId = job.id;
    if (!reused) {
      const run = await start(runMatchWorkflow, [job.id, usernameA, usernameB]);
      await attachWorkflowRun(job.id, run.runId);
    }
    return NextResponse.json(
      { jobId: job.id, href: `/match/${job.id}`, reused },
      { status: reused && job.status === 'completed' ? 200 : 202 },
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message.startsWith('Banco não configurado.')
        ? error.message
        : publicError(error);
    console.error(
      '[jobs] failed to create comparison',
      error instanceof Error ? error.name : 'unexpected',
    );
    if (createdJobId) await failJob(createdJobId, message).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
