import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrightDataTransport } from '@/services/letterboxd/transports/brightdata';
import { parseMoviesPage } from '@/services/letterboxd/parsers/pages';
const url = new URL('https://letterboxd.com/jack/films/');
const html = readFileSync(new URL('./fixtures/films.html', import.meta.url), 'utf8');
const envelope = (status = 200) =>
  Response.json({
    status_code: status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: html,
  });
beforeEach(() => {
  vi.stubEnv('BRIGHTDATA_API_KEY', 'test-only-secret');
  vi.stubEnv('BRIGHTDATA_ZONE', 'web_unlocker1');
  vi.stubEnv('BRIGHTDATA_MAX_REQUESTS_PER_HOUR', '100');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('Bright Data transport', () => {
  it('uses the fixed API, server auth and a validated target; existing parser accepts the returned HTML', async () => {
    const fetch = vi.fn().mockResolvedValue(envelope());
    vi.stubGlobal('fetch', fetch);
    const result = await new BrightDataTransport().fetchPage(url);
    const [endpoint, options] = fetch.mock.calls[0];
    expect(endpoint).toBe('https://api.brightdata.com/request');
    expect(options).toMatchObject({
      method: 'POST',
      redirect: 'error',
      cache: 'no-store',
      headers: { Authorization: 'Bearer test-only-secret' },
    });
    expect(JSON.parse(options.body)).toEqual({
      zone: 'web_unlocker1',
      url: url.href,
      format: 'json',
      method: 'GET',
    });
    expect(options.body).not.toContain('test-only-secret');
    expect(result.status).toBe(200);
    expect(result.headers.get('content-type')).toContain('text/html');
    expect(parseMoviesPage(result.html, 'jack').movies).toHaveLength(3);
  });
  it.each(['BRIGHTDATA_API_KEY', 'BRIGHTDATA_ZONE'])(
    'requires %s before any network request',
    async (name) => {
      vi.stubEnv(name, '');
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);
      await expect(new BrightDataTransport().fetchPage(url)).rejects.toMatchObject({
        code: 'scraping_config',
      });
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it('rejects foreign destinations before contacting the paid API', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(
      new BrightDataTransport().fetchPage(new URL('https://example.com/')),
    ).rejects.toMatchObject({ code: 'parser' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    [400, 'scraping_config'],
    [401, 'scraping_config'],
    [403, 'scraping_config'],
    [402, 'scraping_payment'],
    [429, 'scraping_rate_limit'],
    [500, 'scraping_unavailable'],
  ])('maps provider HTTP %i without exposing its response body', async (status, code) => {
    const fetch = vi.fn().mockResolvedValue(new Response('test-only-secret', { status }));
    vi.stubGlobal('fetch', fetch);
    const error = await new BrightDataTransport().fetchPage(url).catch((e) => e);
    expect(error.code).toBe(code);
    expect(error.message).not.toContain('test-only-secret');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('keeps a target 404 distinct from provider authentication errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(envelope(404)));
    expect((await new BrightDataTransport().fetchPage(url)).status).toBe(404);
  });
  it.each([
    {},
    { status_code: '200', body: html, headers: {} },
    { status_code: 200, body: {}, headers: {} },
    { status_code: 200, body: html, headers: [] },
  ])('rejects malformed envelopes', async (payload) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(payload)));
    await expect(new BrightDataTransport().fetchPage(url)).rejects.toMatchObject({
      code: 'scraping_response',
    });
  });
  it('rejects a non-JSON response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(html)));
    await expect(new BrightDataTransport().fetchPage(url)).rejects.toMatchObject({
      code: 'scraping_response',
    });
  });
  it('counts failures in the rolling budget and recovers after one hour', async () => {
    vi.useFakeTimers();
    vi.stubEnv('BRIGHTDATA_MAX_REQUESTS_PER_HOUR', '1');
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('error', { status: 500 }))
      .mockResolvedValueOnce(envelope());
    vi.stubGlobal('fetch', fetch);
    const transport = new BrightDataTransport();
    await expect(transport.fetchPage(url)).rejects.toMatchObject({ code: 'scraping_unavailable' });
    await expect(transport.fetchPage(url)).rejects.toMatchObject({ code: 'scraping_budget' });
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3600001);
    expect((await transport.fetchPage(url)).status).toBe(200);
  });
});
