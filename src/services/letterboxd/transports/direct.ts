import 'server-only';
import { envNumber } from '@/lib/config';
import type { PageTransport } from './types';
export const directTransport: PageTransport = {
  name: 'direct',
  maxAttempts: 2,
  async fetchPage(url) {
    const response = await fetch(url, {
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(envNumber('LETTERBOXD_TIMEOUT_MS', 15000, 1000, 60000)),
      headers: {
        'User-Agent':
          process.env.LETTERBOXD_USER_AGENT ||
          'LetterboxdMatch/0.1 (personal non-commercial comparison)',
        Accept: 'text/html',
      },
    });
    return { status: response.status, headers: response.headers, html: await response.text() };
  },
};
