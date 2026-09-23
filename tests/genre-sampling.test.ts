import { describe, expect, it } from 'vitest';
import type { Movie, UserProfile } from '@/domain/models';
import { movieKey } from '@/domain/movieKey';
import { selectCommonGenrePriority, selectGenreSample } from '@/domain/match/genreSample';
import { genreSimilarity } from '@/domain/match/genreSimilarity';

const movies = (n: number): Movie[] =>
  Array.from({ length: n }, (_, i) => ({ slug: `film-${i}`, title: `Film ${i}`, year: 2000 }));
const plan = (selection: Movie[], completed = true): UserProfile['genreSample'] => ({
  movieKeys: selection.map(movieKey),
  completed,
});

describe('representative genre selection', () => {
  it('selects 200 unique films reproducibly and independently of ordering, ratings, likes and metadata', () => {
    const population = movies(1000);
    const sample = selectGenreSample(population, 200, 'alex').map(movieKey);
    const changed = population
      .toReversed()
      .map((movie) => ({ ...movie, rating: 5 as const, liked: true, genres: ['Drama'] }));
    expect(selectGenreSample(changed, 200, 'ALEX').map(movieKey)).toEqual(sample);
    expect(selectGenreSample([...population, ...population], 200, 'alex').map(movieKey)).toEqual(
      sample,
    );
    expect(new Set(sample).size).toBe(200);
    expect(sample).not.toEqual(population.slice(0, 200).map(movieKey));
    expect(population[0].slug).toBe('film-0');
  });
  it('uses all small filmographies and allows a full census with limit zero', () => {
    expect(selectGenreSample(movies(20), 200, 'a')).toHaveLength(20);
    expect(selectGenreSample(movies(250), 0, 'a')).toHaveLength(250);
    expect(selectGenreSample([], 200, 'a')).toEqual([]);
  });
  it('samples throughout the population rather than just recent or favorite films', () => {
    const selection = selectGenreSample(movies(1000), 200, 'a');
    const ids = selection.map((movie) => Number(movie.slug.slice(5)));
    expect(ids.some((id) => id < 100)).toBe(true);
    expect(ids.some((id) => id >= 900)).toBe(true);
  });
});

describe('common-movie enrichment priority', () => {
  it('prioritizes common movies rated by both, then their average, without changing inputs', () => {
    const a = [
      { ...movies(1)[0], slug: 'low', rating: 2 as const },
      { ...movies(1)[0], slug: 'high', rating: 5 as const },
      { ...movies(1)[0], slug: 'single', rating: 5 as const },
      { ...movies(1)[0], slug: 'only-a', rating: 5 as const },
    ];
    const b = [
      { ...movies(1)[0], slug: 'low', rating: 3 as const },
      { ...movies(1)[0], slug: 'high', rating: 4.5 as const },
      { ...movies(1)[0], slug: 'single' },
      { ...movies(1)[0], slug: 'only-b', rating: 5 as const },
    ];
    const before = structuredClone([a, b]);
    expect(selectCommonGenrePriority(a, b, 3).map((movie) => movie.slug)).toEqual([
      'high',
      'low',
      'single',
    ]);
    expect([a, b]).toEqual(before);
  });
  it('uses stable movie identities, deduplicates, and obeys the common limit', () => {
    const a = [
      { slug: 'old-a', title: 'A', letterboxdId: '1', rating: 5 as const },
      { slug: 'old-a', title: 'A duplicate', letterboxdId: '1', rating: 4 as const },
      { slug: 'other', title: 'Other', letterboxdId: '2', rating: 5 as const },
    ];
    const b = [
      { slug: 'renamed', title: 'Renamed', letterboxdId: '1', rating: 5 as const },
      { slug: 'other', title: 'Other', letterboxdId: '3', rating: 5 as const },
    ];
    expect(selectCommonGenrePriority(a, b, 1).map(movieKey)).toEqual(['lb:1']);
    expect(selectCommonGenrePriority(a, b, 0)).toEqual([]);
  });
});

