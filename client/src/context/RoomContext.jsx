'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './SocketContext';
import { useClockSync } from '../hooks/useClockSync';
import { SOCKET_EVENTS, PLAYBACK_STATE, CONTROL_TYPE } from '../lib/constants';
import { MOCK_MOVIES } from '../data/mockMovies';

const RoomContext = createContext(null);

export function RoomProvider({ roomCode: initialRoomCode, username = 'MovieBuff', children }) {
  const { socket, isConnected } = useSocket();
  const { clockOffset, rtt, isSynced, getServerTime } = useClockSync(socket, isConnected);

  const [roomCode, setRoomCode] = useState(initialRoomCode?.toUpperCase() || '');
  const [isHost, setIsHost] = useState(false);
  const [roomState, setRoomState] = useState(null);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Social Features State
  const [chatMessages, setChatMessages] = useState([
    {
      id: 'welcome-msg',
      sender: 'System',
      text: 'Welcome to the Watch Party! Synchronized video playback is active.',
      timestamp: Date.now(),
      isSystem: true,
    },
  ]);
  const [reactions, setReactions] = useState([]);
  const [playlist, setPlaylist] = useState(MOCK_MOVIES.slice(0, 3));

  const roomStateRef = useRef(roomState);
  roomStateRef.current = roomState;

  // 1. Join Room & Consume Late-Join State
  useEffect(() => {
    if (!socket || !isConnected || !roomCode) return;

    setIsLoading(true);
    console.log(`[Room] Joining room: ${roomCode} as ${username}...`);

    socket.emit(
      SOCKET_EVENTS.JOIN_ROOM,
      { roomCode, username },
      (response) => {
        if (!response || !response.success) {
          setError(response?.message || 'Failed to connect to room');
          setIsLoading(false);
          return;
        }

        console.log('[Room] Joined successfully:', response);
        setRoomCode(response.roomCode);
        setIsHost(response.isHost);
        setRoomState(response.roomState);
        setUsers(response.users || []);
        setIsLoading(false);
      }
    );
  }, [socket, isConnected, roomCode, username]);

  // 2. Register Socket Listeners for Real-time Synchronization
  useEffect(() => {
    if (!socket) return;

    // A. Participant joined
    const handleUserJoined = (data) => {
      console.log('[Room] Participant joined:', data);
      setUsers((prev) => {
        const exists = prev.some((u) => u.socketId === data.socketId);
        if (exists) return prev;
        return [...prev, { socketId: data.socketId, username: data.username, joinedAt: data.joinedAt, isHost: false }];
      });
      setChatMessages((prev) => [
        ...prev,
        {
          id: `join-${Date.now()}-${Math.random()}`,
          sender: 'System',
          text: `${data.username} joined the party.`,
          timestamp: Date.now(),
          isSystem: true,
        },
      ]);
    };

    // B. Participant left
    const handleUserLeft = (data) => {
      console.log('[Room] Participant left:', data);
      setUsers((prev) => prev.filter((u) => u.socketId !== data.socketId));
    };

    // C. Host changed failover
    const handleHostChanged = (data) => {
      console.log('[Room] Host changed:', data);
      const amINewHost = socket.id === data.newHostSocketId;
      setIsHost(amINewHost);
      setRoomState((prev) => (prev ? { ...prev, hostSocketId: data.newHostSocketId } : prev));
      setUsers((prev) =>
        prev.map((u) => ({
          ...u,
          isHost: u.socketId === data.newHostSocketId,
        }))
      );
      setChatMessages((prev) => [
        ...prev,
        {
          id: `host-${Date.now()}`,
          sender: 'System',
          text: amINewHost ? 'You are now the room host!' : 'Host privilege was reassigned to the oldest active member.',
          timestamp: Date.now(),
          isSystem: true,
        },
      ]);
    };

    // D. Control Action Broadcast (PLAY, PAUSE, SEEK)
    // D. Control Action Broadcast (PLAY, PAUSE, SEEK)
    const handleControlActionBroadcast = (payload) => {
      console.log('[Room] Received control broadcast:', payload);
      setRoomState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          videoUrl: payload.videoUrl || prev.videoUrl,
          playbackState: payload.playbackState,
          mediaTime: payload.mediaTime,
          targetTimestamp: payload.serverTimestamp,
        };
      });
    };

    // E. Social: Chat Message Broadcast (NEW_MESSAGE)
    const handleNewMessage = (msg) => {
      console.log('[Room] Received NEW_MESSAGE:', msg);
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [
          ...prev,
          {
            id: msg.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            sender: msg.username || msg.sender || 'Anonymous',
            text: msg.message || msg.text || '',
            timestamp: msg.timestamp || Date.now(),
            isHost: msg.isHost || false,
          },
        ];
      });
    };

    // F. Social: Emoji Reaction Broadcast (REACTION_BROADCAST)
    const handleReactionBroadcast = (reaction) => {
      console.log('[Room] Received REACTION_BROADCAST:', reaction);
      const formatted = {
        id: reaction.id || `react-${Date.now()}-${Math.random()}`,
        emoji: reaction.emoji,
        sender: reaction.username || reaction.sender || 'Anonymous',
        x: reaction.x ?? Math.random() * 80 + 10,
      };
      setReactions((prev) => [...prev, formatted]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== formatted.id));
      }, 2500);
    };

    // G. Social: Playlist update
    const handlePlaylistUpdate = (newPlaylist) => {
      setPlaylist(newPlaylist);
    };

    socket.on(SOCKET_EVENTS.USER_JOINED, handleUserJoined);
    socket.on(SOCKET_EVENTS.USER_LEFT, handleUserLeft);
    socket.on(SOCKET_EVENTS.HOST_CHANGED, handleHostChanged);
    socket.on(SOCKET_EVENTS.CONTROL_ACTION_BROADCAST, handleControlActionBroadcast);
    socket.on(SOCKET_EVENTS.NEW_MESSAGE, handleNewMessage);
    socket.on(SOCKET_EVENTS.REACTION_BROADCAST, handleReactionBroadcast);
    socket.on(SOCKET_EVENTS.PLAYLIST_UPDATE, handlePlaylistUpdate);

    return () => {
      socket.off(SOCKET_EVENTS.USER_JOINED, handleUserJoined);
      socket.off(SOCKET_EVENTS.USER_LEFT, handleUserLeft);
      socket.off(SOCKET_EVENTS.HOST_CHANGED, handleHostChanged);
      socket.off(SOCKET_EVENTS.CONTROL_ACTION_BROADCAST, handleControlActionBroadcast);
      socket.off(SOCKET_EVENTS.NEW_MESSAGE, handleNewMessage);
      socket.off(SOCKET_EVENTS.REACTION_BROADCAST, handleReactionBroadcast);
      socket.off(SOCKET_EVENTS.PLAYLIST_UPDATE, handlePlaylistUpdate);
    };
  }, [socket]);

  // 3. Media Controls (Host Only)
  const sendControlAction = useCallback(
    (action, mediaTime, videoUrl = null, playbackRate = 1.0) => {
      if (!socket || !isHost) return;

      const payload = {
        roomCode,
        action,
        mediaTime,
        videoUrl: videoUrl || roomStateRef.current?.videoUrl,
        playbackRate,
      };

      console.log('[Room] Emitting control action:', payload);
      socket.emit(SOCKET_EVENTS.CONTROL_ACTION, payload);
    },
    [socket, isHost, roomCode]
  );

  // 4. Periodic 3-second Heartbeat (Host Only)
  const sendHeartbeat = useCallback(
    (mediaTime, playbackState) => {
      if (!socket || !isHost || !roomCode) return;
      socket.emit(SOCKET_EVENTS.HEARTBEAT, {
        roomCode,
        mediaTime,
        playbackState,
      });
    },
    [socket, isHost, roomCode]
  );

  // 5. Social: Chat Message Sender (SEND_MESSAGE)
  const sendChatMessage = useCallback(
    (text) => {
      if (!socket || !text.trim() || !roomCode) return;
      const cleanText = text.trim();
      const payload = {
        roomCode,
        message: cleanText,
        username,
      };
      console.log('[Room] Emitting SEND_MESSAGE:', payload);
      socket.emit(SOCKET_EVENTS.SEND_MESSAGE, payload);
    },
    [socket, roomCode, username]
  );

  // 6. Social: Floating Emoji Reaction Sender (EMIT_REACTION)
  const triggerReaction = useCallback(
    (emoji) => {
      if (!socket || !roomCode) return;
      const payload = {
        roomCode,
        emoji,
        username,
      };
      console.log('[Room] Emitting EMIT_REACTION:', payload);
      socket.emit(SOCKET_EVENTS.EMIT_REACTION, payload);
    },
    [socket, roomCode, username]
  );

  // 7. Playlist Operations
  const addToPlaylist = useCallback(
    (movie) => {
      const updated = [...playlist, movie];
      setPlaylist(updated);
      socket?.emit(SOCKET_EVENTS.PLAYLIST_UPDATE, updated);
    },
    [playlist, socket]
  );

  const removeFromPlaylist = useCallback(
    (index) => {
      const updated = playlist.filter((_, i) => i !== index);
      setPlaylist(updated);
      socket?.emit(SOCKET_EVENTS.PLAYLIST_UPDATE, updated);
    },
    [playlist, socket]
  );

  const playNow = useCallback(
    (movie) => {
      if (!isHost) return;
      // Change video source in room state
      setRoomState((prev) => ({
        ...prev,
        videoUrl: movie.videoUrl,
        mediaTime: 0,
        playbackState: PLAYBACK_STATE.PLAYING,
        targetTimestamp: Date.now(),
      }));
      sendControlAction(CONTROL_TYPE.SEEK, 0, movie.videoUrl);
      sendControlAction(CONTROL_TYPE.PLAY, 0, movie.videoUrl);
    },
    [isHost, sendControlAction]
  );

  return (
    <RoomContext.Provider
      value={{
        roomCode,
        isHost,
        roomState,
        setRoomState,
        users,
        isLoading,
        error,
        clockOffset,
        rtt,
        isSynced,
        getServerTime,
        sendControlAction,
        sendHeartbeat,
        chatMessages,
        sendChatMessage,
        reactions,
        triggerReaction,
        playlist,
        addToPlaylist,
        removeFromPlaylist,
        playNow,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom() {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
}
