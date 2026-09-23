import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="error-panel">
      <h1>Cena não encontrada.</h1>
      <Link href="/">Voltar ao início →</Link>
    </main>
  );
}
