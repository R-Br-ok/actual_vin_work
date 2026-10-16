'use client';

import React, { useState } from 'react';
import { RoomProvider, useRoom } from '../../../context/RoomContext';
import { RoomHeader } from '../../../components/header/RoomHeader';
import { VideoSyncPlayer } from '../../../components/player/VideoSyncPlayer';
import { ChatBox } from '../../../components/social/ChatBox';
import { PlaylistQueue } from '../../../components/social/PlaylistQueue';
import { MovieDiscoveryModal } from '../../../components/discovery/MovieDiscoveryModal';
import { MessageSquare, ListVideo } from 'lucide-react';

function RoomContent() {
  const { roomCode, isLoading, error } = useRoom();
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'playlist'
  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ink flex flex-col items-center justify-center gap-4 text-app-text">
        <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="font-serif text-lg text-muted">Entering Party Room {roomCode}...</p>
        <p className="text-xs text-muted/70">Synchronizing clock with server...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-ink flex flex-col items-center justify-center p-6 text-center text-app-text">
        <h2 className="font-serif text-2xl text-rose-400 mb-2">Room Error</h2>
        <p className="text-sm text-muted max-w-md mb-6">{error}</p>
        <a
          href="/"
          className="px-5 py-2.5 rounded bg-accent text-accent-ink font-semibold text-xs tracking-wider uppercase hover:opacity-90 transition"
        >
          Return to Home
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink text-app-text flex flex-col">
      {/* Top Header */}
      <RoomHeader onOpenDiscovery={() => setIsDiscoveryOpen(true)} />

      {/* Main Watch Party Cinema Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 flex flex-col lg:flex-row gap-6">
        {/* Left Column: Cinema Video Player Stage */}
        <div className="flex-1 flex flex-col min-w-0">
          <VideoSyncPlayer />
        </div>

        {/* Right Column: Interactive Sidebar (Chat & Queue) */}
        <div className="w-full lg:w-80 xl:w-96 flex flex-col flex-shrink-0 min-h-[520px]">
          {/* Sidebar Tab Switcher */}
          <div className="flex border-b border-line bg-panel rounded-t-lg overflow-hidden">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold tracking-wider uppercase transition ${
                activeTab === 'chat'
                  ? 'border-b-2 border-accent text-accent bg-panel-soft/40'
                  : 'text-muted hover:text-app-text hover:bg-panel-soft/20'
              }`}
            >
              <MessageSquare size={14} />
              <span>Chat</span>
            </button>
            <button
              onClick={() => setActiveTab('playlist')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold tracking-wider uppercase transition ${
                activeTab === 'playlist'
                  ? 'border-b-2 border-accent text-accent bg-panel-soft/40'
                  : 'text-muted hover:text-app-text hover:bg-panel-soft/20'
              }`}
            >
              <ListVideo size={14} />
              <span>Queue</span>
            </button>
          </div>

          {/* Active Tab Component */}
          <div className="flex-1 flex flex-col min-h-0 bg-panel rounded-b-lg">
            {activeTab === 'chat' ? (
              <ChatBox />
            ) : (
              <PlaylistQueue onOpenDiscovery={() => setIsDiscoveryOpen(true)} />
            )}
          </div>
        </div>
      </main>

      {/* Movie Discovery Modal */}
      <MovieDiscoveryModal
        isOpen={isDiscoveryOpen}
        onClose={() => setIsDiscoveryOpen(false)}
      />
    </div>
  );
}

export default function RoomPage({ params }) {
  const code = params?.code;

  // Generate a friendly handle for this session
  const [username] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('party_username');
      if (stored) return stored;
      const generated = `User_${Math.floor(1000 + Math.random() * 9000)}`;
      sessionStorage.setItem('party_username', generated);
      return generated;
    }
    return `User_${Math.floor(1000 + Math.random() * 9000)}`;
  });

  return (
    <RoomProvider roomCode={code} username={username}>
      <RoomContent />
    </RoomProvider>
  );
}
