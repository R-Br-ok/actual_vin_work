'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Sparkles, ArrowRight, Film } from 'lucide-react';
import { MOCK_MOVIES, CATEGORIES } from '../data/mockMovies';

export default function HomePage() {
  const router = useRouter();
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [activeGenre, setActiveGenre] = useState('All');
  const [isCreating, setIsCreating] = useState(false);

  // Create room via backend REST API or direct navigation
  const handleCreateRoom = async (videoUrl = '') => {
    try {
      setIsCreating(true);
      const res = await fetch('http://localhost:5000/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/room/${data.room.code}`);
      } else {
        // Fallback: generate local 6-char code and let socket auto-create on arrival
        const fallbackCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        router.push(`/room/${fallbackCode}`);
      }
    } catch {
      const fallbackCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      router.push(`/room/${fallbackCode}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinByCode = (e) => {
    e.preventDefault();
    if (!roomCodeInput.trim()) return;
    router.push(`/room/${roomCodeInput.trim().toUpperCase()}`);
  };

  const visibleFilms = MOCK_MOVIES.filter(
    (film) => activeGenre === 'All' || film.genre.toLowerCase() === activeGenre.toLowerCase()
  );

  return (
    <main className="min-h-screen bg-ink text-app-text">
      {/* Top Navigation Bar */}
      <header className="absolute z-20 top-0 left-0 w-full flex items-center justify-between px-6 md:px-14 py-6 border-b border-white/10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="logo select-none">
          <span className="logo-mark">
            <span />
            <span />
          </span>
          <span className="tracking-widest font-bold text-sm text-app-text">FRAME</span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-muted">
          <button className="text-app-text font-semibold relative py-1 border-b-2 border-accent">Watch Party</button>
          <button className="hover:text-app-text transition">Movies</button>
          <button className="hover:text-app-text transition">Catalog</button>
        </nav>

        {/* Join by Code Input */}
        <form onSubmit={handleJoinByCode} className="flex items-center gap-2">
          <input
            type="text"
            value={roomCodeInput}
            onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
            placeholder="Room Code (e.g. AB12CD)"
            maxLength={6}
            className="w-40 sm:w-48 px-3 py-1.5 rounded-full border border-line bg-black/60 text-xs text-app-text placeholder-muted focus:outline-none focus:border-accent font-mono tracking-wider transition"
          />
          <button
            type="submit"
            disabled={!roomCodeInput.trim()}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-panel-soft border border-line hover:border-accent text-accent disabled:opacity-40 transition"
            title="Join Party"
          >
            <ArrowRight size={14} />
          </button>
        </form>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-[700px] h-[85vh] overflow-hidden border-b border-line bg-panel">
        <img
          alt="DUST cinematic hero banner"
          className="w-full h-full object-cover object-center filter saturate-[0.75] contrast-[1.06]"
          src="https://images.unsplash.com/photo-1682685797229-b2930538da47?auto=format&fit=crop&w=1800&q=85"
        />

        {/* Shading Overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/65 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-black/30" />

        {/* Hero Content */}
        <div className="absolute z-10 top-1/2 left-6 md:left-14 -translate-y-[40%] max-w-xl">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-muted uppercase tracking-widest mb-4">
            <span className="w-6 h-[1.5px] bg-accent" />
            <span>Frame Original · Real-Time Sync</span>
          </div>

          <h1 className="font-serif text-6xl md:text-8xl tracking-tight leading-none mb-2">DUST</h1>
          <p className="font-serif text-xl md:text-2xl text-white/90 mb-6 italic">Beyond the edge of everything.</p>

          <div className="flex items-center gap-3 text-xs text-muted mb-6">
            <strong className="text-secondary font-semibold">98% match</strong>
            <span>2025</span>
            <span className="px-1.5 py-0.5 rounded border border-muted/50 text-[10px]">16+</span>
            <span>2h 08m</span>
            <span>4K HDR</span>
          </div>

          <p className="text-sm md:text-base text-muted leading-relaxed mb-8 max-w-md">
            A lone cartographer crosses an uncharted planet to find the signal that could bring humanity home. Watch together in synchronized real-time.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => handleCreateRoom('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4')}
              disabled={isCreating}
              className="flex items-center gap-2 px-6 py-3 rounded bg-accent text-accent-ink font-semibold text-sm hover:opacity-95 active:scale-95 transition shadow-lg shadow-accent/20"
            >
              <Play size={18} fill="currentColor" />
              <span>{isCreating ? 'Creating Room...' : 'Start Watch Party'}</span>
            </button>

            <button
              onClick={() => handleCreateRoom()}
              className="flex items-center gap-2 px-5 py-3 rounded border border-line bg-panel-soft/80 hover:bg-panel text-app-text font-semibold text-sm backdrop-blur-md transition"
            >
              <Sparkles size={16} className="text-accent" />
              <span>New Empty Room</span>
            </button>
          </div>
        </div>
      </section>

      {/* Film Catalog Section */}
      <section className="px-6 md:px-14 py-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-1">Curated Catalog</p>
            <h2 className="font-serif text-3xl text-app-text">Select Movie to Host</h2>
          </div>

          {/* Genre Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
            {CATEGORIES.map((genre) => (
              <button
                key={genre}
                onClick={() => setActiveGenre(genre)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium border transition ${
                  activeGenre === genre
                    ? 'border-accent bg-panel-soft text-app-text font-semibold'
                    : 'border-line text-muted hover:text-app-text'
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        {/* Film Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {visibleFilms.map((film, index) => (
            <article key={film.id} className="film-card group select-none">
              <div className="relative overflow-hidden aspect-[0.72] rounded border border-line bg-panel transition">
                <img
                  src={film.image}
                  alt={film.title}
                  className="w-full h-full object-cover filter saturate-[0.75] group-hover:scale-105 group-hover:saturate-100 transition duration-300"
                />
                <span className="absolute bottom-2 left-2.5 z-10 font-bold text-[10px] text-white/70">
                  {(index + 1).toString().padStart(2, '0')}
                </span>

                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => handleCreateRoom(film.videoUrl)}
                    className="flex items-center justify-center w-11 h-11 rounded-full bg-panel/80 border border-white/60 hover:border-accent hover:text-accent backdrop-blur-md transition transform hover:scale-110"
                    title="Start Party with this Movie"
                  >
                    <Play size={18} fill="currentColor" className="ml-0.5" />
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-serif text-sm font-normal text-app-text truncate group-hover:text-accent transition">
                    {film.title}
                  </h3>
                  <p className="text-[10px] text-muted truncate">{film.meta}</p>
                </div>
                <span className="text-[10px] text-secondary font-medium whitespace-nowrap">
                  {film.match}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line-soft px-6 md:px-14 py-8 flex items-center justify-between text-xs text-muted">
        <div className="logo">
          <span className="tracking-widest font-bold text-xs text-app-text">FRAME</span>
        </div>
        <p>© 2026 FRAME Watch Party. Real-time media sync powered by Socket.io & Redis.</p>
      </footer>
    </main>
  );
}
