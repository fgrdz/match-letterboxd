import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const html = readFileSync(new URL('./fixtures/films.html', import.meta.url), 'utf8');
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('LETTERBOXD_TRANSPORT', 'brightdata');
  vi.stubEnv('BRIGHTDATA_API_KEY', 'test-secret');
  vi.stubEnv('BRIGHTDATA_ZONE', 'web_unlocker1');
  vi.stubEnv('BRIGHTDATA_MAX_REQUESTS_PER_HOUR', '100');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const envelope = (status = 200, body = html) =>
  Response.json({ status_code: status, headers: { 'content-type': 'text/html' }, body });
it('routes the scraper through the selected paid transport', async () => {
  vi.stubEnv('LETTERBOXD_MAX_PAGES', '1');
  const fetch = vi.fn().mockResolvedValue(envelope());
  vi.stubGlobal('fetch', fetch);
  const { scrapeCollection } = await import('@/services/letterboxd/scraper');
  const result = await scrapeCollection('jack', 'films');
  expect(result.movies).toHaveLength(3);
  expect(result.partial).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it.each([404, 401])('preserves target status %i semantics', async (status) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(envelope(status)));
  const { fetchLetterboxd } = await import('@/services/letterboxd/client');
  await expect(fetchLetterboxd('/jack/films/')).rejects.toMatchObject({
    code: status === 404 ? 'not_found' : 'private',
  });
});
it('does not retry paid timeouts or log secrets from network exceptions', async () => {
  const fetch = vi.fn().mockRejectedValue(new DOMException('test-secret', 'TimeoutError'));
  vi.stubGlobal('fetch', fetch);
  const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { fetchLetterboxd } = await import('@/services/letterboxd/client');
  await expect(fetchLetterboxd('/jack/films/')).rejects.toMatchObject({ code: 'scraping_timeout' });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(log.mock.calls)).not.toContain('test-secret');
});
it('rejects HTTP 200 challenge pages and pauses the selected transport', async () => {
  const fetch = vi.fn().mockResolvedValue(envelope(200, '<title>Just a moment...</title>'));
  vi.stubGlobal('fetch', fetch);
  const { fetchLetterboxd } = await import('@/services/letterboxd/client');
  await expect(fetchLetterboxd('/jack/films/')).rejects.toMatchObject({ code: 'blocked' });
  await expect(fetchLetterboxd('/jack/films/')).rejects.toMatchObject({ code: 'blocked' });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('keeps direct cooldown separate from the explicitly selected managed transport', async () => {
  vi.stubEnv('LETTERBOXD_TRANSPORT', 'direct');
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response('blocked', { status: 403 }))
    .mockResolvedValueOnce(envelope());
  vi.stubGlobal('fetch', fetch);
  const { fetchLetterboxd } = await import('@/services/letterboxd/client');
  await expect(fetchLetterboxd('/jack/films/')).rejects.toMatchObject({ code: 'blocked' });
  vi.stubEnv('LETTERBOXD_TRANSPORT', 'brightdata');
  expect(await fetchLetterboxd('/jack/films/')).toBe(html);
  expect(fetch).toHaveBeenCalledTimes(2);
});
it('fails closed on an unknown transport', async () => {
  vi.stubEnv('LETTERBOXD_TRANSPORT', 'typo');
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const { fetchLetterboxd } = await import('@/services/letterboxd/client');
  await expect(fetchLetterboxd('/jack/films/')).rejects.toMatchObject({ code: 'scraping_config' });
  expect(fetch).not.toHaveBeenCalled();
});
