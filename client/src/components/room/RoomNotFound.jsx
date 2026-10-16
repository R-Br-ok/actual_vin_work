'use client';

import React from 'react';
import Link from 'next/link';
import { Clapperboard, Home, WifiOff, RotateCw } from 'lucide-react';

function CardShell({ children }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-5">
      {/* soft projector glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/20 blur-[120px]" />
      <section className="glass relative w-full max-w-md animate-slide-up rounded-3xl p-8 text-center shadow-stage" role="alert">
        {children}
      </section>
    </main>
  );
}

/** Shown when GET /api/rooms/:code 404s or the socket emits ROOM_ERROR. */
export function RoomNotFound({ roomCode }) {
  return (
    <CardShell>
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 text-accent-soft">
        <Clapperboard size={28} />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-accent-soft">Error 404</p>
      <h1 className="mt-2 font-serif text-3xl text-app-text">Room Not Found</h1>
      {roomCode && (
        <p className="mt-4 inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-sm tracking-[0.25em] text-app-text/80 line-through decoration-rose-400/70">
          {roomCode}
        </p>
      )}
      <p className="mx-auto mt-4 max-w-xs text-sm leading-relaxed text-muted">
        This room doesn’t exist or has expired. Double-check the code, or ask the host for a fresh invite link.
      </p>
      <Link href="/" className="btn-primary mt-7 w-full py-3">
        <Home size={16} />
        Return to Home
      </Link>
    </CardShell>
  );
}

/** Shown when the room can't be validated because the sync server is unreachable. */
export function ServerUnreachable({ serverUrl, onRetry }) {
  return (
    <CardShell>
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 text-amber-300">
        <WifiOff size={28} />
      </div>
      <h1 className="font-serif text-2xl text-app-text">Can’t reach the sync server</h1>
      <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted">
        Tried <span className="break-all font-mono text-app-text/80">{serverUrl}</span>. Make sure the server is running and port
        5000 is reachable from this device.
      </p>
      <div className="mt-7 flex gap-2">
        <button type="button" onClick={onRetry} className="btn-primary flex-1 py-3">
          <RotateCw size={16} /> Try again
        </button>
        <Link href="/" className="btn-ghost flex-1 py-3">
          <Home size={16} /> Return to Home
        </Link>
      </div>
    </CardShell>
  );
}
