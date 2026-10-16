'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, ArrowRight, Users, Zap, MessageSquare, Loader2 } from 'lucide-react';
import { MOCK_MOVIES, CATEGORIES, DEFAULT_MOVIE } from '../data/mockMovies';
import { getServerUrl } from '../lib/socket';
import { getStoredUsername, setStoredUsername } from '../lib/identity';
import { PosterImage } from '../components/ui/PosterImage';
import { cn } from '../lib/utils';

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [creatingId, setCreatingId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setName(getStoredUsername());
  }, []);

  const rememberName = () => {
    if (name.trim()) setStoredUsername(name);
  };

  // Create the room over REST with the chosen movie so it's loaded the moment we arrive
  const handleCreateRoom = async (movie = DEFAULT_MOVIE) => {
    rememberName();
    setError(null);
    setCreatingId(movie.id);
    try {
      const res = await fetch(`${getServerUrl()}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: movie.videoUrl, movie }),
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();
      router.push(`/room/${data.room.code}`);
    } catch (err) {
      setCreatingId(null);
      setError(`Couldn’t reach the sync server at ${getServerUrl()}. Is it running on port 5000?`);
    }
  };

  const handleJoinByCode = (e) => {
    e.preventDefault();
    const code = roomCodeInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) return;
    rememberName();
    router.push(`/room/${code}`);
  };

  const visibleFilms = MOCK_MOVIES.filter((film) => activeCategory === 'All' || film.category === activeCategory);
  const hero = DEFAULT_MOVIE;

  return (
    <main className="min-h-screen">
      {/* Top bar */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5 md:px-12">
        <div className="logo select-none">
          <span className="logo-mark">
            <span />
            <span />
          </span>
          <span className="text-sm text-app-text">FRAME</span>
        </div>
        <span className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-muted backdrop-blur md:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Real-time synchronized watch parties
        </span>
      </header>

      {/* Hero */}
      <section className="relative flex min-h-[640px] items-center overflow-hidden border-b border-white/[0.06] md:h-[82vh]">
        <div className="absolute inset-0">
          <PosterImage src={hero.image} alt="" className="saturate-[0.8]" showFallbackIcon={false} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-ink/40" />

        <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-10 px-5 pt-24 md:px-12 lg:grid-cols-[1fr_400px] lg:items-center">
          <div className="max-w-xl animate-slide-up">
            <p className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-accent-soft">
              <span className="h-px w-6 bg-accent" /> Tonight’s feature
            </p>
            <h1 className="font-serif text-5xl leading-[1.05] text-app-text md:text-7xl">{hero.title}</h1>
            <p className="mt-3 font-serif text-xl italic text-app-text/85 md:text-2xl">{hero.subtitle}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-muted">
              <span className="font-semibold text-secondary">{hero.match}</span>
              <span>{hero.year}</span>
              <span className="rounded border border-white/20 px-1.5 py-0.5 text-[10px]">{hero.rating}</span>
              <span>{hero.duration}</span>
              <span>{hero.genres.join(' · ')}</span>
            </div>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-muted md:text-base">{hero.description}</p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => handleCreateRoom(hero)} disabled={Boolean(creatingId)} className="btn-primary px-6 py-3 text-sm">
                {creatingId === hero.id ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
                Start watch party
              </button>
              <a href="#catalog" className="btn-ghost px-5 py-3 text-sm">
                Pick another movie
              </a>
            </div>
            {error && <p className="mt-4 max-w-md text-xs text-rose-300">{error}</p>}
          </div>

          {/* Join card */}
          <div className="glass animate-slide-up rounded-3xl p-6 shadow-stage">
            <h2 className="font-serif text-xl text-app-text">Join a party</h2>
            <p className="mt-1 text-xs text-muted">Got a room code from a friend? Hop straight in.</p>
            <form onSubmit={handleJoinByCode} className="mt-5 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold text-muted">Your name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={rememberName}
                  maxLength={32}
                  placeholder="e.g. Priya"
                  className="input"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold text-muted">Room code</span>
                <input
                  type="text"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  placeholder="AB12CD"
                  maxLength={12}
                  className="input font-mono uppercase tracking-[0.3em]"
                  autoCapitalize="characters"
                />
              </label>
              <button type="submit" disabled={!roomCodeInput.trim()} className="btn-primary w-full py-3">
                Join room <ArrowRight size={16} />
              </button>
            </form>
            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-5 text-center text-[10px] text-muted">
              <span className="flex flex-col items-center gap-1.5">
                <Zap size={15} className="text-accent-soft" /> Frame-tight sync
              </span>
              <span className="flex flex-col items-center gap-1.5">
                <Users size={15} className="text-secondary" /> Shared queue
              </span>
              <span className="flex flex-col items-center gap-1.5">
                <MessageSquare size={15} className="text-amber-300" /> Chat & reactions
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Catalog */}
      <section id="catalog" className="mx-auto max-w-7xl px-5 py-14 md:px-12">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Catalog</p>
            <h2 className="font-serif text-3xl text-app-text">Pick a movie to host</h2>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'chip',
                  activeCategory === cat ? 'border-accent bg-accent text-white' : 'border-white/10 text-muted hover:text-app-text'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visibleFilms.map((film) => (
            <article key={film.id} className="group overflow-hidden rounded-2xl border border-white/[0.07] bg-panel/60 transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-glow">
              <div className="relative aspect-video overflow-hidden bg-ink">
                <PosterImage src={film.image} alt={film.title} className="saturate-[0.85] transition duration-500 group-hover:scale-105 group-hover:saturate-100" />
                <div className="absolute inset-0 bg-gradient-to-t from-panel/90 via-transparent to-transparent" />
                <button
                  type="button"
                  onClick={() => handleCreateRoom(film)}
                  disabled={Boolean(creatingId)}
                  className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`Start a watch party with ${film.title}`}
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-glow">
                    {creatingId === film.id ? <Loader2 size={22} className="animate-spin" /> : <Play size={22} fill="currentColor" className="ml-0.5" />}
                  </span>
                </button>
              </div>
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <h3 className="truncate font-serif text-lg text-app-text">{film.title}</h3>
                  <p className="truncate text-xs text-muted">
                    {film.meta} · {film.genres.join(', ')}
                  </p>
                </div>
                <span className="whitespace-nowrap text-[11px] font-semibold text-secondary">{film.match}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/[0.06] px-5 py-8 text-center text-xs text-muted md:px-12">
        FRAME Watch Party · Next.js, Socket.io & Redis · Open movies © Blender Foundation (CC BY)
      </footer>
    </main>
  );
}
