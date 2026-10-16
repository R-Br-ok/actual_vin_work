# Media Synchronization Server (Express + Socket.io + Redis)

High-performance real-time media synchronization server engineered with Node.js, Express, Socket.io, and Redis. Features NTP-style 3-way clock synchronization, atomic Redis-backed room state, host-only media controls, periodic heartbeats, and automatic host failover based on session longevity.

---

## Features

- **6-Character Room Management**: Unique alphanumeric room code generation, direct-link resolution, and atomic state storage in Redis.
- **NTP-Style 3-Way Clock Synchronization (`SYNC_CLOCK`)**: High-precision round-trip time (RTT) and clock offset calculation so distributed clients can align playback to absolute server time.
- **Atomic Media Controls (`CONTROL_ACTION`)**: Secure PLAY, PAUSE, and SEEK handling with authoritative server timestamps broadcast to room peers.
- **Periodic Heartbeats (`HEARTBEAT`)**: 3-second heartbeat from host continually refreshing media position in Redis.
- **Longevity-Based Host Failover (`DISCONNECT`)**: Redis Sorted Sets track session join timestamps; upon host disconnect, host privilege automatically passes to the participant with the oldest active session.

---

## Directory Structure

```
server/
├── package.json
├── .env.example
├── .env
├── .gitignore
├── README.md
└── src/
    ├── server.js                      # HTTP server, Socket.io, and Redis bootstrap
    ├── app.js                         # Express configuration, CORS, routes
    ├── config/
    │   ├── env.js                     # Environment variable definitions
    │   └── redis.js                   # ioredis client configuration and connection retries
    ├── constants/
    │   ├── events.js                  # Socket.io event name constants
    │   └── playback.js                # Playback states ('PLAYING', 'PAUSED') & control types
    ├── services/
    │   ├── roomService.js             # Room code generation, Redis CRUD, user tracking, host failover
    │   └── clockService.js            # High-precision server timestamping
    ├── sockets/
    │   ├── index.js                   # Socket.io connection setup and modular handler registration
    │   └── handlers/
    │       ├── clockHandler.js        # NTP-style 3-way clock synchronization (SYNC_CLOCK)
    │       ├── roomHandler.js         # JOIN_ROOM handler
    │       ├── controlHandler.js     # CONTROL_ACTION handler
    │       ├── heartbeatHandler.js    # HEARTBEAT handler
    │       └── disconnectHandler.js   # DISCONNECT & host election handler
    └── routes/
        ├── healthRoutes.js            # GET /health
        └── roomRoutes.js              # POST /api/rooms, GET /api/rooms/:code
```

---

## Environment Variables

Configure these in `.env`:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | Port for Express & Socket.io |
| `NODE_ENV` | `development` | App environment (`development` / `production`) |
| `REDIS_HOST` | `127.0.0.1` | Redis host address |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD`| *(empty)* | Redis auth password |
| `CORS_ORIGIN` | `*` | Allowed CORS origins |
| `ROOM_CODE_LENGTH` | `6` | Length of generated room codes |
| `ROOM_EXPIRY_SECONDS` | `86400` | Redis key TTL (24 hours) |

---

## Getting Started

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Run Redis
Ensure Redis is running locally or in Docker:
```bash
redis-server
# Or using Docker:
# docker run -d -p 6379:6379 --name redis redis:alpine
```

### 3. Start the Server
```bash
# Production mode:
npm start

# Development mode (auto-reload on change):
npm run dev
```

---

## REST Endpoints

### 1. Health Check
`GET /health`
```json
{
  "status": "ok",
  "timestamp": 1729040000000,
  "redis": "connected",
  "uptime": 12.34
}
```

### 2. Create Room
`POST /api/rooms`
Body (optional):
```json
{
  "videoUrl": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
}
```
Response:
```json
{
  "success": true,
  "room": {
    "code": "AB39ZK",
    "videoUrl": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    "playbackState": "PAUSED",
    "mediaTime": 0,
    "targetTimestamp": 1729040000000,
    "hostSocketId": null,
    "createdAt": 1729040000000,
    "updatedAt": 1729040000000
  }
}
```

### 3. Inspect Room / Direct Link
`GET /api/rooms/:code`
Response:
```json
{
  "success": true,
  "room": { ... },
  "totalUsers": 2,
  "users": [ ... ]
}
```

---

## WebSocket Events Reference

### 1. `SYNC_CLOCK` (NTP 3-Way Handshake)
- **Client Emits:**
  ```json
  { "clientSendTime": 1729040000000 }
  ```
- **Server Emits (`SYNC_CLOCK_RESPONSE`):**
  ```json
  {
    "clientSendTime": 1729040000000,
    "serverReceiveTime": 1729040000010,
    "serverTransmitTime": 1729040000011
  }
  ```
- **Client Algorithm:**
  ```javascript
  const rtt = (Date.now() - clientSendTime) - (serverTransmitTime - serverReceiveTime);
  const offset = serverReceiveTime - (clientSendTime + rtt / 2);
  const accurateServerTime = Date.now() + offset;
  ```

### 2. `JOIN_ROOM`
- **Client Emits:**
  ```json
  {
    "roomCode": "AB39ZK",
    "username": "Alice"
  }
  ```
- **Server Emits to Caller (`ROOM_JOINED`):**
  ```json
  {
    "success": true,
    "roomCode": "AB39ZK",
    "isHost": true,
    "roomState": { ... },
    "users": [ ... ]
  }
  ```
- **Server Broadcasts to Peers (`USER_JOINED`):**
  ```json
  {
    "socketId": "soc_123",
    "username": "Alice",
    "joinedAt": 1729040000000,
    "totalUsers": 2
  }
  ```

### 3. `CONTROL_ACTION` (Host Only)
- **Client Emits:**
  ```json
  {
    "action": "PLAY", // "PLAY" | "PAUSE" | "SEEK"
    "mediaTime": 35.4,
    "playbackRate": 1.0
  }
  ```
- **Server Broadcasts to Room (`CONTROL_ACTION_BROADCAST`):**
  ```json
  {
    "action": "PLAY",
    "mediaTime": 35.4,
    "playbackRate": 1.0,
    "serverTimestamp": 1729040000500,
    "issuedBy": "soc_123"
  }
  ```

### 4. `HEARTBEAT` (Host Only, Every 3s)
- **Host Emits:**
  ```json
  {
    "mediaTime": 38.4,
    "playbackState": "PLAYING"
  }
  ```
- **Server Acknowledges (`HEARTBEAT_ACK`):**
  ```json
  {
    "success": true,
    "roomCode": "AB39ZK",
    "mediaTime": 38.4,
    "updatedAt": 1729040003500
  }
  ```

### 5. `DISCONNECT` & Automatic Host Reassignment
- When host disconnects, the participant with the longest continuous session (smallest `joinedAt` in the Redis sorted set) is elected.
- **Server Broadcasts to Room (`HOST_CHANGED`):**
  ```json
  {
    "previousHostSocketId": "soc_123",
    "newHostSocketId": "soc_456",
    "reassignedAt": 1729040010000
  }
  ```
- **Server Broadcasts (`USER_LEFT`):**
  ```json
  {
    "socketId": "soc_123",
    "totalUsers": 1
  }
  ```
