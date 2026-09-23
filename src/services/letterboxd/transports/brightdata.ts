import 'server-only';
import { envNumber } from '@/lib/config';
import { AppError } from '@/lib/errors';
import { letterboxdUrl } from '../url';
import type { PageResponse, PageTransport } from './types';

function credentials() {
  const apiKey = process.env.BRIGHTDATA_API_KEY?.trim();
  const zone = process.env.BRIGHTDATA_ZONE?.trim();
  if (!apiKey || /\s/.test(apiKey) || !zone || !/^[a-zA-Z0-9_-]+$/.test(zone))
    throw new AppError('scraping_config');
  return { apiKey, zone };
}
function decode(value: unknown): PageResponse {
  if (
    !value ||
    typeof value !== 'object' ||
    !('status_code' in value) ||
    !Number.isInteger(value.status_code) ||
    typeof value.status_code !== 'number' ||
    value.status_code < 200 ||
    value.status_code > 599 ||
    !('body' in value) ||
    typeof value.body !== 'string' ||
    !('headers' in value) ||
    !value.headers ||
    typeof value.headers !== 'object' ||
    Array.isArray(value.headers)
  )
    throw new AppError('scraping_response');
  const headers = new Headers();
  for (const [name, content] of Object.entries(value.headers)) {
    if (['content-type', 'retry-after'].includes(name.toLowerCase()) && typeof content === 'string')
      headers.set(name, content);
  }
  return { status: value.status_code, headers, html: value.body };
}
/** Rolling-hour attempt budget. Includes failures/timeouts; local to this process. */
export class BrightDataTransport implements PageTransport {
  readonly name = 'brightdata';
  readonly maxAttempts = 1; // Provider handles its own retries; never multiply paid requests here.
  private attempts: number[] = [];
  async fetchPage(url: URL): Promise<PageResponse> {
    const target = letterboxdUrl(url.href);
    const { apiKey, zone } = credentials();
    const now = Date.now();
    this.attempts = this.attempts.filter((at) => at > now - 3600000);
    if (this.attempts.length >= envNumber('BRIGHTDATA_MAX_REQUESTS_PER_HOUR', 100, 1, 10000))
      throw new AppError('scraping_budget');
    this.attempts.push(now);
    const response = await fetch('https://api.brightdata.com/request', {
      method: 'POST',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(envNumber('BRIGHTDATA_TIMEOUT_MS', 60000, 1000, 180000)),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ zone, url: target.href, format: 'json', method: 'GET' }),
    });
    // Outer status belongs to the provider. Inner status belongs to Letterboxd.
    if ([400, 401, 403].includes(response.status)) throw new AppError('scraping_config');
    if (response.status === 402) throw new AppError('scraping_payment');
    if (response.status === 429) throw new AppError('scraping_rate_limit');
    if (!response.ok) throw new AppError('scraping_unavailable');
    try {
      return decode(await response.json());
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof Error && /timeout|abort/i.test(error.name)) throw error;
      throw new AppError('scraping_response');
    }
  }
}
