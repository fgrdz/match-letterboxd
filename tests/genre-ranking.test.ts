import { describe, expect, it } from 'vitest';
import type { MovieComparison } from '@/domain/match/types';
import { commonGenreOptions, rankCommonMoviesByGenre } from '@/domain/match/genreMovieRanking';

const item = (
  slug: string,
  genres: string[],
  ratingA?: MovieComparison['ratingA'],
  ratingB?: MovieComparison['ratingB'],
): MovieComparison => ({ movie: { slug, title: slug, genres }, ratingA, ratingB });

describe('shared-genre movie filtering', () => {
  const items = [
    item('single-five', ['Drama'], 5),
    item('both-five', ['Drama', 'Romance'], 5, 5),
    item('both-four', ['Drama'], 4, 4),
    item('single-four', ['Romance'], undefined, 4),
    item('unrated', ['Drama']),
    item('duplicate-genre', ['Comedy', 'Comedy'], 3, 3),
    item('missing-genres', [], 5, 5),
  ];

  it('offers only genres with rated common movies and counts each movie once', () => {
    expect(commonGenreOptions(items)).toEqual([
      { genre: 'Drama', movies: 3, ratedByBoth: 2 },
      { genre: 'Romance', movies: 2, ratedByBoth: 1 },
      { genre: 'Comedy', movies: 1, ratedByBoth: 1 },
    ]);
  });

  it('orders by the average available rating, then prefers two ratings on ties', () => {
    const ranked = rankCommonMoviesByGenre(items, 'Drama');
    expect(ranked.map((entry) => entry.movie.slug)).toEqual([
      'both-five',
      'single-five',
      'both-four',
    ]);
    expect(ranked.map((entry) => [entry.average, entry.ratingsCount])).toEqual([
      [5, 2],
      [5, 1],
      [4, 2],
    ]);
  });

  it('does not mutate comparisons and returns an empty list for absent genres', () => {
    const before = structuredClone(items);
    expect(rankCommonMoviesByGenre(items, 'Horror')).toEqual([]);
    expect(items).toEqual(before);
  });
});
