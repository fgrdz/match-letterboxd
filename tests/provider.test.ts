import { beforeEach, expect, it, vi } from 'vitest';
import { LetterboxdProvider } from '@/services/letterboxd/LetterboxdProvider';
import { scrapeCollection } from '@/services/letterboxd/scraper';
import { AppError } from '@/lib/errors';
vi.mock('@/services/letterboxd/scraper', () => ({
  scrapeCollection: vi.fn(),
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
const collection = {
  movies: [{ slug: 'alien', title: 'Alien', liked: true }],
  partial: false,
  displayName: 'Test',
  avatarUrl: undefined,
  next: undefined,
};
it('shares in-flight profile reads and caches results without leaking mutations', async () => {
  vi.mocked(scrapeCollection).mockResolvedValue(collection);
  const provider = new LetterboxdProvider();
  const [a, b] = await Promise.all([
    provider.getUserProfile('test'),
    provider.getUserProfile('TEST'),
  ]);
  expect(scrapeCollection).toHaveBeenCalledTimes(2);
  a.movies[0].title = 'Changed';
  expect(b.movies[0].title).toBe('Alien');
  expect(b.movies[0].liked).toBe(true);
  expect((await provider.getUserProfile('test')).movies[0].title).toBe('Alien');
  expect(scrapeCollection).toHaveBeenCalledTimes(2);
});
it('preserves filmography when optional watchlist is unavailable', async () => {
  vi.mocked(scrapeCollection)
    .mockResolvedValueOnce(collection)
    .mockRejectedValueOnce(new AppError('blocked'));
  const profile = await new LetterboxdProvider().getUserProfile('test');
  expect(profile.movies).toHaveLength(1);
  expect(profile.watchlist).toBeUndefined();
  expect(profile.warnings).toHaveLength(1);
});
it('propagates essential collection failures and never caches them', async () => {
  vi.mocked(scrapeCollection).mockRejectedValue(new AppError('not_found'));
  const provider = new LetterboxdProvider();
  await expect(provider.getUserProfile('missing')).rejects.toMatchObject({ code: 'not_found' });
  await expect(provider.getUserProfile('missing')).rejects.toMatchObject({ code: 'not_found' });
  expect(scrapeCollection).toHaveBeenCalledTimes(2);
});
it('does not reuse a cached profile from another transport', async () => {
  vi.mocked(scrapeCollection).mockResolvedValue(collection);
  const provider = new LetterboxdProvider();
  vi.stubEnv('LETTERBOXD_TRANSPORT', 'direct');
  await provider.getUserProfile('test');
  vi.stubEnv('LETTERBOXD_TRANSPORT', 'brightdata');
  await provider.getUserProfile('test');
  expect(scrapeCollection).toHaveBeenCalledTimes(4);
  vi.unstubAllEnvs();
});
