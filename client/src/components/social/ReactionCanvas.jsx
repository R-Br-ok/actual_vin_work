'use client';

import React from 'react';

/**
 * Floating emoji overlay rendered above the video. Each reaction rises with a
 * per-reaction sideways drift and scale (CSS vars consumed by the keyframes).
 */
export function ReactionCanvas({ reactions }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-hidden="true">
      {reactions.map((r) => (
        <div
          key={r.id}
          className="absolute bottom-20 flex animate-reaction-float flex-col items-center"
          style={{ left: `${r.x}%`, '--drift': `${r.drift ?? 0}px`, '--scale': r.scale ?? 1 }}
        >
          <span className="text-4xl drop-shadow-[0_6px_14px_rgba(0,0,0,0.55)] md:text-5xl">{r.emoji}</span>
          {r.sender && (
            <span className="mt-1 max-w-[120px] truncate rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
              {r.sender}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
