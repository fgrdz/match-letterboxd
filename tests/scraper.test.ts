import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';
import { scrapeCollection } from '@/services/letterboxd/scraper';
import { fetchLetterboxd } from '@/services/letterboxd/client';
vi.mock('@/services/letterboxd/client', () => ({ fetchLetterboxd: vi.fn() }));
const html = readFileSync(new URL('./fixtures/films.html', import.meta.url), 'utf8');
beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
it('walks pages sequentially and deduplicates movies', async () => {
  vi.mocked(fetchLetterboxd)
    .mockResolvedValueOnce(html)
    .mockResolvedValueOnce(html.replace('class="next"', 'class="last"'));
  const result = await scrapeCollection('jack', 'films');
  expect(result.movies).toHaveLength(3);
  expect(result.partial).toBe(false);
  expect(fetchLetterboxd).toHaveBeenNthCalledWith(2, '/jack/films/page/2/');
});
it('marks page-limited profiles partial', async () => {
  vi.stubEnv('LETTERBOXD_MAX_PAGES', '1');
  vi.mocked(fetchLetterboxd).mockResolvedValue(html);
  expect((await scrapeCollection('jack', 'films')).partial).toBe(true);
  expect(fetchLetterboxd).toHaveBeenCalledTimes(1);
});
it('rejects repeated or foreign pagination links', async () => {
  vi.mocked(fetchLetterboxd).mockResolvedValue(
    html.replace(
      'class="next" href="/jack/films/page/2/"',
      'class="next" href="https://evil.com/"',
    ),
  );
  await expect(scrapeCollection('jack', 'films')).rejects.toMatchObject({ code: 'parser' });
  expect(fetchLetterboxd).toHaveBeenCalledTimes(1);
});
