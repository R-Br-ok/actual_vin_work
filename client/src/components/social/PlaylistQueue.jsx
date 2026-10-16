'use client';

import React, { useState } from 'react';
import { ListVideo, Play, Trash2, Plus, Sparkles } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';

export function PlaylistQueue({ onOpenDiscovery }) {
  const { playlist, isHost, removeFromPlaylist, playNow, addToPlaylist } = useRoom();
  const [customUrl, setCustomUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');

  const handleAddCustom = (e) => {
    e.preventDefault();
    if (!customUrl.trim()) return;

    addToPlaylist({
      id: `custom-${Date.now()}`,
      title: customTitle.trim() || 'Custom Stream',
      meta: 'Custom URL',
      genre: 'Direct Stream',
      image: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?auto=format&fit=crop&w=400&q=80',
      videoUrl: customUrl.trim(),
    });

    setCustomUrl('');
    setCustomTitle('');
  };

  return (
    <div className="flex flex-col h-full rounded-lg border border-line bg-panel overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-panel-soft/50">
        <div className="flex items-center gap-2">
          <ListVideo size={16} className="text-accent" />
          <span className="font-semibold text-xs tracking-wider uppercase text-app-text">Watch Queue</span>
        </div>
        <button
          onClick={onOpenDiscovery}
          className="flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
        >
          <Sparkles size={12} />
          <span>Browse Catalog</span>
        </button>
      </div>

      {/* Playlist Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[380px]">
        {playlist.length === 0 ? (
          <div className="text-center py-8 text-muted text-xs">
            The queue is empty. Add a movie to keep the party rolling!
          </div>
        ) : (
          playlist.map((item, index) => (
            <div
              key={`${item.id}-${index}`}
              className="flex items-center gap-3 p-2 rounded border border-line/60 bg-panel-soft/40 hover:bg-panel-soft transition group"
            >
              {/* Thumbnail */}
              <div className="relative w-14 h-9 rounded overflow-hidden flex-shrink-0 bg-ink border border-line">
                <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                {index === 0 && (
                  <span className="absolute bottom-0 inset-x-0 bg-accent text-accent-ink text-[8px] font-bold text-center">
                    PLAYING
                  </span>
                )}
              </div>

              {/* Title & Metadata */}
              <div className="flex-1 min-w-0 text-xs">
                <h4 className="font-medium text-app-text truncate">{item.title}</h4>
                <p className="text-[10px] text-muted truncate">{item.meta || item.genre}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                {isHost && (
                  <button
                    onClick={() => playNow(item)}
                    className="p-1 rounded hover:bg-white/10 text-accent transition"
                    title="Play Now"
                  >
                    <Play size={14} fill="currentColor" />
                  </button>
                )}
                {isHost && (
                  <button
                    onClick={() => removeFromPlaylist(index)}
                    className="p-1 rounded hover:bg-white/10 text-muted hover:text-rose-400 transition"
                    title="Remove from Queue"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Custom Video Input */}
      {isHost && (
        <form onSubmit={handleAddCustom} className="p-3 border-t border-line bg-panel-soft/30 space-y-2">
          <input
            type="url"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="Paste MP4 / WebM video URL..."
            className="w-full bg-ink border border-line rounded px-2.5 py-1.5 text-xs text-app-text placeholder-muted focus:outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Title (optional)"
              className="flex-1 bg-ink border border-line rounded px-2.5 py-1 text-xs text-app-text placeholder-muted focus:outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={!customUrl.trim()}
              className="flex items-center gap-1 px-3 py-1 rounded bg-panel-soft border border-line hover:border-accent text-app-text text-xs disabled:opacity-40 transition"
            >
              <Plus size={12} />
              <span>Queue</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
