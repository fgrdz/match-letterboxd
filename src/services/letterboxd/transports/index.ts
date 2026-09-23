import 'server-only';
import { AppError } from '@/lib/errors';
import { BrightDataTransport } from './brightdata';
import { directTransport } from './direct';
import type { PageTransport } from './types';
const brightdata = new BrightDataTransport();
export function getTransport(): PageTransport {
  const name = process.env.LETTERBOXD_TRANSPORT?.trim() || 'direct';
  if (name === 'direct') return directTransport;
  if (name === 'brightdata') return brightdata;
  throw new AppError('scraping_config');
}
