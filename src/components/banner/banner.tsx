'use client';

import Image from 'next/image';
import { useState, useSyncExternalStore } from 'react';
import styles from './banner.module.css';

const motionQuery = '(prefers-reduced-motion: reduce)';

function subscribeToMotionPreference(callback: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}

export function Banner() {
  const reducedMotion = useSyncExternalStore(
    subscribeToMotionPreference,
    () => window.matchMedia(motionQuery).matches,
    () => true,
  );
  const [paused, setPaused] = useState(false);
  const animate = !reducedMotion && !paused;

  return (
    <section className={styles.banner} aria-labelledby="home-title">
      <div className={styles.media}>
        <Image
          className={styles.backdrop}
          src={animate ? '/banner/before-sunrise.gif' : '/banner/before-sunrise-still.webp'}
          alt=""
          fill
          unoptimized
          priority
          sizes="100vw"
        />
      </div>
      <div className={styles.shade} />
      <div className={styles.content}>
        <h1 id="home-title">
          Vamos descobrir quão parecidos nós <em>somos.</em>
        </h1>
      </div>
      <div className={styles.credits}>
        <a
          href="https://tenor.com/view/julie-delpy-ethan-hawke-before-sunrise-gif-26736832"
          target="_blank"
          rel="noreferrer"
        >
          Before Sunrise <span>· via Tenor ↗</span>
        </a>
        {!reducedMotion && (
          <button type="button" onClick={() => setPaused(!paused)} aria-pressed={paused}>
            <span aria-hidden="true">{paused ? '▷' : 'Ⅱ'}</span>
            {paused ? 'Reproduzir animação' : 'Pausar animação'}
          </button>
        )}
      </div>
    </section>
  );
}
