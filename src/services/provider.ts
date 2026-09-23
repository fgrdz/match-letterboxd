import 'server-only';
import type { MovieProvider } from '@/domain/models';
import { LetterboxdProvider } from './letterboxd/LetterboxdProvider';
// Composition root: replace this implementation when official API access is available.
export const movieProvider: MovieProvider = new LetterboxdProvider();
