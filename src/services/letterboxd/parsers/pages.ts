import { load, type CheerioAPI } from 'cheerio';
import type { Movie, Rating } from '@/domain/models';
import { AppError } from '@/lib/errors';
import { isProtectionPage } from './protection';
// Observed on public HTML on 2026-09-23. Keep HTML knowledge inside this module.
const selectors = {
  profile: '.profile-header[data-person]',
  avatar: '.profile-header .avatar img',
  movie: 'li.griditem [data-component-class="LazyPoster"][data-item-slug]',
  rating: '.poster-viewingdata .rating',
  next: '.pagination a.next',
  empty: 'section.empty-text',
  viewingData: '.poster-viewingdata',
  like: '.like',
  liked: '.like.icon-liked',
};
export function safeImageUrl(value: string | undefined): string | undefined {
  if (!value || value.includes('empty-poster')) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      ['a.ltrbxd.com', 's.ltrbxd.com', 'image.tmdb.org'].includes(url.hostname)
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
function parsePoster(item: ReturnType<CheerioAPI>): Movie {
  const slug = item.attr('data-item-slug');
  const display = item.attr('data-item-name');
  if (!slug || !/^[a-z0-9_-]+$/.test(slug) || !display) throw new AppError('parser');
  const yearMatch = display.match(/ \((\d{4})\)$/);
  let letterboxdId: string | undefined;
  try {
    const identifier: unknown = JSON.parse(item.attr('data-postered-identifier') ?? '{}');
    if (
      identifier &&
      typeof identifier === 'object' &&
      'uid' in identifier &&
      typeof identifier.uid === 'string' &&
      /^film:\d+$/.test(identifier.uid)
    )
      letterboxdId = identifier.uid.slice(5);
  } catch {
    throw new AppError('parser');
  }
  return {
    slug,
    letterboxdId,
    title: yearMatch ? display.slice(0, -7) : display,
    year: yearMatch ? Number(yearMatch[1]) : undefined,
    posterUrl: safeImageUrl(item.find('img').attr('src')),
  };
}

function loadProfile(html: string, username: string) {
  if (isProtectionPage(html)) throw new AppError('blocked');
  const $ = load(html);
  const profile = $(selectors.profile);
  if (profile.attr('data-person')?.toLowerCase() !== username.toLowerCase())
    throw new AppError('parser');
  return $;
}

export function parseMoviesPage(html: string, username: string) {
  const $ = loadProfile(html, username);
  const movies: Movie[] = [];
  $(selectors.movie).each((_, element) => {
    const item = $(element);
    const movie = parsePoster(item);
    const viewingData = item.closest('li.griditem').find(selectors.viewingData);
    const like = viewingData.find(selectors.like);
    const liked = viewingData.find(selectors.liked);
    // Unrecognized heart markup must not turn into a false dislike.
    const likedValue =
      viewingData.length && like.length === liked.length ? liked.length > 0 : undefined;
    const ratingElement = item.closest('li.griditem').find(selectors.rating);
    const ratingMatch = ratingElement.attr('class')?.match(/\brated-(\d+)\b/);
    const rawRating = ratingMatch ? Number(ratingMatch[1]) / 2 : undefined;
    if (ratingElement.length && (rawRating === undefined || rawRating < 0.5 || rawRating > 5))
      throw new AppError('parser');
    movies.push({
      ...movie,
      rating: rawRating as Rating | undefined,
      liked: likedValue,
    });
  });
  if (!movies.length && !$(selectors.empty).length) throw new AppError('parser');
  const avatar = $(selectors.avatar).first();
  return {
    movies,
    next: $(selectors.next).attr('href'),
    displayName: avatar.attr('alt') || undefined,
    avatarUrl: safeImageUrl(avatar.attr('src')),
  };
}
