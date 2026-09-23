// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MovieSection } from '@/components/MovieSection';
import { loadPoster } from '@/lib/posters/client';
vi.mock('@/lib/posters/client', () => ({ loadPoster: vi.fn() }));
const observers: {
  element?: Element;
  callback: IntersectionObserverCallback;
  disconnected: boolean;
}[] = [];
let container: HTMLDivElement, root: Root;
const items = Array.from({ length: 24 }, (_, i) => ({
  movie: { slug: `movie-${i}`, title: `Movie ${i}`, year: 2000 },
}));
async function render(loadPosters = true, withPoster = false) {
  await act(async () =>
    root.render(
      <MovieSection
        title="Filmes"
        subtitle=""
        empty="Vazio"
        items={
          withPoster
            ? [
                {
                  movie: {
                    ...items[0].movie,
                    posterUrl: 'https://image.tmdb.org/t/p/w500/ready.jpg',
                  },
                },
              ]
            : items
        }
        usernameA="a"
        usernameB="b"
        loadPosters={loadPosters}
      />,
    ),
  );
}
async function intersect(index: number) {
  const observer = observers[index];
  await act(async () =>
    observer.callback(
      [{ isIntersecting: true, target: observer.element } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ),
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  observers.length = 0;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      entry: (typeof observers)[number];
      constructor(callback: IntersectionObserverCallback) {
        this.entry = { callback, disconnected: false };
        observers.push(this.entry);
      }
      observe(element: Element) {
        this.entry.element = element;
      }
      disconnect() {
        this.entry.disconnected = true;
      }
    },
  );
  vi.mocked(loadPoster).mockResolvedValue({
    posterUrl: 'https://image.tmdb.org/t/p/w500/loaded.jpg',
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
it('waits until a card approaches the viewport before loading its poster', async () => {
  await render();
  expect(loadPoster).not.toHaveBeenCalled();
  expect(observers).toHaveLength(6);
  await intersect(0);
  expect(loadPoster).toHaveBeenCalledTimes(1);
  expect(observers[0].disconnected).toBe(true);
  expect(container.querySelector('img')?.src).toBe('https://image.tmdb.org/t/p/w500/loaded.jpg');
});
it('observes additional cards after Mostrar mais and fetches them on intersection', async () => {
  await render();
  await act(async () => container.querySelector('button')!.click());
  expect(container.querySelectorAll('.movie-card')).toHaveLength(24);
  expect(loadPoster).not.toHaveBeenCalled();
  await intersect(23);
  expect(loadPoster).toHaveBeenCalledWith(items[23].movie);
});
it('does not fetch in demo/disabled mode or when a poster already exists', async () => {
  await render(false);
  expect(observers).toHaveLength(0);
  expect(loadPoster).not.toHaveBeenCalled();
  await render(true, true);
  expect(observers).toHaveLength(0);
  expect(loadPoster).not.toHaveBeenCalled();
});
it('preserves the title fallback when no match exists or an image fails to load', async () => {
  vi.mocked(loadPoster).mockResolvedValueOnce({ posterUrl: null });
  await render();
  await intersect(0);
  expect(container.querySelector('.poster-fallback strong')?.textContent).toBe('Movie 0');
  await intersect(1);
  await act(async () => container.querySelector('img')!.dispatchEvent(new Event('error')));
  expect(container.querySelectorAll('img')).toHaveLength(0);
});
