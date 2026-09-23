'use client';
import Link from 'next/link';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-panel">
      <div className="eyebrow">INTERVALO NA SESSÃO</div>
      <h1>Algo saiu do roteiro.</h1>
      <p>Não foi possível concluir a comparação agora.</p>
      <button className="primary-button" onClick={reset}>
        Tentar novamente
      </button>
      <Link href="/">Voltar ao início</Link>
    </main>
  );
}
