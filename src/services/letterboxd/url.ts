import { AppError } from '@/lib/errors';
export function letterboxdUrl(path: string): URL {
  const url = new URL(path, 'https://letterboxd.com');
  if (
    url.origin !== 'https://letterboxd.com' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/[a-zA-Z0-9_-]+\/(?:films\/|watchlist\/)?(?:page\/[1-9]\d*\/)?$/.test(url.pathname)
  )
    throw new AppError('parser');
  return url;
}
