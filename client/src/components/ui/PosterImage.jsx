'use client';

import React, { useState } from 'react';
import { Film } from 'lucide-react';
import { cn } from '../../lib/utils';

/** Poster <img> that degrades to a branded gradient if the remote image fails. */
export function PosterImage({ src, alt, className, showFallbackIcon = true }) {
  const [failed, setFailed] = useState(!src);

  if (failed) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center bg-gradient-to-br from-accent/30 via-panel-soft to-ink text-muted',
          className
        )}
        aria-label={alt}
      >
        {showFallbackIcon && <Film size={22} />}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={cn('h-full w-full object-cover', className)} />
  );
}
