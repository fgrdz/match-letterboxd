'use client';
/* eslint-disable @next/next/no-img-element -- Remote posters are validated server-side and loaded without an image proxy. */
import { useEffect, useRef, useState } from 'react';
import type { Movie } from '@/domain/models';
import { loadPoster } from '@/lib/posters/client';
export function MoviePoster({ movie, enabled }: { movie: Movie; enabled: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const [poster, setPoster] = useState<string | undefined>(movie.posterUrl);
  const [failedUrl, setFailedUrl] = useState<string>();
  const [loading, setLoading] = useState(false);
  const source = movie.posterUrl ?? poster;
  useEffect(() => {
    if (!enabled || movie.posterUrl || (!movie.tmdbId && !movie.year)) return;
    const element = container.current;
    if (!element) return;
    let cancelled = false;
    const request = () => {
      setLoading(true);
      void loadPoster(movie).then((result) => {
        if (cancelled) return;
        setPoster(result.posterUrl ?? undefined);
        setLoading(false);
      });
    };
    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              if (entries.some((entry) => entry.isIntersecting)) {
                observer?.disconnect();
                request();
              }
            },
            { rootMargin: '200px' },
          )
        : undefined;
    // Defer the fallback as well, to keep effects free of synchronous state updates.
    const timer = observer ? undefined : setTimeout(request, 0);
    observer?.observe(element);
    return () => {
      cancelled = true;
      observer?.disconnect();
      clearTimeout(timer);
    };
  }, [enabled, movie]);
  return (
    <div ref={container} className="movie-poster-content" aria-busy={loading}>
      {source && source !== failedUrl ? (
        <img
          src={source}
          alt={`Pôster de ${movie.title}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(source)}
        />
      ) : (
        <div className="poster-fallback">
          <span aria-hidden="true">✳</span>
          <strong>{movie.title}</strong>
          <span>{loading ? 'Carregando capa…' : (movie.year ?? 'CINEMA')}</span>
        </div>
      )}
    </div>
  );
}
