import { AppError } from '../errors';
export function validateUsername(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,40}$/.test(value.trim()))
    throw new AppError('invalid_username');
  return value.trim().toLowerCase();
}
