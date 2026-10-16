'use client';

import React from 'react';
import { Play, Plus, Check } from 'lucide-react';

export function MovieCard({
  movie,
  index,
  isHost,
  onPlay,
  onAddToQueue,
  isQueued,
}) {
  return (
    <article className="film-card group select-none">
      {/* Film Poster Art */}
      <div className="relative overflow-hidden aspect-[0.72] rounded border border-line bg-panel transition">
        <img
          src={movie.image}
          alt={movie.title}
          className="w-full h-full object-cover filter saturate-[0.75] group-hover:saturate-100 group-hover:scale-105 transition-all duration-300"
        />

        {/* Number Badge */}
        <span className="absolute bottom-2 left-2.5 z-10 font-bold text-[10px] tracking-wider text-white/70">
          {(index + 1).toString().padStart(2, '0')}
        </span>

        {/* Hover Action Overlay */}
        <div className="absolute inset-0 z-20 flex items-center justify-center gap-3 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {/* Play Now Button */}
          {isHost && (
            <button
              onClick={() => onPlay(movie)}
              className="flex items-center justify-center w-11 h-11 rounded-full bg-panel/80 border border-white/60 hover:border-accent hover:text-accent backdrop-blur-md transition transform hover:scale-110 active:scale-95"
              title="Play Now in Room"
            >
              <Play size={18} fill="currentColor" className="ml-0.5" />
            </button>
          )}

          {/* Add to Queue Button */}
          <button
            onClick={() => onAddToQueue(movie)}
            className={`flex items-center justify-center w-9 h-9 rounded-full border backdrop-blur-md transition transform hover:scale-110 active:scale-95 ${
              isQueued
                ? 'bg-accent/20 border-accent text-accent'
                : 'bg-panel/80 border-white/50 text-white hover:border-accent hover:text-accent'
            }`}
            title={isQueued ? 'Added to Queue' : 'Add to Party Queue'}
          >
            {isQueued ? <Check size={16} /> : <Plus size={16} />}
          </button>
        </div>
      </div>

      {/* Film Information */}
      <div className="pt-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-serif text-sm font-normal text-app-text truncate group-hover:text-accent transition">
            {movie.title}
          </h3>
          <p className="text-[10px] text-muted truncate">{movie.meta}</p>
        </div>
        <span className="text-[10px] text-secondary font-medium whitespace-nowrap">
          {movie.match}
        </span>
      </div>
    </article>
  );
}
