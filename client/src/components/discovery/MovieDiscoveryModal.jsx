'use client';

import React from 'react';
import { X, Search } from 'lucide-react';
import { useMovieSearch } from '../../hooks/useMovieSearch';
import { MovieCard } from './MovieCard';
import { CATEGORIES } from '../../data/mockMovies';
import { useRoom } from '../../context/RoomContext';

export function MovieDiscoveryModal({ isOpen, onClose }) {
  const { query, setQuery, selectedCategory, setSelectedCategory, movies } = useMovieSearch();
  const { isHost, playNow, addToPlaylist, playlist } = useRoom();

  if (!isOpen) return null;

  const handlePlayMovie = (movie) => {
    playNow(movie);
    onClose();
  };

  const handleQueueMovie = (movie) => {
    addToPlaylist(movie);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative flex flex-col w-full max-w-5xl max-h-[90vh] rounded-xl border border-line bg-panel overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-line bg-panel-soft/60">
          <div>
            <span className="text-[11px] font-semibold tracking-widest text-accent uppercase">Catalog Explorer</span>
            <h2 className="font-serif text-2xl text-app-text mt-0.5">Discover Movies</h2>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-9 h-9 rounded-full border border-line hover:border-accent hover:text-accent transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="p-4 border-b border-line bg-panel-soft/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Fuse.js Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Fuzzy search titles, directors, genres..."
              className="w-full pl-9 pr-4 py-2 rounded-full border border-line bg-ink text-xs text-app-text placeholder-muted focus:outline-none focus:border-accent transition"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'border-accent bg-accent text-accent-ink font-semibold'
                    : 'border-line text-muted hover:text-app-text hover:border-muted'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Film Cards Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {movies.length === 0 ? (
            <div className="text-center py-16 text-muted font-sans text-sm">
              No matching movies found for &quot;{query}&quot;. Try another term!
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {movies.map((movie, index) => {
                const isQueued = playlist.some((item) => item.id === movie.id);
                return (
                  <MovieCard
                    key={movie.id}
                    movie={movie}
                    index={index}
                    isHost={isHost}
                    onPlay={handlePlayMovie}
                    onAddToQueue={handleQueueMovie}
                    isQueued={isQueued}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
