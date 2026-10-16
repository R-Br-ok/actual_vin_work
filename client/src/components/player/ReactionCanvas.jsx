'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useRoom } from '../../context/RoomContext';
import { SOCKET_EVENTS } from '../../lib/constants';

const MAX_LIVE_PARTICLES = 40;
const PARTICLE_LIFETIME_MS = 3200;

/**
 * Floating emoji overlay rendered above the video for the host and every viewer.
 *
 * Subscribes to REACTION_BROADCAST directly. The server emits each reaction to the whole room
 * (io.to(roomCode)), so the sender sees their own emoji too and everyone sees the same particle.
 * Each particle rises with its own sideways drift and scale (CSS vars read by the keyframes).
 */
export function ReactionCanvas() {
  const { socket } = useSocket();
  const { selfId } = useRoom();
  const [particles, setParticles] = useState([]);
  const timersRef = useRef(new Set());
  const selfIdRef = useRef(selfId);
  selfIdRef.current = selfId;

  useEffect(() => {
    if (!socket) return undefined;
    const timers = timersRef.current;

    const handleReaction = (payload) => {
      if (!payload?.emoji) return;
      const particle = {
        id: payload.id || `react-${Date.now()}-${Math.random()}`,
        emoji: payload.emoji,
        label: payload.senderId && payload.senderId === selfIdRef.current ? 'You' : payload.senderName || payload.username || 'Someone',
        x: typeof payload.x === 'number' ? payload.x : Math.random() * 80 + 10,
        drift: (Math.random() - 0.5) * 70,
        scale: 0.85 + Math.random() * 0.5,
      };

      setParticles((prev) => {
        if (prev.some((p) => p.id === particle.id)) return prev;
        return [...prev.slice(-(MAX_LIVE_PARTICLES - 1)), particle];
      });

      const timer = setTimeout(() => {
        timers.delete(timer);
        setParticles((prev) => prev.filter((p) => p.id !== particle.id));
      }, PARTICLE_LIFETIME_MS);
      timers.add(timer);
    };

    socket.on(SOCKET_EVENTS.REACTION_BROADCAST, handleReaction);
    return () => {
      socket.off(SOCKET_EVENTS.REACTION_BROADCAST, handleReaction);
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, [socket]);

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-hidden="true" data-testid="reaction-canvas">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute bottom-20 flex animate-reaction-float flex-col items-center"
          style={{ left: `${p.x}%`, '--drift': `${p.drift}px`, '--scale': p.scale }}
          data-reaction={p.emoji}
        >
          <span className="text-4xl drop-shadow-[0_6px_14px_rgba(0,0,0,0.55)] md:text-5xl">{p.emoji}</span>
          <span className="mt-1 max-w-[120px] truncate rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
            {p.label}
          </span>
        </div>
      ))}
    </div>
  );
}
