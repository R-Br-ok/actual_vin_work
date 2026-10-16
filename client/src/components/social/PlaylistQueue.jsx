'use client';

import React, { useState } from 'react';
import { Play, Trash2, Plus, Sparkles, ChevronUp, ChevronDown, ListVideo, Link2, X } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';
import { PosterImage } from '../ui/PosterImage';
import { cn } from '../../lib/utils';

export function PlaylistQueue({ onOpenDiscovery }) {
  const { queue, roomState, isHost, selfId, removeFromQueue, moveQueueItem, clearQueue, playFromQueue, addToQueue } = useRoom();
  const [customUrl, setCustomUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const nowPlaying = roomState?.currentMovie;
  const playing = roomState?.playbackState === 'PLAYING';

  const handleAddCustom = (e) => {
    e.preventDefault();
    const url = customUrl.trim();
    if (!url) return;
    addToQueue({
      id: `custom-${Date.now()}`,
      title: customTitle.trim() || decodeURIComponent(url.split('/').pop() || 'Custom stream').slice(0, 60),
      meta: 'Custom URL',
      genre: 'Direct stream',
      videoUrl: url,
    });
    setCustomUrl('');
    setCustomTitle('');
    setShowCustom(false);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Now playing */}
        {nowPlaying && (
          <section>
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Now playing</h3>
            <div className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-2.5">
              <div className="relative h-12 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-ink">
                <PosterImage src={nowPlaying.image} alt={nowPlaying.title} />
                {playing && (
                  <span className="absolute bottom-1 left-1 flex items-end gap-[2px]" aria-hidden="true">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="w-[3px] animate-pulse rounded-sm bg-white" style={{ height: 6 + (d / 150) * 3, animationDelay: `${d}ms` }} />
                    ))}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-app-text">{nowPlaying.title}</p>
                <p className="truncate text-[11px] text-muted">{nowPlaying.meta || nowPlaying.genre || 'Direct stream'}</p>
              </div>
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', playing ? 'bg-rose-500/90 text-white' : 'bg-white/10 text-muted')}>
                {playing ? 'LIVE' : 'PAUSED'}
              </span>
            </div>
          </section>
        )}

        {/* Up next */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Up next · {queue.length}</h3>
            {isHost && queue.length > 0 && (
              <button type="button" onClick={clearQueue} className="text-[11px] font-medium text-muted transition hover:text-rose-300">
                Clear
              </button>
            )}
          </div>

          {queue.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center">
              <ListVideo size={22} className="text-muted" />
              <p className="text-xs text-muted">The queue is empty. Anyone in the room can add something.</p>
              <button type="button" onClick={onOpenDiscovery} className="btn-ghost text-xs">
                <Sparkles size={13} className="text-accent-soft" /> Browse movies
              </button>
            </div>
          ) : (
            <ol className="space-y-1.5">
              {queue.map((item, index) => {
                const canRemove = isHost || item.addedBySocketId === selfId;
                return (
                  <li key={item.queueId} className="group flex items-center gap-3 rounded-xl p-2 transition hover:bg-white/[0.05]">
                    <span className="w-4 text-center font-mono text-[11px] text-muted">{index + 1}</span>
                    <div className="h-10 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-ink">
                      <PosterImage src={item.image} alt={item.title} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-app-text">{item.title}</p>
                      <p className="truncate text-[11px] text-muted">
                        {item.meta || item.genre}
                        {item.addedBy && <span className="text-muted/70"> · added by {item.addedBySocketId === selfId ? 'you' : item.addedBy}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-100 transition md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                      {isHost && (
                        <>
                          <button type="button" onClick={() => playFromQueue(item)} className="icon-btn h-8 w-8 text-accent-soft" aria-label={`Play ${item.title} now`} title="Play now">
                            <Play size={14} fill="currentColor" />
                          </button>
                          <button type="button" onClick={() => moveQueueItem(item.queueId, index - 1)} disabled={index === 0} className="icon-btn h-8 w-8" aria-label="Move up">
                            <ChevronUp size={15} />
                          </button>
                          <button type="button" onClick={() => moveQueueItem(item.queueId, index + 1)} disabled={index === queue.length - 1} className="icon-btn h-8 w-8" aria-label="Move down">
                            <ChevronDown size={15} />
                          </button>
                        </>
                      )}
                      {canRemove && (
                        <button type="button" onClick={() => removeFromQueue(item.queueId)} className="icon-btn h-8 w-8 hover:text-rose-300" aria-label={`Remove ${item.title}`}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      {/* Add */}
      <div className="border-t border-white/[0.06] p-3">
        {showCustom ? (
          <form onSubmit={handleAddCustom} className="space-y-2 animate-slide-up">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted">Add a direct video link (.mp4 / .webm)</span>
              <button type="button" onClick={() => setShowCustom(false)} className="icon-btn h-7 w-7" aria-label="Cancel">
                <X size={14} />
              </button>
            </div>
            <input type="url" value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="https://…/movie.mp4" className="input py-2 text-xs" required autoFocus />
            <div className="flex gap-2">
              <input type="text" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} placeholder="Title (optional)" className="input py-2 text-xs" />
              <button type="submit" disabled={!customUrl.trim()} className="btn-primary px-3 py-2 text-xs">
                <Plus size={13} /> Queue
              </button>
            </div>
          </form>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={onOpenDiscovery} className="btn-primary flex-1 py-2 text-xs">
              <Sparkles size={14} /> Browse catalog
            </button>
            <button type="button" onClick={() => setShowCustom(true)} className="btn-ghost py-2 text-xs" title="Add a link">
              <Link2 size={14} /> Link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
