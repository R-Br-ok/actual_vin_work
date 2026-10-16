# FRAME Watch Party

Watch videos together, in sync, from different laptops. One person hosts and controls playback; everyone
else in the room sees the same frame at the same moment and can chat, react and queue up what plays next.

Built with **Next.js 14 + Tailwind CSS** (client) and **Node.js + Express + Socket.io** (server), with
Redis or an automatic in-memory fallback for room state. Every catalog title is a local MP4 in
`client/public/`, so it all works offline on a local network.

---

## Key Features

| Feature | What it does |
|---|---|
| **NTP clock sync** | Each browser pings the server (`SYNC_CLOCK`) to measure round-trip time and its clock offset θ = ((t₁ − t₀) + (t₂ − t₃)) / 2, smoothed with a continuous exponential moving average. Every client then agrees on "server time" to within a few milliseconds. |
| **Dual-tier drift correction** | Every 3 s each viewer compares its video position with where the room says it should be. A drift of 0.1–0.5 s is fixed smoothly by playing at 1.05× or 0.95×. More than 0.5 s triggers an instant seek. A live telemetry pill on the player shows RTT, drift and playback rate. |
| **Real-time chat & emoji reactions** | Live chat with history for late joiners. Emoji reactions float up over the video on every screen, the sender's and the host's included. |
| **Interactive queue** | A shared "Up next" list that anyone can add to (from the catalog or a video link). The host can play, reorder or remove items, and the next item starts automatically when a video ends. |
| **Rotating front page** | The home page cycles through the catalog every 6 s with crossfading backdrops. "Create Party" and "Join Room" sit on top of it. |
| Also included | Host-controlled playback speed (0.5×–2×) for the whole room, unique names per tab, automatic host hand-over when the host leaves, fuzzy movie search, and a "Room Not Found" page for bad links. |

---

## Quick Start Guide (Single Laptop / Localhost)

