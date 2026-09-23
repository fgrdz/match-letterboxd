'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { validateUsername } from '@/lib/validation/username';
import { publicError } from '@/lib/errors';
export function CompareForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="compare-form"
      onSubmit={(event) => {
        event.preventDefault();
        setError('');
        const data = new FormData(event.currentTarget);
        try {
          const a = validateUsername(data.get('a')),
            b = validateUsername(data.get('b'));
          startTransition(() => router.push(`/match?${new URLSearchParams({ a, b })}`));
        } catch (err) {
          setError(publicError(err));
        }
      }}
    >
      <div className="form-fields">
        <label htmlFor="username-a">
          <span className="field-label">
            <i className="dot coral" /> SEU PERFIL
          </span>
          <span className="input-wrap">
            <span aria-hidden="true">@</span>
            <input
              id="username-a"
              name="a"
              placeholder="seu username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={40}
              required
              disabled={pending}
              aria-describedby={error ? 'form-error' : undefined}
            />
          </span>
        </label>
        <span className="form-plus" aria-hidden="true">
          +
        </span>
        <label htmlFor="username-b">
          <span className="field-label">
            <i className="dot lavender" /> A OUTRA PESSOA
          </span>
          <span className="input-wrap">
            <span aria-hidden="true">@</span>
            <input
              id="username-b"
              name="b"
              placeholder="username da companhia"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={40}
              required
              disabled={pending}
              aria-describedby={error ? 'form-error' : undefined}
            />
          </span>
        </label>
      </div>
      {error && (
        <p id="form-error" role="alert" className="form-error">
          {error}
        </p>
      )}
      <button type="submit" className="primary-button" disabled={pending}>
        {pending ? 'Preparando a sessão…' : 'Comparar nossos gostos'}
        <span aria-hidden="true">↗</span>
      </button>
      <p className="form-caption">Só precisamos dos usernames públicos do Letterboxd. Sem login.</p>
    </form>
  );
}
