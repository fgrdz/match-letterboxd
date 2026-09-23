export function ratingSimilarity(differences: number[]): number | undefined {
  if (!differences.length) return undefined;
  return 100 * (1 - differences.reduce((sum, d) => sum + d, 0) / differences.length / 4.5);
}
