import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/movie-poster/route';
import { enrichMovie } from '@/services/tmdb/client';
vi.mock('@/services/tmdb/client', () => ({ enrichMovie: vi.fn() }));
const movie = { slug: 'alien', title: 'Alien', year: 1979, letterboxdId: '123' };
const request = (body: unknown = movie, origin = 'http://localhost:3000') =>
  new Request('http://localhost:3000/api/movie-poster', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('TMDB_API_KEY', 'server-secret');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it('returns only the poster, without ratings, credentials or other metadata', async () => {
  vi.mocked(enrichMovie).mockResolvedValue({
    posterUrl: 'https://image.tmdb.org/t/p/w500/alien.jpg',
    genres: ['Horror'],
    runtime: 110,
  });
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ posterUrl: 'https://image.tmdb.org/t/p/w500/alien.jpg' });
  expect(enrichMovie).toHaveBeenCalledWith(movie);
});
it.each([
  { ...movie, slug: '../admin' },
  { ...movie, title: '' },
  { ...movie, year: '1979' },
  { ...movie, tmdbId: -1 },
  { ...movie, letterboxdId: 'https://evil.com' },
  null,
])('rejects invalid lookup input without fetching', async (body) => {
  expect((await POST(request(body))).status).toBe(400);
  expect(enrichMovie).not.toHaveBeenCalled();
});
it('bounds request size before parsing', async () => {
  expect((await POST(request({ ...movie, extra: 'x'.repeat(5000) }))).status).toBe(413);
  expect(enrichMovie).not.toHaveBeenCalled();
});
it('rejects cross-origin requests', async () => {
  expect((await POST(request(movie, 'https://other.test'))).status).toBe(403);
  expect(enrichMovie).not.toHaveBeenCalled();
});
it('accepts the browser host when Next normalizes the internal request URL', async () => {
  vi.mocked(enrichMovie).mockResolvedValue({});
  const input = request(movie, 'http://127.0.0.1:3005');
  input.headers.set('host', '127.0.0.1:3005');
  expect((await POST(input)).status).toBe(200);
});
it('keeps absent configuration and unmatched titles as normal empty results', async () => {
  vi.stubEnv('TMDB_API_KEY', '');
  expect(await (await POST(request())).json()).toEqual({ posterUrl: null });
  expect(enrichMovie).not.toHaveBeenCalled();
  vi.stubEnv('TMDB_API_KEY', 'server-secret');
  vi.mocked(enrichMovie).mockResolvedValue({});
  expect(await (await POST(request())).json()).toEqual({ posterUrl: null });
});
it('returns a temporary error without leaking upstream details', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.mocked(enrichMovie).mockRejectedValue(new Error('url?api_key=server-secret'));
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(response.headers.get('retry-after')).toBe('30');
  expect(await response.text()).not.toContain('server-secret');
});
