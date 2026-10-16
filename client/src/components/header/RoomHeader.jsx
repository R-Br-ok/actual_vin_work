'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Copy, Check, Crown, Film, Users, Eye } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';
import { copyToClipboard, cn } from '../../lib/utils';
import { Avatar } from '../ui/Avatar';

const MAX_VISIBLE_AVATARS = 5;

export function RoomHeader({ onOpenDiscovery }) {
  const { roomCode, isHost, users, selfId, isConnected, isRejoining } = useRoom();
  const [copied, setCopied] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const rosterRef = useRef(null);

  const host = users.find((u) => u.isHost);
  const visible = users.slice(0, MAX_VISIBLE_AVATARS);
  const overflow = users.length - visible.length;

  useEffect(() => {
    if (!showRoster) return undefined;
    const close = (e) => {
      if (rosterRef.current && !rosterRef.current.contains(e.target)) setShowRoster(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [showRoster]);

  const handleCopyInvite = async () => {
    const ok = await copyToClipboard(`${window.location.origin}/room/${roomCode}`);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const live = isConnected && !isRejoining;

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3 md:px-6">
        {/* Left: brand + room code pill */}
        <div className="flex min-w-0 items-center gap-3 md:gap-5">
          <Link href="/" className="logo group select-none" aria-label="FRAME home">
            <span className="logo-mark transition-colors group-hover:border-accent">
              <span />
              <span />
            </span>
            <span className="hidden text-sm text-app-text sm:inline">FRAME</span>
          </Link>

          <button
            type="button"
            onClick={handleCopyInvite}
            className="group flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-3 pr-1.5 transition hover:border-accent/50 hover:bg-accent/10"
            title="Copy invite link"
          >
            <span
              className={cn('h-2 w-2 flex-shrink-0 rounded-full', live ? 'bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/70' : 'animate-pulse bg-amber-400')}
              title={live ? 'Live' : 'Reconnecting…'}
            />
            <span className="hidden text-[10px] font-bold uppercase tracking-[0.18em] text-muted sm:inline">Room</span>
            <span className="font-mono text-sm font-semibold tracking-[0.2em] text-app-text">{roomCode}</span>
            <span
              className={cn(
                'flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition',
                copied ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.06] text-muted group-hover:bg-accent group-hover:text-accent-ink'
              )}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy link'}</span>
            </span>
          </button>
        </div>

        {/* Right: participants, role badge, browse */}
        <div className="flex items-center gap-2 md:gap-3">
          <div className="relative" ref={rosterRef}>
            <button
              type="button"
              onClick={() => setShowRoster((v) => !v)}
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition hover:bg-white/[0.06]"
              aria-expanded={showRoster}
              aria-label={`${users.length} participants`}
            >
              <span className="flex -space-x-2">
                {visible.map((u) => (
                  <Avatar key={u.socketId} name={u.username} isHost={u.isHost} size={28} title={`${u.username}${u.isHost ? ' (host)' : ''}`} />
                ))}
                {overflow > 0 && (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-panel-soft text-[10px] font-bold text-muted ring-2 ring-ink">
                    +{overflow}
                  </span>
                )}
              </span>
              <span className="hidden items-center gap-1 text-xs font-semibold text-muted lg:flex">
                <Users size={13} />
                {users.length}
              </span>
            </button>

            {showRoster && (
              <div className="glass absolute right-0 mt-2 w-64 animate-fade-in rounded-2xl p-2 shadow-stage">
                <div className="px-2.5 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                  In the room · {users.length}
                </div>
                <ul className="max-h-72 space-y-0.5 overflow-y-auto">
                  {users.map((u) => (
                    <li key={u.socketId} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-white/[0.05]">
                      <Avatar name={u.username} size={26} ring={false} />
                      <span className="min-w-0 flex-1 truncate text-sm text-app-text">
                        {u.username}
                        {u.socketId === selfId && <span className="ml-1 text-muted">(you)</span>}
                      </span>
                      {u.isHost && (
                        <span className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                          <Crown size={10} className="fill-amber-300" /> HOST
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {isHost ? (
            <span className="flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-bold tracking-wide text-amber-300">
              <Crown size={12} className="fill-amber-300" />
              <span className="hidden sm:inline">HOST</span>
            </span>
          ) : (
            <span
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-muted"
              title={host ? `${host.username} is hosting` : undefined}
            >
              <Eye size={12} />
              <span className="hidden sm:inline">VIEWER</span>
            </span>
          )}

          <button type="button" onClick={onOpenDiscovery} className="btn-primary px-3 py-2 md:px-4">
            <Film size={15} />
            <span className="hidden sm:inline">Browse Movies</span>
          </button>
        </div>
      </div>
    </header>
  );
}
