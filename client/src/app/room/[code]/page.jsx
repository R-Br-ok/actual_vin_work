'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, ListVideo, WifiOff, Loader2 } from 'lucide-react';
import { RoomProvider, useRoom } from '../../../context/RoomContext';
import { RoomHeader } from '../../../components/header/RoomHeader';
import { VideoSyncPlayer } from '../../../components/player/VideoSyncPlayer';
import { ChatBox } from '../../../components/social/ChatBox';
import { PlaylistQueue } from '../../../components/social/PlaylistQueue';
import { MovieDiscoveryModal } from '../../../components/discovery/MovieDiscoveryModal';
import { RoomNotFound, ServerUnreachable } from '../../../components/room/RoomNotFound';
import { getOrCreateUsername } from '../../../lib/identity';
import { getServerUrl, validateRoom } from '../../../lib/socket';
import { cn } from '../../../lib/utils';

function FullscreenMessage({ children }) {
  return <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">{children}</div>;
}

function NowPlayingDetails() {
  const { roomState, users } = useRoom();
  const movie = roomState?.currentMovie;
  if (!movie) return null;
  const host = users.find((u) => u.isHost);
  return (
    <div className="flex flex-col gap-1 px-1">
      <h1 className="font-serif text-2xl text-app-text md:text-3xl">{movie.title}</h1>
      <p className="text-xs text-muted">
        {[movie.meta, movie.genre].filter(Boolean).join(' · ')}
        {host && (
          <>
            {(movie.meta || movie.genre) && ' · '}hosted by <span className="font-semibold text-app-text/90">{host.username}</span>
          </>
        )}
      </p>
      {movie.subtitle && <p className="mt-1 max-w-2xl text-sm text-muted">{movie.subtitle}</p>}
    </div>
  );
}

function Toast() {
  const { notice } = useRoom();
  if (!notice) return null;
  const tone =
    notice.tone === 'success'
      ? 'border-emerald-400/30 text-emerald-200'
      : notice.tone === 'info'
        ? 'border-secondary/30 text-sky-200'
        : 'border-rose-400/30 text-rose-200';
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
      <div key={notice.id} className={cn('glass animate-slide-up rounded-full px-4 py-2 text-xs font-medium shadow-stage', tone)}>
        {notice.text}
      </div>
    </div>
  );
}

