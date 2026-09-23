import type { Movie, UserProfile } from '../models';
import type { GenreComparison } from './types';
import { analyzeGenres } from './genreAnalysis';
export function genreSimilarity(
  a: Movie[],
  b: Movie[],
  context?: {
    sampleA?: UserProfile['genreSample'];
    sampleB?: UserProfile['genreSample'];
    partialA?: boolean;
    partialB?: boolean;
  },
) {
  const da = analyzeGenres(a, context?.sampleA, context?.partialA),
    db = analyzeGenres(b, context?.sampleB, context?.partialB);
  const coverage = {
    a: da.report.coverage,
    b: db.report.coverage,
  };
  const genres: GenreComparison[] = [...new Set([...da.shares.keys(), ...db.shares.keys()])]
    .map((genre) => {
      const shareA = da.shares.get(genre) ?? 0,
        shareB = db.shares.get(genre) ?? 0;
      return {
        genre,
        shareA,
        shareB,
        similarity: (100 * Math.min(shareA, shareB)) / Math.max(shareA, shareB),
      };
    })
    .sort((x, y) => Math.min(y.shareA, y.shareB) - Math.min(x.shareA, x.shareB));
  const eligible = da.report.eligible && db.report.eligible;
  return {
    analysis: { a: da.report, b: db.report, estimated: !da.report.complete || !db.report.complete },
    coverage,
    genres,
    similarity: eligible
      ? 100 * genres.reduce((sum, g) => sum + Math.min(g.shareA, g.shareB), 0)
      : undefined,
  };
}
