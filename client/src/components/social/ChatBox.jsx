'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Crown, MessageSquare } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';
import { cn } from '../../lib/utils';
import { Avatar } from '../ui/Avatar';

function timeLabel(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatBox() {
  const { chatMessages, sendChatMessage, selfId, isConnected } = useRoom();
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef(null);
  const stickToBottomRef = useRef(true);

  // Auto-scroll only if the reader is already near the bottom
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottomRef.current) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [chatMessages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    stickToBottomRef.current = true;
    sendChatMessage(inputText);
    setInputText('');
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {chatMessages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted">
            <MessageSquare size={22} />
            <p className="text-xs">No messages yet — say hi.</p>
          </div>
        )}

        {chatMessages.map((msg, i) => {
          if (msg.isSystem) {
            return (
              <div key={msg.id} className="flex justify-center">
                <span className="rounded-full bg-white/[0.05] px-3 py-1 text-center text-[11px] text-muted">{msg.text}</span>
              </div>
            );
          }

          const mine = msg.socketId && msg.socketId === selfId;
          const prev = chatMessages[i - 1];
          const grouped = prev && !prev.isSystem && prev.sender === msg.sender && msg.timestamp - prev.timestamp < 60000;

          return (
            <div key={msg.id} className={cn('flex items-end gap-2', mine && 'flex-row-reverse', grouped && '-mt-1.5')}>
              <div className="w-7 flex-shrink-0">{!mine && !grouped && <Avatar name={msg.sender} size={28} ring={false} />}</div>
              <div className={cn('flex min-w-0 max-w-[80%] flex-col', mine ? 'items-end' : 'items-start')}>
                {!grouped && (
                  <div className={cn('mb-1 flex items-center gap-1.5 text-[11px]', mine && 'flex-row-reverse')}>
                    <span className="font-semibold text-app-text/90">{mine ? 'You' : msg.sender}</span>
                    {msg.isHost && <Crown size={11} className="fill-amber-300 text-amber-300" aria-label="host" />}
                    <span className="text-muted/70">{timeLabel(msg.timestamp)}</span>
                  </div>
                )}
                <p
                  className={cn(
                    'whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed',
                    mine ? 'rounded-br-md bg-accent text-white' : 'rounded-bl-md bg-white/[0.06] text-app-text/90'
                  )}
                >
                  {msg.text}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-white/[0.06] p-3">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          maxLength={500}
          placeholder={isConnected ? 'Message the room…' : 'Reconnecting…'}
          disabled={!isConnected}
          className="input rounded-full py-2"
          aria-label="Chat message"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || !isConnected}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent-soft disabled:opacity-40"
          aria-label="Send"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