function RoomContent() {
  const { roomCode, isLoading, error, isConnected, connectionError, chatMessages, queue } = useRoom();
  const [activeTab, setActiveTab] = useState('chat');
  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
  const [seenChatCount, setSeenChatCount] = useState(0);
  const chatCount = useMemo(() => chatMessages.filter((m) => !m.isSystem).length, [chatMessages]);

  useEffect(() => {
    if (activeTab === 'chat') setSeenChatCount(chatCount);
  }, [activeTab, chatCount]);
  const unread = activeTab === 'chat' ? 0 : Math.max(0, chatCount - seenChatCount);

  if (error?.kind === 'not_found') {
    return <RoomNotFound roomCode={roomCode} />;
  }

  if (error) {
    return (
      <FullscreenMessage>
        <h2 className="font-serif text-2xl text-rose-300">Couldn’t join room {roomCode}</h2>
        <p className="max-w-md text-sm text-muted">{error.message}</p>
        <Link href="/" className="btn-primary">
          Back to home
        </Link>
      </FullscreenMessage>
    );
  }

  if (isLoading) {
    return (
      <FullscreenMessage>
        {!isConnected && connectionError ? (
          <>
            <WifiOff size={30} className="text-amber-300" />
            <h2 className="font-serif text-xl text-app-text">Can’t reach the sync server</h2>
            <p className="max-w-md text-sm text-muted">
              Trying <span className="font-mono text-app-text/80">{getServerUrl()}</span>. Make sure the server is running
              (<span className="font-mono">cd server && npm run dev</span>) and that port 5000 is reachable from this device.
            </p>
            <p className="text-xs text-muted/70">Retrying automatically…</p>
          </>
        ) : (
          <>
            <Loader2 size={32} className="animate-spin text-accent" />
            <p className="font-serif text-lg text-app-text">Entering room {roomCode}</p>
            <p className="text-xs text-muted">Synchronising clocks with the server…</p>
          </>
        )}
      </FullscreenMessage>
    );
  }

  const tabs = [
    { id: 'chat', label: 'Chat', icon: MessageSquare, badge: unread },
    { id: 'queue', label: 'Queue', icon: ListVideo, badge: queue.length },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <RoomHeader onOpenDiscovery={() => setIsDiscoveryOpen(true)} />

      {!isConnected && (
        <div className="border-b border-amber-400/20 bg-amber-400/10 px-4 py-2 text-center text-xs text-amber-200">
          Connection lost — reconnecting and re-syncing…
        </div>
      )}

      <main className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-5 p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* Video stage */}
        <section className="flex min-w-0 flex-col gap-5">
          <VideoSyncPlayer />
          <NowPlayingDetails />
        </section>

        {/* Interactive sidebar */}
        <aside className="glass flex h-[600px] min-h-0 flex-col overflow-hidden rounded-3xl lg:sticky lg:top-[84px] lg:h-[calc(100vh-108px)]">
          <div className="flex gap-1 border-b border-white/[0.06] p-1.5" role="tablist">
            {tabs.map(({ id, label, icon: Icon, badge }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-semibold transition',
                  activeTab === id ? 'bg-white/[0.08] text-app-text' : 'text-muted hover:bg-white/[0.04] hover:text-app-text'
                )}
              >
                <Icon size={14} className={activeTab === id ? 'text-accent-soft' : undefined} />
                {label}
                {badge > 0 && (
                  <span className={cn('min-w-[18px] rounded-full px-1.5 text-[10px] leading-[18px]', id === 'chat' ? 'bg-accent text-white' : 'bg-white/10 text-app-text/80')}>
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            {activeTab === 'chat' ? <ChatBox /> : <PlaylistQueue onOpenDiscovery={() => setIsDiscoveryOpen(true)} />}
          </div>
        </aside>
      </main>

      <MovieDiscoveryModal isOpen={isDiscoveryOpen} onClose={() => setIsDiscoveryOpen(false)} />
      <Toast />
    </div>
  );
}

/**
 * Next.js 14: `params` is a plain object for client pages — read params.code directly
 * (React's use(params) is only needed from Next 15 onwards).
 *
 * Flow: validate the code over REST (GET /api/rooms/:code) → only if it exists mount the
 * RoomProvider, which opens the socket and emits JOIN_ROOM. Unknown codes never connect.
 */
export default function RoomPage({ params }) {
  const code = decodeURIComponent(params.code || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
  // Read the stored display name after mount so server and client markup match
  const [username, setUsername] = useState(null);
  // 'checking' | 'ok' | 'not_found' | 'unreachable'
  const [validation, setValidation] = useState('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setUsername(getOrCreateUsername());
  }, []);

  useEffect(() => {
    if (!code) {
      setValidation('not_found');
      return undefined;
    }
    let cancelled = false;
    setValidation('checking');
    validateRoom(code).then((result) => {
      if (!cancelled) setValidation(result.status);
    });
    return () => {
      cancelled = true;
    };
  }, [code, attempt]);

  if (validation === 'not_found') {
    return <RoomNotFound roomCode={code} />;
  }

  if (validation === 'unreachable') {
    return <ServerUnreachable serverUrl={getServerUrl()} onRetry={() => setAttempt((n) => n + 1)} />;
  }

  if (validation === 'checking' || !username) {
    return (
      <FullscreenMessage>
        <Loader2 size={32} className="animate-spin text-accent" />
        <p className="text-xs text-muted">Looking up room {code}…</p>
      </FullscreenMessage>
    );
  }

  return (
    <RoomProvider roomCode={code} username={username}>
      <RoomContent />
    </RoomProvider>
  );
}