**You need:** [Node.js 18.17 or newer](https://nodejs.org) (check with `node -v`). Redis is optional;
without it the server keeps rooms in memory.

**1. Get the code**

```bash
git clone https://github.com/R-Br-ok/actual_vin_work.git
cd actual_vin_work
git checkout i_am_still_trying
```

**2. Start the sync server** (Terminal 1)

```bash
cd server
npm install
npm run dev
```

Wait until you see `Sync Server listening on http://0.0.0.0:5000`.

**3. Start the web app** (Terminal 2)

```bash
cd client
npm install
npm run dev
```

Wait until you see `Ready`.

**4. Try it**

1. Open **http://localhost:3000** and click **Create Party**. You are now the host.
2. Click **Copy link** in the top bar and paste it into a second browser window (or an incognito window).
   That window joins as a viewer with its own name.
3. In the host window press **Play**: both windows play in sync. Try seeking, pausing, the speed button
   (**1×**), emoji reactions, chat and **Browse Movies**.

> **Tip:** To see drift correction at work, open DevTools in the viewer window and run
> `document.querySelector('video').currentTime += 2`. Within about 3 seconds the telemetry pill shows a
> correction and the viewer snaps back in line.

---

## Step-by-Step Multi-Laptop LAN Setup Guide (Cross-Device Wi-Fi / Hotspot Testing)

Only **one** laptop runs the code. Every other laptop or phone just needs a web browser.

```
 ┌──────────── Laptop A (the "server laptop") ────────────┐
 │  sync server  → port 5000      web app → port 3000     │
 └─────────────────────────┬──────────────────────────────┘
                           │  same Wi-Fi network or phone hotspot
            ┌──────────────┼───────────────┐
        Laptop B        Laptop C         Phone
     (browser only)  (browser only)  (browser only)
```

### Step 1 — Put every device on the same network

Connect all laptops and phones to the **same Wi-Fi network** or the **same phone hotspot**.

> Many office, campus, hotel and café networks block devices from talking to each other ("client
> isolation"). If Step 5 fails on such a network, switch everyone to a **phone hotspot**. It almost
> always works.

### Step 2 — Start both servers on Laptop A

Follow steps 1–3 of the Quick Start on Laptop A. Nothing else is needed: both servers already listen
on all network interfaces (`0.0.0.0`).

### Step 3 — Find Laptop A's local IP address

The easiest way: look at the **sync server's terminal**. It prints a line like:

```
  Network:   http://192.168.1.20:5000
```

`192.168.1.20` is the IP address. If it isn't shown, find it manually:

| OS | Command | Look for |
|---|---|---|
| Windows | `ipconfig` | **IPv4 Address** under your *Wireless LAN adapter Wi-Fi* |
| macOS | `ipconfig getifaddr en0` | the single address it prints |
| Linux | `hostname -I` | the first address |

It usually starts with `192.168.`, `10.` or `172.`. Use this IP everywhere below in place of
**`<IP>`**.

### Step 4 — Allow ports 3000 and 5000 through Laptop A's firewall

- **Windows:** the first time Node.js runs, Windows asks *"Allow Node.js to communicate on these networks?"*.
  Tick **Private networks** and click **Allow**. Also make sure your Wi-Fi is set to **Private**
  (Settings → Network & Internet → Wi-Fi → your network → *Network profile type: Private*).
  If you missed the prompt, run this in **PowerShell as Administrator**:
  ```powershell
  New-NetFirewallRule -DisplayName "FRAME Watch Party" -Direction Inbound -Protocol TCP -LocalPort 3000,5000 -Action Allow -Profile Private
  ```
- **macOS:** if a prompt asks whether **node** may accept incoming connections, click **Allow**.
  If the firewall is on, check System Settings → Network → Firewall → Options and make sure node is allowed.
- **Linux (ufw):**
  ```bash
  sudo ufw allow 3000,5000/tcp
  ```

### Step 5 — Check the connection from Laptop B

On Laptop B, open **`http://<IP>:5000/health`** in a browser.

- ✅ You see text starting with `{"status":"ok"` → the network and firewall are fine. Continue.
- ❌ The page doesn't load → go back to Steps 1 and 4 (same network? firewall open? client isolation?).

### Step 6 — The host creates the room using the network address

On **Laptop A**, open **`http://<IP>:3000`**. Don't use `localhost`: the invite link is copied from
the address bar's host, and other devices can't open a `localhost` link. Then:

1. Click **Create Party**.
2. Click **Copy link** in the top bar. You get something like `http://192.168.1.20:3000/room/ABC123`.
3. Send that link to the others (chat, email, or just read out the 6-letter room code).

### Step 7 — Everyone else joins

On Laptop B, Laptop C or a phone, either:

- open the copied link directly, **or**
- open `http://<IP>:3000`, type the **room code** into **Join Room** and click **Join Room**.

Each device gets its own name automatically (e.g. `Cyber_Viewer_89`), or you can type one on the home page first.

### Step 8 — Watch together

- The host presses **Play**. Everyone's video starts at the same position.
- If a viewer sees **"Join the watch party"**, click it once. Browsers require one click before a page may play sound.
- Watch the telemetry pill on each screen: it should read **Aligned** with a drift of only a few milliseconds.

### Troubleshooting

| Problem | Fix |
|---|---|
| `http://<IP>:5000/health` doesn't load on Laptop B | Wrong IP, different network, firewall still blocking, or the network uses client isolation. Try a phone hotspot. |
| Home page loads, but the room says **"Can't reach the sync server"** | Port 5000 is blocked while 3000 is open. Allow **both** ports (Step 4). |
| Copied link contains `localhost` | The host opened `localhost:3000`. Reopen the app at `http://<IP>:3000` and create the room again. |
| **Copy link** does nothing | Some browsers limit clipboard access on plain `http`. Copy the URL from the address bar instead. |
| **"Room Not Found"** after restarting the server | Without Redis, rooms live in memory and are cleared on restart. Create a new room. |
| Laptop A's IP changed (new network, rejoined Wi-Fi) | Repeat Step 3 and share the new link. |

---

## Automated Performance Benchmark Suite (`npm run benchmark`)

The benchmark connects simulated participants to the sync server and measures sync quality under
load. Each virtual client gets a random clock skew of up to ±250 ms that the clock sync has to correct.
The host fires PLAY / PAUSE / SEEK actions throughout the run. The benchmark measures:

- round-trip time (RTT)
- control latency (host action → viewer receives it)
- playback drift
- clock-offset error

For each it reports **min / avg / p50 / p90 / p95 / p99 / max**.

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
cd server
npm run benchmark                                     # 10 and 50 participants
node scripts/loadTest.js --clients 10,25,50,100       # custom room sizes
node scripts/loadTest.js --latency 40 --jitter 10     # simulate an internet connection (+40 ± 10 ms each way)
node scripts/loadTest.js --url http://<IP>:5000       # run from another laptop against Laptop A
node scripts/loadTest.js --json results.json          # save the raw numbers
```

Example summary (simulated internet connection):

```
■ Summary vs targets
┌────────────────────────────┬──────────┬───────────┬───────────┬────────┐
│ Metric                     │   Target │  10 users │  50 users │ Status │
├────────────────────────────┼──────────┼───────────┼───────────┼────────┤
│ p50 control latency        │ < 100 ms │  86.98 ms │  84.51 ms │ PASSED │
│ p95 control latency        │ < 250 ms │ 108.88 ms │ 106.75 ms │ PASSED │
│ Max playback drift         │ < 500 ms │   5.87 ms │   7.01 ms │ PASSED │
│ Clock sync precision (p95) │  ± 10 ms │   5.24 ms │   6.07 ms │ PASSED │
│ Broadcast delivery         │    100 % │    100.0% │    100.0% │ PASSED │
└────────────────────────────┴──────────┴───────────┴───────────┴────────┘
```

The command exits with an error code if any target is missed. Full results and methodology are in
[`PERFORMANCE_REPORT.md`](./PERFORMANCE_REPORT.md). Functional tests: `cd server && npm test`.

---

## Project Structure

```
.
├── README.md
├── PERFORMANCE_REPORT.md            benchmark results & sync design
├── client/                          Next.js 14 web app (port 3000)
│   ├── public/
│   │   ├── sample.mp4 … sample4.mp4 catalog videos (sample.mp4 = default for new rooms)
│   │   └── posters/                 poster frames for each video
│   └── src/
│       ├── app/                     home page (rotating hero) and /room/[code]
│       ├── components/
│       │   ├── player/              VideoSyncPlayer, PlayerControls, SpeedMenu, DriftIndicator, ReactionCanvas
│       │   ├── social/              ChatBox, PlaylistQueue, ReactionBar
│       │   ├── discovery/           MovieDiscoveryModal, MovieCard
│       │   ├── header/              RoomHeader (room code, copy link, participants)
│       │   └── room/ ui/            Room Not Found card, shared UI
│       ├── context/                 SocketContext, RoomContext (room state & actions)
│       ├── hooks/                   useClockSync, useDriftCorrection, useMovieSearch
│       ├── data/mockMovies.js       the movie catalog
│       └── lib/                     socket connection, names, constants, helpers
└── server/                          Express + Socket.io sync server (port 5000)
    ├── scripts/                     loadTest.js (benchmark), latencyProxy.js (network simulation)
    ├── src/
    │   ├── server.js                starts the server on 0.0.0.0:5000
    │   ├── routes/                  REST: create/check rooms, health check
    │   ├── services/roomService.js  room state, queue, playback timeline, host hand-over
    │   └── sockets/handlers/        clock, room, control, speed, video, queue, chat, reactions, disconnect
    └── test/                        npm test suites
```

Socket event details are documented in [`server/README.md`](./server/README.md).
