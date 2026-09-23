import { enrichMovie } from '@/services/tmdb/client';
import { validatePosterMovie } from '@/lib/validation/posterMovie';
import { AppError } from '@/lib/errors';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };
export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  if (origin) {
    // Next can normalize request.url to localhost even when the browser uses 127.0.0.1.
    const host = request.headers.get('host') ?? new URL(request.url).host;
    let allowed = false;
    try {
      const url = new URL(origin);
      allowed = ['http:', 'https:'].includes(url.protocol) && url.host === host;
    } catch {
      /* Invalid Origin. */
    }
    if (!allowed) return Response.json({ error: 'Origem inválida.' }, { status: 403, headers });
  }
  if (!request.headers.get('content-type')?.includes('application/json'))
    return Response.json({ error: 'Envie JSON.' }, { status: 415, headers });
  // Read with a bound, including chunked bodies without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: 'Filme inválido.' }, { status: 400, headers });
  let size = 0,
    raw = '';
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        return Response.json({ error: 'Dados muito grandes.' }, { status: 413, headers });
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } catch {
    return Response.json({ error: 'Filme inválido.' }, { status: 400, headers });
  } finally {
    reader.releaseLock();
  }
  let movie;
  try {
    movie = validatePosterMovie(JSON.parse(raw));
  } catch {
    /* Invalid JSON. */
  }
  if (!movie) return Response.json({ error: 'Filme inválido.' }, { status: 400, headers });
  if (!process.env.TMDB_API_KEY) return Response.json({ posterUrl: null }, { headers });
  try {
    const metadata = await enrichMovie(movie);
    return Response.json({ posterUrl: metadata.posterUrl ?? null }, { headers });
  } catch (error) {
    console.warn('[tmdb] poster unavailable');
    return Response.json(
      { error: 'Não foi possível carregar a capa agora.' },
      {
        status: error instanceof AppError && error.code === 'busy' ? 429 : 503,
        headers: { ...headers, 'Retry-After': '30' },
      },
    );
  }
}
