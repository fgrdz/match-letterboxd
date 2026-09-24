import { NextResponse } from 'next/server';
import { getJob } from '@/services/jobs/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!uuid.test(id)) return NextResponse.json({ error: 'Comparação inválida.' }, { status: 400 });
  try {
    const job = await getJob(id);
    if (!job) return NextResponse.json({ error: 'Comparação não encontrada.' }, { status: 404 });
    return NextResponse.json(job, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    console.error(
      '[jobs] failed to read comparison',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: 'Não foi possível consultar a comparação agora.' },
      { status: 503 },
    );
  }
}
