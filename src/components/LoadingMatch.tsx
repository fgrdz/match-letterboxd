'use client';
import { useEffect, useState } from 'react';
const messages = [
  'Buscando as filmografias públicas…',
  'Uma boa sessão merece um pouco de preparação.',
  'As páginas são consultadas com calma, respeitando a fonte.',
  'Perfis grandes podem levar alguns minutos.',
];
export function LoadingMatch() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, messages.length - 1)), 5500);
    return () => clearInterval(timer);
  }, []);
  return (
    <main className="loading-screen" aria-busy="true">
      <div className="loading-reels" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="eyebrow">PREPARANDO A SESSÃO</div>
      <h1>
        Encontrando o que
        <br />
        conecta vocês.
      </h1>
      <p role="status" aria-live="polite">
        {messages[step]}
      </p>
      <div className="loading-cards" aria-hidden="true">
        <div />
        <div />
        <div />
      </div>
      <p className="muted">Aguarde nesta página. Resultados recentes são reutilizados.</p>
    </main>
  );
}
