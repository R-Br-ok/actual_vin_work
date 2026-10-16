'use client';

import React, { useEffect, useRef } from 'react';
import { X, Search, SlidersHorizontal } from 'lucide-react';
import { useMovieSearch } from '../../hooks/useMovieSearch';
import { MovieCard } from './MovieCard';
import { CATEGORIES, GENRES } from '../../data/mockMovies';
import { useRoom } from '../../context/RoomContext';
import { cn } from '../../lib/utils';

export function MovieDiscoveryModal({ isOpen, onClose }) {
  const search = useMovieSearch();
  const { isHost, playNow, addToQueue, queue, roomState } = useRoom();
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePlay = (movie) => {
    playNow(movie);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-fade-in sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="discovery-title"
    >
      <div className="glass flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl shadow-stage sm:rounded-3xl">
        {/* Header + search */}
        <div className="space-y-4 border-b border-white/[0.06] p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-soft">Catalog</p>
              <h2 id="discovery-title" className="mt-1 font-serif text-2xl text-app-text md:text-3xl">
                Discover movies
              </h2>
              <p className="mt-1 text-xs text-muted">
                {isHost ? 'Play something now for the whole room, or line it up in the queue.' : 'Add picks to the shared queue — the host decides what plays.'}
              </p>
            </div>
            <button type="button" onClick={onClose} className="icon-btn border border-white/10" aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              ref={inputRef}
              type="search"
              value={search.query}
              onChange={(e) => search.setQuery(e.target.value)}
              placeholder="Search titles, directors, genres… (typos are fine)"
              className="input rounded-2xl py-3 pl-11"
              aria-label="Search movies"
            />
          </div>

          {/* Category tabs */}
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Categories">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={search.selectedCategory === cat}
                onClick={() => search.setSelectedCategory(cat)}
                className={cn(
                  'chip',
                  search.selectedCategory === cat
                    ? 'border-accent bg-accent text-white'
                    : 'border-white/10 text-muted hover:border-white/20 hover:text-app-text'
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Genre filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <SlidersHorizontal size={13} className="flex-shrink-0 text-muted" />
            {GENRES.map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={search.selectedGenre === g}
                onClick={() => search.setSelectedGenre(search.selectedGenre === g ? null : g)}
                className={cn(
                  'chip px-2.5 py-1 text-[11px]',
                  search.selectedGenre === g
                    ? 'border-secondary/60 bg-secondary/15 text-secondary'
                    : 'border-transparent bg-white/[0.04] text-muted hover:text-app-text'
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6">
          {search.movies.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm text-muted">Nothing matches{search.query && <> “{search.query}”</>}.</p>
              <button type="button" onClick={search.reset} className="btn-ghost text-xs">
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {search.movies.map((movie) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  isHost={isHost}
                  isPlaying={roomState?.videoUrl === movie.videoUrl}
                  isQueued={queue.some((q) => q.id === movie.id)}
                  onPlay={handlePlay}
                  onAddToQueue={addToQueue}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
