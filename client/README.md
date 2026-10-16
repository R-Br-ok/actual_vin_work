# FRAME Watch Party Client (Next.js + React + Tailwind CSS)

Synchronized real-time cinema frontend crafted with **Next.js 14 (App Router)**, **React 18**, and **Tailwind CSS**. Connects to the Express & Socket.io backend at `http://localhost:5000` with atomic NTP-style clock synchronization, HTML5 dynamic drift correction, shared interactive playlist queue, real-time party chat, floating emoji canvas overlay, and Fuse.js fuzzy movie discovery.

---

## Visual Design System (FRAME)

Layout mirrors the reference UI in `server/src/reference-ui/`, re-themed for the cinema look:
- **Color Palette** (cinema dark, RGB-channel tokens in `globals.css` so Tailwind `/opacity` works):
  - `--ink`: `#0B0F19` (background)
  - `--panel`: `#111827` (surface)
  - `--accent`: `#6366F1` (indigo primary), `--accent-soft`: `#818CF8`
  - `--secondary`: `#38BDF8` (telemetry / info)
  - Glassmorphism utilities: `.glass`, `.glass-overlay`
- **Typography**:
  - Headings: `Gabriela`, Georgia, serif
  - Body & UI: `Plus Jakarta Sans`, sans-serif
- **Components**:
  - Top action bar with FRAME mark, 6-character room pill, 1-click invite link copy, and host indicator.
  - Video stage with custom scrubber, telemetry drift badge, and floating emoji reaction canvas overlay.
  - Interactive sidebar with tabs for party chat and shared watch queue.
  - Movie discovery modal with category tabs, genre tags, and typo-tolerant fuzzy search.

---

## Directory Structure

```
client/
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── next.config.mjs
├── .env.local
├── README.md
└── src/
    ├── app/
    │   ├── layout.jsx                  # Root layout with font imports & SocketProvider
    │   ├── page.jsx                    # Landing page with hero banner & room creator/joiner
    │   ├── globals.css                 # FRAME tokens, animations, and Tailwind directives
    │   └── room/
    │       └── [code]/
    │           └── page.jsx            # Main Watch Party stage (/room/ABC123)
    ├── components/
    │   ├── header/
    │   │   └── RoomHeader.jsx          # Room code, invite copy, host badge, active users
    │   ├── player/
    │   │   ├── VideoSyncPlayer.jsx     # Synchronized HTML5 video player with drift correction
    │   │   ├── PlayerControls.jsx      # Cinema controls (Play/Pause, seek scrubber, volume, fullscreen)
    │   │   └── DriftIndicator.jsx      # Real-time sync telemetry (RTT, clock offset, drift ms)
    │   ├── social/
    │   │   ├── ChatBox.jsx             # Real-time party chat with auto-scroll and host badges
    │   │   ├── ReactionCanvas.jsx      # Floating animated emoji particle overlay
    │   │   ├── ReactionBar.jsx         # Quick-tap emoji reaction bar (🔥, ❤️, 😂, 🍿, etc.)
    │   │   └── PlaylistQueue.jsx       # Shared playlist queue with play now & custom URL inputs
    │   └── discovery/
    │       ├── MovieDiscoveryModal.jsx # Full-screen movie catalog modal
    │       └── MovieCard.jsx           # Film poster card with Play Now and Add to Queue
    ├── context/
    │   ├── SocketContext.jsx           # Socket.io connection lifecycle
    │   └── RoomContext.jsx             # Room state, peer roster, media controls, and social events
    ├── hooks/
    │   ├── useSocket.js                # Socket hook
    │   ├── useClockSync.js             # NTP-style 3-way handshake & offset computation
    │   ├── useDriftCorrection.js       # 3-second periodic drift correction loop
    │   └── useMovieSearch.js           # Fuse.js fuzzy search engine
    ├── lib/
    │   ├── socket.js                   # Socket.io singleton + server URL (same host, port 5000)
    │   ├── identity.js                 # Display name persistence
    │   ├── constants.js                # Socket events, thresholds, and playback states
    │   └── utils.js                    # Time formatting, clipboard helpers, avatar colors
    └── data/
        └── mockMovies.js               # Movie catalog with streaming video URLs & metadata
```

---

## Dynamic Playback Drift Correction Engine

The client synchronizes media playback against the server authoritative clock via `useDriftCorrection`:

```
                 +--------------------------------+
                 | Every 3s Periodic Drift Check |
                 +--------------------------------+
                                 |
                                 v
        Target Time = mediaTime + (CurrentServerTime - targetTimestamp)
        Drift = Target Time - video.currentTime
                                 |
       +-------------------------+-------------------------+
       |                                                   |
       v                                                   v
|Drift| > 500ms                             100ms <= |Drift| <= 500ms
Direct Hard Seek                            Smooth Rate Nudge
video.currentTime = Target                  Lagging: playbackRate = 1.05x
playbackRate = 1.0x                         Leading: playbackRate = 0.95x
```

- **$|\text{Drift}| > 500\text{ms}$**: Executes a direct hard seek (`video.currentTime = target`) to immediately recover from buffering, tab switching, or network interruptions.
- **$100\text{ms} \le |\text{Drift}| \le 500\text{ms}$**: Nudges `playbackRate` ($1.05\times$ or $0.95\times$) to imperceptibly align audio and video without stuttering or popping.
- **$|\text{Drift}| < 100\text{ms}$**: In sync; restores standard $1.0\times$ speed.

---

## Getting Started

### 1. Prerequisites
Start the backend server on `http://localhost:5000`:
```bash
cd ../server
npm start
```

### 2. Run the Frontend Development Server
```bash
cd client
npm run dev   # next dev -H 0.0.0.0 -p 3000
```

Open [http://localhost:3000](http://localhost:3000), or `http://<your-LAN-IP>:3000` from another device.
The client connects to the sync server on the **same host it was opened from**, port 5000
(override with `NEXT_PUBLIC_SOCKET_URL=http://host:5000`).

### 3. Production Build
```bash
npm run build
npm start
```

---

## Verifying Features

1. **Create a Room**: On the home page, click **"Start Watch Party"** or select any film from the catalog. You will be redirected to `/room/[code]`.
2. **Invite Peers**: Click **"Copy Link"** in the top bar and open the URL in another browser window or incognito tab.
3. **Host Controls**: Only the host can toggle Play/Pause, Seek, or select new movies. Viewers are automatically synchronized.
4. **Drift Telemetry**: Inspect the status pills above the video player showing RTT, clock offset, drift (ms), and playback rate.
5. **Host Failover**: Close the host's tab. The backend immediately detects disconnect, queries Redis for the participant with the longest active session, and promotes the remaining peer to Host.
6. **Social & Discovery**: Click floating emoji reactions to see animated reactions drift across the video canvas; open **"Browse Movies"** to search the catalog with fuzzy matching powered by Fuse.js.
