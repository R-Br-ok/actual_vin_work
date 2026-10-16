'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Gauge } from 'lucide-react';
import { PLAYBACK_RATES } from '../../lib/constants';
import { cn } from '../../lib/utils';

const label = (r) => `${r}×`;

/**
 * Playback speed control. Host: opens a menu (0.5×–2×) that changes the speed for the whole room.
 * Viewers: read-only badge showing the room speed.
 */
export function SpeedMenu({ rate = 1, isHost, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!isHost) {
    return (
      <span
        className={cn(
          'flex h-9 items-center gap-1 rounded-full px-2.5 font-mono text-xs',
          rate === 1 ? 'text-app-text/60' : 'bg-accent/20 text-accent-soft'
        )}
        title="Playback speed (set by the host)"
        aria-label={`Playback speed ${label(rate)}`}
      >
        <Gauge size={14} />
        {label(rate)}
      </span>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-9 items-center gap-1 rounded-full px-2.5 font-mono text-xs font-semibold transition hover:bg-white/10',
          rate !== 1 && 'bg-accent/20 text-accent-soft'
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Playback speed ${label(rate)}`}
        title="Playback speed (everyone)"
      >
        <Gauge size={15} />
        {label(rate)}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Playback speed"
          className="glass absolute bottom-full right-0 mb-2 w-40 animate-fade-in overflow-hidden rounded-2xl p-1 shadow-stage"
        >
          <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Speed · whole room</p>
          {PLAYBACK_RATES.map((r) => (
            <button
              key={r}
              type="button"
              role="menuitemradio"
              aria-checked={r === rate}
              onClick={() => {
                setOpen(false);
                if (r !== rate) onChange(r);
              }}
              className={cn(
                'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left font-mono text-sm transition hover:bg-white/10',
                r === rate ? 'text-accent-soft' : 'text-app-text/90'
              )}
            >
              <span>{r === 1 ? '1× Normal' : label(r)}</span>
              {r === rate && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
