import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
export const metadata: Metadata = {
  title: 'Movie Match — uma sessão para dois',
  description: 'Compare seus gostos de cinema a partir de perfis públicos do Letterboxd.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <header className="site-header">
          <Link href="/" className="brand" aria-label="Movie Match, início">
            movie<span className="muted">match</span>
          </Link>
        </header>
        {children}
        <footer className="site-footer">
          <figure className="footer-quote">
            <blockquote lang="en">“Happiness is only real when shared.”</blockquote>
            <figcaption>
              — <cite>Into the Wild</cite>
            </figcaption>
          </figure>
        </footer>
      </body>
    </html>
  );
}
