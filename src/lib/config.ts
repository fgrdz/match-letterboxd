export function envNumber(
  name: string,
  fallback: number,
  min = 1,
  max = Number.MAX_SAFE_INTEGER,
): number {
  const raw = process.env[name];
  if (!raw?.trim()) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}
