'use client';

import { useState } from 'react';

export function ProfileAvatar({
  name,
  avatarUrl,
  variant,
}: {
  name: string;
  avatarUrl?: string;
  variant: 'a' | 'b';
}) {
  const [failedUrl, setFailedUrl] = useState<string>();

  return (
    <span className={`person-avatar avatar-${variant}`}>
      {avatarUrl && avatarUrl !== failedUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Public avatar URL validated by the provider; no image proxy needed.
        <img
          src={avatarUrl}
          alt={`Foto de ${name}`}
          width={64}
          height={64}
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(avatarUrl)}
        />
      ) : (
        <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  );
}
