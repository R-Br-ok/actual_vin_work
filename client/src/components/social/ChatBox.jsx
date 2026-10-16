'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Crown, MessageSquare } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';
import { getAvatarColor, formatTime } from '../../lib/utils';

export function ChatBox() {
  const { chatMessages, sendChatMessage, users } = useRoom();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendChatMessage(inputText);
    setInputText('');
  };

  return (
    <div className="flex flex-col h-full rounded-lg border border-line bg-panel overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-panel-soft/50">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-accent" />
          <span className="font-semibold text-xs tracking-wider uppercase text-app-text">Party Chat</span>
        </div>
        <span className="text-[11px] text-muted">{users.length} online</span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[460px]">
        {chatMessages.map((msg) => {
          if (msg.isSystem) {
            return (
              <div key={msg.id} className="text-center my-2">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-line-soft/80 text-muted border border-line">
                  {msg.text}
                </span>
              </div>
            );
          }

          const avatarColor = getAvatarColor(msg.sender);

          return (
            <div key={msg.id} className="flex items-start gap-2.5 text-xs">
              {/* Avatar circle */}
              <div
                className="flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-black flex-shrink-0 mt-0.5"
                style={{ backgroundColor: avatarColor }}
              >
                {msg.sender.substring(0, 2).toUpperCase()}
              </div>

              {/* Message body */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="font-semibold text-app-text truncate">{msg.sender}</span>
                  {msg.isHost && (
                    <Crown size={12} className="text-amber-400 fill-amber-400 flex-shrink-0" title="Host" />
                  )}
                  <span className="text-[10px] text-muted ml-auto flex-shrink-0">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-muted leading-relaxed break-words bg-panel-soft/60 rounded px-2.5 py-1.5 border border-line/50">
                  {msg.text}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Field */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-line bg-panel-soft/30 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Say something to the room..."
          className="flex-1 bg-ink border border-line rounded px-3 py-2 text-xs text-app-text placeholder-muted focus:outline-none focus:border-accent transition"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="flex items-center justify-center w-8 h-8 rounded bg-accent text-accent-ink hover:opacity-90 disabled:opacity-40 transition flex-shrink-0"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
