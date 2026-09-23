import { beforeEach, expect, it, vi } from 'vitest';
import { compareProfiles } from '@/services/compareProfiles';
import { enrichMovie, enrichMovieGenres } from '@/services/tmdb/client';
import { demoA, demoB } from '@/domain/demo';
vi.mock('@/services/tmdb/client', () => ({ enrichMovie: vi.fn(), enrichMovieGenres: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
it('runs provider → normalized domain → enrichment → result without mutating source profiles', async () => {
  vi.mocked(enrichMovie).mockResolvedValue({ runtime: 120 });
  const provider = {
    getUserProfile: vi.fn(async (name: string) => (name === 'alex' ? demoA : demoB)),
  };
  const result = await compareProfiles(provider, 'alex', 'sam');
  expect(result.match.stats.common).toBe(6);
  expect(result.match.compatibility).toBeGreaterThan(0);
  expect(result.a.movies[0].runtime).toBe(120);
  expect(demoA.movies[0].runtime).toBeUndefined();
});
it('keeps the core match usable after a TMDB failure and stops enrichment', async () => {
  vi.mocked(enrichMovie).mockRejectedValue(new Error('unavailable'));
  const result = await compareProfiles({ getUserProfile: async () => demoA }, 'alex', 'sam');
  expect(result.match.compatibility).toBe(100);
  expect(result.warnings).toHaveLength(1);
  expect(enrichMovie).toHaveBeenCalledTimes(1);
});
it('validates usernames before calling a provider', async () => {
  const provider = { getUserProfile: vi.fn() };
  await expect(compareProfiles(provider, 'https://evil.com', 'sam')).rejects.toMatchObject({
    code: 'invalid_username',
  });
  expect(provider.getUserProfile).not.toHaveBeenCalled();
});
it('keeps the genre population independent of UI movie choices and does not mutate provider data', async () => {
  vi.stubEnv('TMDB_GENRE_SAMPLE_SIZE', '200');
  vi.stubEnv('TMDB_MAX_MOVIES', '0');
  try {
    const movies = Array.from({ length: 250 }, (_, i) => ({
      slug: `genre-${i}`,
      title: `Genre ${i}`,
      year: 2000,
    }));
    const profile = { ...demoA, movies, watchlist: [] };
    vi.mocked(enrichMovieGenres).mockResolvedValue({ genres: ['Drama'] });
    const result = await compareProfiles({ getUserProfile: async () => profile }, 'alex', 'sam');
    expect(enrichMovie).not.toHaveBeenCalled();
    // All 250 common films are prioritized for browsing; the score still uses
    // only the independent 200-film sample configured above.
    expect(enrichMovieGenres).toHaveBeenCalledTimes(250);
    expect(result.match.genreSimilarity).toBe(100);
    expect(result.match.genreAnalysis.a.selected).toBe(200);
    expect(result.match.genreAnalysis.a.sampled).toBe(true);
    expect(result.match.genreAnalysis.a.coverage).toBe(0.8);
    expect(profile.movies[0]).not.toHaveProperty('genres');
  } finally {
    vi.unstubAllEnvs();
  }
});
