'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Copy, Check, Users, Crown, Film } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';
import { copyToClipboard, getAvatarColor } from '../../lib/utils';

export function RoomHeader({ onOpenDiscovery }) {
  const { roomCode, isHost, users } = useRoom();
  const [copied, setCopied] = useState(false);
  const [showUsersList, setShowUsersList] = useState(false);

  const handleCopyInvite = async () => {
    const inviteUrl = `${window.location.origin}/room/${roomCode}`;
    const success = await copyToClipboard(inviteUrl);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-line bg-panel/90 backdrop-blur-md px-4 md:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Room Code */}
        <div className="flex items-center gap-6">
          <Link href="/" className="logo group select-none">
            <span className="logo-mark group-hover:border-accent transition-colors">
              <span />
              <span />
            </span>
            <span className="logo-word tracking-widest font-bold text-sm text-app-text">FRAME</span>
          </Link>

          {/* Room Code & Invite Link Copy */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-line bg-panel-soft/80">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">ROOM:</span>
            <span className="font-mono text-xs font-bold text-app-text tracking-widest">{roomCode}</span>
            <button
              onClick={handleCopyInvite}
              className="flex items-center gap-1 ml-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-line/80 hover:bg-accent hover:text-accent-ink text-muted transition"
              title="Copy Party Link"
            >
              {copied ? (
                <>
                  <Check size={11} className="text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={11} />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Browse Catalog, Host Status & Participants */}
        <div className="flex items-center gap-3">
          {/* Browse Catalog Button */}
          <button
            onClick={onOpenDiscovery}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded border border-line bg-panel-soft hover:border-accent hover:text-accent text-xs font-medium text-app-text transition"
          >
            <Film size={14} />
            <span>Browse Movies</span>
          </button>

          {/* Host Badge */}
          {isHost ? (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-accent/40 bg-accent/10 text-accent text-xs font-bold tracking-wide">
              <Crown size={13} className="fill-accent" />
              <span>HOST</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-line bg-panel-soft text-muted text-xs font-medium">
              <span>VIEWER</span>
            </div>
          )}

          {/* Active Participants Button with Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUsersList(!showUsersList)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-line bg-panel-soft hover:border-muted text-xs font-semibold text-app-text transition"
            >
              <Users size={14} className="text-secondary" />
              <span>{users.length}</span>
            </button>

            {/* Dropdown Roster */}
            {showUsersList && (
              <div className="absolute right-0 mt-2 w-56 rounded-lg border border-line bg-panel p-2 shadow-2xl z-50 animate-fade-in">
                <div className="px-2 py-1.5 border-b border-line text-[11px] font-bold text-muted uppercase">
                  Connected Users ({users.length})
                </div>
                <div className="max-h-48 overflow-y-auto py-1 space-y-1">
                  {users.map((u) => (
                    <div key={u.socketId} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-panel-soft text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <div
                          className="w-5 h-5 rounded-full text-[9px] font-bold text-black flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: getAvatarColor(u.username) }}
                        >
                          {u.username.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="truncate text-app-text">{u.username}</span>
                      </div>
                      {u.isHost && (
                        <Crown size={12} className="text-amber-400 fill-amber-400 flex-shrink-0" title="Host" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
