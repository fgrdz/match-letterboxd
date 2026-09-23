export const formulaVersion = '1.5' as const;
// Remaining 20% preserves the previous genres:overlap:likes ratio of 2:4:1.
export const matchWeights = {
  ratings: 80,
  genres: (20 * 2) / 7,
  overlap: (20 * 4) / 7,
  likes: 20 / 7,
} as const;
