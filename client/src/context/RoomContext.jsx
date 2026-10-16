'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSocket } from './SocketContext';
import { useClockSync } from '../hooks/useClockSync';
import { SOCKET_EVENTS } from '../lib/constants';

const RoomContext = createContext(null);

const MAX_CHAT_MESSAGES = 200;
const MAX_LIVE_REACTIONS = 40;
const REACTION_LIFETIME_MS = 3200;

function systemMessage(text) {
  return {
    id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sender: 'System',
    text,
    timestamp: Date.now(),
    isSystem: true,
  };
}

function normalizeMessage(msg) {
  return {
    id: msg.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sender: msg.username || msg.sender || 'Anonymous',
    text: msg.message || msg.text || '',
    timestamp: msg.timestamp || Date.now(),
    isHost: Boolean(msg.isHost),
    socketId: msg.socketId,
  };
}

/** Picks just the media-anchor fields out of a server payload. */
function anchorFrom(payload) {
  const anchor = {};
  if (payload.playbackState) anchor.playbackState = payload.playbackState;
  if (payload.mediaTime !== undefined) anchor.mediaTime = Number(payload.mediaTime) || 0;
  const ts = payload.targetTimestamp ?? payload.serverTimestamp;
  if (ts !== undefined) anchor.targetTimestamp = Number(ts);
  if (payload.playbackRate !== undefined) anchor.playbackRate = Number(payload.playbackRate) || 1;
  return anchor;
}

