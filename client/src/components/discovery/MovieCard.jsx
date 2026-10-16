'use client';

import React from 'react';
import { Play, Plus, Check, Crown } from 'lucide-react';
import { PosterImage } from '../ui/PosterImage';
import { cn } from '../../lib/utils';

export function MovieCard({ movie, isHost, isPlaying, isQueued, onPlay, onAddToQueue }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-panel/60 transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-glow">
      <div className="relative aspect-video overflow-hidden bg-ink">
        <PosterImage
          src={movie.image}
          alt={movie.title}
          className="saturate-[0.85] transition duration-500 group-hover:scale-105 group-hover:saturate-100"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-panel via-transparent to-transparent" />
        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur">
          {movie.category}
        </span>
        {isPlaying && (
          <span className="absolute right-2 top-2 rounded-full bg-rose-500/90 px-2 py-0.5 text-[10px] font-bold text-white">NOW PLAYING</span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div>
          <h3 className="truncate font-serif text-base text-app-text">{movie.title}</h3>
          <p className="truncate text-[11px] text-muted">
            {movie.meta}
            {movie.director && <> · {movie.director}</>}
          </p>
        </div>
        <p className="line-clamp-2 text-xs leading-relaxed text-muted/90">{movie.description}</p>
        <div className="flex flex-wrap gap-1">
          {(movie.genres || [movie.genre]).map((g) => (
            <span key={g} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-app-text/70">
              {g}
            </span>
          ))}
        </div>

        <div className="mt-auto flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => onPlay(movie)}
            disabled={!isHost}
            className="btn-primary flex-1 px-3 py-2 text-xs"
            title={isHost ? 'Switch everyone to this movie now' : 'Only the host can switch movies'}
          >
            {isHost ? <Play size={13} fill="currentColor" /> : <Crown size={13} />}
            {isHost ? 'Play now' : 'Host only'}
          </button>
          <button
            type="button"
            onClick={() => onAddToQueue(movie)}
            className={cn('btn-ghost px-3 py-2 text-xs', isQueued && 'border-accent/40 text-accent-soft')}
            title={isQueued ? 'Already in the queue — add again?' : 'Add to the shared queue'}
          >
            {isQueued ? <Check size={13} /> : <Plus size={13} />}
            {isQueued ? 'Queued' : 'Queue'}
          </button>
        </div>
      </div>
    </article>
  );
}
