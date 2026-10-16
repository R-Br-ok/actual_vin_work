'use client';

import React from 'react';
import { Crown } from 'lucide-react';
import { cn, getAvatarColor, getInitials } from '../../lib/utils';

export function Avatar({ name = '', size = 28, isHost = false, ring = true, className, title }) {
  const color = getAvatarColor(name);
  return (
    <span
      className={cn('relative inline-flex flex-shrink-0 select-none', className)}
      style={{ width: size, height: size }}
      title={title ?? name}
    >
      <span
        className={cn(
          'flex h-full w-full items-center justify-center rounded-full font-bold text-white',
          ring && 'ring-2 ring-ink'
        )}
        style={{
          background: `linear-gradient(135deg, ${color}, ${color}B3)`,
          fontSize: Math.max(9, Math.round(size * 0.36)),
        }}
      >
        {getInitials(name)}
      </span>
      {isHost && (
        <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 ring-2 ring-ink">
          <Crown size={8} className="fill-ink text-ink" strokeWidth={3} />
        </span>
      )}
    </span>
  );
}
