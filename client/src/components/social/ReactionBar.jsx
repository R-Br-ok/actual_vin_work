'use client';

import React from 'react';
import { REACTION_EMOJIS } from '../../lib/constants';

export function ReactionBar({ onReact, disabled = false }) {
  return (
    <div className="glass flex items-center gap-0.5 rounded-full p-1" role="toolbar" aria-label="Send a reaction">
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          disabled={disabled}
          onClick={() => onReact(emoji)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-lg transition hover:-translate-y-0.5 hover:scale-110 hover:bg-white/10 active:scale-90 disabled:opacity-40"
          aria-label={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
