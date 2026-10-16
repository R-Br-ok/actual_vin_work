'use client';

import React from 'react';

const EMOJIS = ['🔥', '❤️', '😂', '👏', '🍿', '🚀', '🎬', '😱'];

export function ReactionBar({ onReact }) {
  return (
    <div className="flex items-center gap-1.5 p-1.5 rounded-full border border-line bg-panel-soft/80 backdrop-blur-md">
      <span className="text-[11px] font-medium text-muted px-2 select-none">Reactions:</span>
      <div className="flex items-center gap-1">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onReact(emoji)}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10 active:scale-90 transition transform hover:scale-110"
            title={`React with ${emoji}`}
          >
            <span className="text-base select-none">{emoji}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
