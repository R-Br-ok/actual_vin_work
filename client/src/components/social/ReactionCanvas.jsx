'use client';

import React from 'react';

export function ReactionCanvas({ reactions }) {
  if (!reactions || reactions.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
      {reactions.map((r) => (
        <div
          key={r.id}
          className="absolute bottom-6 animate-float-up flex flex-col items-center select-none"
          style={{ left: `${r.x}%` }}
        >
          <span className="text-3xl filter drop-shadow-lg transform transition-transform hover:scale-125">
            {r.emoji}
          </span>
          {r.sender && (
            <span className="text-[10px] bg-black/60 text-white/90 px-1.5 py-0.5 rounded-full mt-1 backdrop-blur-sm">
              {r.sender}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