describe('genre analysis eligibility and transparency', () => {
  it('uses an independent sample even when a lot of UI-selected films have other genres', () => {
    const population = movies(1000).map((movie) => ({ ...movie, genres: ['Horror'] }));
    const selected = selectGenreSample(population, 200, 'a');
    selected.forEach((movie) => {
      movie.genres = ['Drama'];
    });
    const result = genreSimilarity(population, population, {
      sampleA: plan(selected),
      sampleB: plan(selected),
    });
    expect(result.similarity).toBe(100);
    expect(result.genres.map((genre) => genre.genre)).toEqual(['Drama']);
    expect(result.analysis.a).toMatchObject({
      selected: 200,
      resolved: 200,
      population: 1000,
      coverage: 0.2,
      resolution: 1,
      sampled: true,
      eligible: true,
    });
    expect(result.analysis.estimated).toBe(true);
  });
  it('requires 80% of a selected sample resolved, not 80% of the entire population', () => {
    const population = movies(1000);
    const selected = selectGenreSample(population, 200, 'a');
    selected.slice(0, 160).forEach((movie) => {
      movie.genres = ['Drama'];
    });
    const context = { sampleA: plan(selected), sampleB: plan(selected) };
    expect(genreSimilarity(population, population, context).similarity).toBe(100);
    selected[159].genres = undefined;
    const result = genreSimilarity(population, population, context);
    expect(result.similarity).toBeUndefined();
    expect(result.analysis.a.missing).toBe(41);
  });
  it('does not qualify tiny samples, incomplete scraping, or interrupted selection', () => {
    const population = movies(500).map((movie) => ({ ...movie, genres: ['Drama'] }));
    const small = plan(population.slice(0, 50));
    expect(
      genreSimilarity(population, population, { sampleA: small, sampleB: small }).similarity,
    ).toBeUndefined();
    const sample = plan(population.slice(0, 200));
    expect(
      genreSimilarity(population, population, { sampleA: sample, sampleB: sample, partialA: true })
        .similarity,
    ).toBeUndefined();
    expect(
      genreSimilarity(population, population, {
        sampleA: { ...sample!, completed: false },
        sampleB: sample,
      }).similarity,
    ).toBeUndefined();
  });
  it('labels a complete census separately from incomplete metadata', () => {
    const population = movies(20).map((movie) => ({
      ...movie,
      genres: ['Drama'] as string[] | undefined,
    }));
    expect(genreSimilarity(population, population).analysis.estimated).toBe(false);
    population[0].genres = undefined;
    expect(genreSimilarity(population, population).analysis.estimated).toBe(true);
    expect(genreSimilarity(population, population).similarity).toBe(100);
  });
  it('separates consumption from genre rating preferences and requires five rated movies', () => {
    const a = movies(10).map((movie, i) => ({
      ...movie,
      genres: i < 5 ? ['Drama', 'Romance'] : ['Horror'],
      rating: (i < 5 ? 5 : 1) as 5 | 1,
    }));
    const b = a.map((movie) => ({ ...movie, rating: 3 as const }));
    const result = genreSimilarity(a, b);
    expect(result.similarity).toBe(100);
    expect(result.analysis.a.preferences[0]).toMatchObject({
      genre: 'Drama',
      meanRating: 5,
      count: 5,
    });
    expect(result.analysis.b.preferences[0].meanRating).toBe(3);
    const unrated = movies(10).map((movie) => ({ ...movie, genres: ['Drama'] }));
    expect(genreSimilarity(unrated, unrated).analysis.a.preferences).toEqual([]);
  });
  it('does not mutate inputs, double count duplicate genres, or produce NaN on empty profiles', () => {
    const a = movies(10).map((movie) => ({ ...movie, genres: ['Drama', 'Drama', 'Comedy'] }));
    const before = structuredClone(a);
    expect(genreSimilarity(a, a).genres.find((genre) => genre.genre === 'Drama')?.shareA).toBe(0.5);
    expect(a).toEqual(before);
    expect(genreSimilarity([], []).similarity).toBeUndefined();
    expect(genreSimilarity([], []).analysis.a.resolution).toBe(0);
  });
});
