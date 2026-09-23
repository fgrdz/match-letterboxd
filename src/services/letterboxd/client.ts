import 'server-only';
import { AppError } from '@/lib/errors';
import { envNumber } from '@/lib/config';
import { RequestQueue, sleep } from '@/lib/http/queue';
import { isProtectionPage } from './parsers/protection';
import { letterboxdUrl } from './url';
import { getTransport } from './transports';
export { letterboxdUrl } from './url';
const queue = new RequestQueue(envNumber('LETTERBOXD_REQUEST_DELAY_MS', 600, 500));
const blockedUntil = new Map<string, number>();
function pause(transport: string, retryAfter: string | null) {
  const seconds = retryAfter === null ? NaN : Number(retryAfter);
  const until = Number.isFinite(seconds)
    ? Date.now() + Math.max(0, seconds) * 1000
    : Date.parse(retryAfter ?? '');
  blockedUntil.set(transport, Math.max(Date.now() + 900000, Number.isFinite(until) ? until : 0));
}
export async function fetchLetterboxd(path: string): Promise<string> {
  const url = letterboxdUrl(path);
  const transport = getTransport();
  for (let attempt = 0; attempt < transport.maxAttempts; attempt++) {
    try {
      return await queue.run(async () => {
        if (Date.now() < (blockedUntil.get(transport.name) ?? 0)) throw new AppError('blocked');
        console.info('[letterboxd] fetching', { path: url.pathname, transport: transport.name });
        const response = await transport.fetchPage(url);
        if ([403, 429].includes(response.status)) {
          pause(transport.name, response.headers.get('retry-after'));
          throw new AppError('blocked');
        }
        if (response.status === 404) throw new AppError('not_found');
        if (response.status === 401) throw new AppError('private');
        // Redirect responses are not followed by our client.
        if (response.status >= 300 && response.status < 400) throw new AppError('private');
        if (response.status >= 400)
          throw new AppError('unavailable', [408, 500, 502, 503, 504].includes(response.status));
        if (isProtectionPage(response.html)) {
          pause(transport.name, null);
          throw new AppError('blocked');
        }
        if (!response.headers.get('content-type')?.includes('text/html'))
          throw new AppError('parser');
        return response.html;
      });
    } catch (error) {
      const timeout = error instanceof Error && /timeout|abort/i.test(error.name);
      const code =
        transport.name === 'brightdata'
          ? timeout
            ? 'scraping_timeout'
            : 'scraping_unavailable'
          : timeout
            ? 'timeout'
            : 'unavailable';
      const normalized = error instanceof AppError ? error : new AppError(code, true);
      if (attempt + 1 < transport.maxAttempts && normalized.retryable) {
        await sleep(1200);
        continue;
      }
      console.warn('[letterboxd] request failed', {
        path: url.pathname,
        transport: transport.name,
        code: normalized.code,
      });
      throw normalized;
    }
  }
  throw new AppError('unavailable');
}