export function RoomProvider({ roomCode: initialRoomCode, username = 'Guest', children }) {
  const { socket, isConnected, connectionError } = useSocket();
  const clock = useClockSync(socket, isConnected);
  const { getServerTime } = clock;

  const [roomCode, setRoomCode] = useState(initialRoomCode?.toUpperCase() || '');
  const [selfId, setSelfId] = useState(null);
  const [roomState, setRoomState] = useState(null);
  // Bumped whenever playback must be re-aligned immediately (join, control action, video change).
  // STATE_SYNC heartbeats update the anchor silently and leave correction to the 3s drift loop.
  const [syncEpoch, setSyncEpoch] = useState(0);
  const [lastEvent, setLastEvent] = useState(null);
  const [users, setUsers] = useState([]);
  const [queue, setQueue] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRejoining, setIsRejoining] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const hasJoinedRef = useRef(false);
  const roomStateRef = useRef(null);
  roomStateRef.current = roomState;
  const noticeTimerRef = useRef(null);

  const isHost = Boolean(roomState && selfId && roomState.hostSocketId === selfId);

  const showNotice = useCallback((text, tone = 'error') => {
    setNotice({ text, tone, id: Date.now() });
    clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 4000);
  }, []);

  const pushChat = useCallback((entry) => {
    setChatMessages((prev) => {
      if (prev.some((m) => m.id === entry.id)) return prev;
      const next = [...prev, entry];
      return next.length > MAX_CHAT_MESSAGES ? next.slice(-MAX_CHAT_MESSAGES) : next;
    });
  }, []);

  // 1. Join (and transparently re-join after reconnects) — consumes the late-join snapshot
  useEffect(() => {
    if (!socket || !isConnected || !roomCode) return;

    if (hasJoinedRef.current) setIsRejoining(true);
    else setIsLoading(true);

    socket.timeout(8000).emit(SOCKET_EVENTS.JOIN_ROOM, { roomCode, username }, (err, response) => {
      setIsRejoining(false);
      if (err || !response?.success) {
        const message = err ? 'The sync server did not answer in time.' : response?.message || 'Failed to join room';
        if (!hasJoinedRef.current) setError(message);
        else showNotice(message);
        setIsLoading(false);
        return;
      }

      const firstJoin = !hasJoinedRef.current;
      hasJoinedRef.current = true;

      setSelfId(response.selfSocketId || socket.id);
      setRoomCode(response.roomCode);
      setRoomState(response.roomState);
      setUsers(response.users || []);
      setQueue(response.queue || response.roomState?.queue || []);
      setLastEvent({ type: 'JOIN', issuedBy: null });
      setSyncEpoch((n) => n + 1);

      if (firstJoin) {
        const history = (response.messages || []).map(normalizeMessage);
        setChatMessages([
          ...history,
          systemMessage(
            response.isHost
              ? `You're hosting room ${response.roomCode}. Share the link to invite friends.`
              : `Joined room ${response.roomCode}. Playback follows the host.`
          ),
        ]);
      }
      setError(null);
      setIsLoading(false);
    });
  }, [socket, isConnected, roomCode, username, showNotice]);

  // 2. Real-time listeners
  useEffect(() => {
    if (!socket) return undefined;

    const handleUserJoined = (data) => {
      if (Array.isArray(data.users)) setUsers(data.users);
      else
        setUsers((prev) =>
          prev.some((u) => u.socketId === data.socketId)
            ? prev
            : [...prev, { socketId: data.socketId, username: data.username, joinedAt: data.joinedAt, isHost: false }]
        );
      pushChat(systemMessage(`${data.username} joined the party.`));
    };

    const handleUserLeft = (data) => {
      if (Array.isArray(data.users)) setUsers(data.users);
      else setUsers((prev) => prev.filter((u) => u.socketId !== data.socketId));
      if (data.username) pushChat(systemMessage(`${data.username} left.`));
    };

    const handleHostChanged = (data) => {
      setRoomState((prev) => (prev ? { ...prev, hostSocketId: data.newHostSocketId } : prev));
      setUsers((prev) => prev.map((u) => ({ ...u, isHost: u.socketId === data.newHostSocketId })));
      pushChat(
        systemMessage(
          socket.id === data.newHostSocketId
            ? 'You are now the host — playback controls are yours.'
            : `${data.newHostUsername || 'The longest-connected viewer'} is now hosting.`
        )
      );
    };

    const handleControlBroadcast = (payload) => {
      setRoomState((prev) => (prev ? { ...prev, ...anchorFrom(payload), videoUrl: payload.videoUrl || prev.videoUrl } : prev));
      setLastEvent({ type: 'CONTROL', action: payload.action, issuedBy: payload.issuedBy });
      setSyncEpoch((n) => n + 1);
    };

    const handleVideoChanged = (payload) => {
      setRoomState((prev) => ({
        ...(prev || {}),
        ...anchorFrom(payload),
        videoUrl: payload.videoUrl,
        currentMovie: payload.movie || { title: 'Custom stream', videoUrl: payload.videoUrl },
      }));
      setLastEvent({ type: 'VIDEO', autoplay: payload.autoplay, issuedBy: payload.issuedBy });
      setSyncEpoch((n) => n + 1);
      pushChat(systemMessage(`Now playing: ${payload.movie?.title || 'a new video'}`));
    };

    const handleStateSync = (payload) => {
      const prev = roomStateRef.current;
      setRoomState((current) => (current ? { ...current, ...anchorFrom(payload) } : current));
      // A heartbeat that flips play/pause (e.g. host used media keys) needs an immediate re-align
      if (prev && payload.playbackState && payload.playbackState !== prev.playbackState) {
        setLastEvent({ type: 'SYNC', issuedBy: null });
        setSyncEpoch((n) => n + 1);
      }
    };

    const handleQueueUpdated = (payload) => {
      if (Array.isArray(payload?.queue)) setQueue(payload.queue);
    };

    const handleNewMessage = (msg) => pushChat(normalizeMessage(msg));

    const handleReaction = (reaction) => {
      const formatted = {
        id: reaction.id || `react-${Date.now()}-${Math.random()}`,
        emoji: reaction.emoji,
        sender: reaction.username || reaction.sender || 'Anonymous',
        x: reaction.x ?? Math.random() * 80 + 10,
        drift: (Math.random() - 0.5) * 60,
        scale: 0.85 + Math.random() * 0.5,
      };
      setReactions((prev) => [...prev.slice(-(MAX_LIVE_REACTIONS - 1)), formatted]);
      setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== formatted.id)), REACTION_LIFETIME_MS);
    };

    const handleError = (payload) => {
      if (payload?.message) showNotice(payload.message);
    };

    socket.on(SOCKET_EVENTS.USER_JOINED, handleUserJoined);
    socket.on(SOCKET_EVENTS.USER_LEFT, handleUserLeft);
    socket.on(SOCKET_EVENTS.HOST_CHANGED, handleHostChanged);
    socket.on(SOCKET_EVENTS.CONTROL_ACTION_BROADCAST, handleControlBroadcast);
    socket.on(SOCKET_EVENTS.VIDEO_CHANGED, handleVideoChanged);
    socket.on(SOCKET_EVENTS.STATE_SYNC, handleStateSync);
    socket.on(SOCKET_EVENTS.QUEUE_UPDATED, handleQueueUpdated);
    socket.on(SOCKET_EVENTS.NEW_MESSAGE, handleNewMessage);
    socket.on(SOCKET_EVENTS.REACTION_BROADCAST, handleReaction);
    socket.on(SOCKET_EVENTS.ERROR, handleError);

    return () => {
      socket.off(SOCKET_EVENTS.USER_JOINED, handleUserJoined);
      socket.off(SOCKET_EVENTS.USER_LEFT, handleUserLeft);
      socket.off(SOCKET_EVENTS.HOST_CHANGED, handleHostChanged);
      socket.off(SOCKET_EVENTS.CONTROL_ACTION_BROADCAST, handleControlBroadcast);
      socket.off(SOCKET_EVENTS.VIDEO_CHANGED, handleVideoChanged);
      socket.off(SOCKET_EVENTS.STATE_SYNC, handleStateSync);
      socket.off(SOCKET_EVENTS.QUEUE_UPDATED, handleQueueUpdated);
      socket.off(SOCKET_EVENTS.NEW_MESSAGE, handleNewMessage);
      socket.off(SOCKET_EVENTS.REACTION_BROADCAST, handleReaction);
      socket.off(SOCKET_EVENTS.ERROR, handleError);
    };
  }, [socket, pushChat, showNotice]);

  useEffect(() => () => clearTimeout(noticeTimerRef.current), []);

  // 3. Host media controls — stamped with the host's server-clock time for a precise anchor
  const sendControlAction = useCallback(
    (action, mediaTime, playbackRate = 1.0) => {
      if (!socket || !isHost) return;
      socket.emit(SOCKET_EVENTS.CONTROL_ACTION, {
        roomCode,
        action,
        mediaTime,
        playbackRate,
        clientTimestamp: getServerTime(),
      });
    },
    [socket, isHost, roomCode, getServerTime]
  );

  const sendHeartbeat = useCallback(
    (mediaTime, playbackState) => {
      if (!socket || !isHost || !roomCode) return;
      socket.emit(SOCKET_EVENTS.HEARTBEAT, { roomCode, mediaTime, playbackState, clientTimestamp: getServerTime() });
    },
    [socket, isHost, roomCode, getServerTime]
  );

  // 4. Video switching (host)
  const changeVideo = useCallback(
    ({ movie, queueId, videoUrl, autoplay = true }) => {
      if (!socket) return;
      if (!isHost) {
        showNotice('Only the host can change what is playing. Add it to the queue instead.', 'info');
        return;
      }
      socket.emit(SOCKET_EVENTS.CHANGE_VIDEO, { roomCode, movie, queueId, videoUrl, autoplay });
    },
    [socket, isHost, roomCode, showNotice]
  );

  const playNow = useCallback((movie) => changeVideo({ movie }), [changeVideo]);
  const playFromQueue = useCallback((item) => changeVideo({ queueId: item.queueId }), [changeVideo]);
  const playNext = useCallback(() => {
    if (queue.length > 0) changeVideo({ queueId: queue[0].queueId });
  }, [queue, changeVideo]);

  // 5. Shared queue operations (server-authoritative)
  const emitQueue = useCallback(
    (payload) => {
      if (!socket || !roomCode) return;
      socket.emit(SOCKET_EVENTS.UPDATE_QUEUE, { roomCode, ...payload });
    },
    [socket, roomCode]
  );

  const addToQueue = useCallback(
    (movie) => {
      emitQueue({ op: 'ADD', item: movie });
      showNotice(`Added “${movie.title}” to the queue`, 'success');
    },
    [emitQueue, showNotice]
  );
  const removeFromQueue = useCallback((queueId) => emitQueue({ op: 'REMOVE', queueId }), [emitQueue]);
  const moveQueueItem = useCallback((queueId, toIndex) => emitQueue({ op: 'MOVE', queueId, toIndex }), [emitQueue]);
  const clearQueue = useCallback(() => emitQueue({ op: 'CLEAR' }), [emitQueue]);

  // 6. Social
  const sendChatMessage = useCallback(
    (text) => {
      const clean = text?.trim();
      if (!socket || !clean || !roomCode) return;
      socket.emit(SOCKET_EVENTS.SEND_MESSAGE, { roomCode, message: clean, username });
    },
    [socket, roomCode, username]
  );

  const triggerReaction = useCallback(
    (emoji) => {
      if (!socket || !roomCode) return;
      socket.emit(SOCKET_EVENTS.EMIT_REACTION, { roomCode, emoji, username });
    },
    [socket, roomCode, username]
  );

  const value = useMemo(
    () => ({
      roomCode,
      username,
      selfId,
      isHost,
      isConnected,
      connectionError,
      isLoading,
      isRejoining,
      error,
      notice,
      showNotice,
      roomState,
      syncEpoch,
      lastEvent,
      users,
      queue,
      // clock
      clockOffset: clock.clockOffset,
      rtt: clock.rtt,
      isSynced: clock.isSynced,
      getServerTime,
      // media
      sendControlAction,
      sendHeartbeat,
      changeVideo,
      playNow,
      playFromQueue,
      playNext,
      // queue
      addToQueue,
      removeFromQueue,
      moveQueueItem,
      clearQueue,
      // social
      chatMessages,
      sendChatMessage,
      reactions,
      triggerReaction,
    }),
    [
      roomCode, username, selfId, isHost, isConnected, connectionError, isLoading, isRejoining, error, notice,
      showNotice, roomState, syncEpoch, lastEvent, users, queue, clock.clockOffset, clock.rtt, clock.isSynced,
      getServerTime, sendControlAction, sendHeartbeat, changeVideo, playNow, playFromQueue, playNext, addToQueue,
      removeFromQueue, moveQueueItem, clearQueue, chatMessages, sendChatMessage, reactions, triggerReaction,
    ]
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom() {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
}
