# Skybrawl roadmap

Skybrawl is a neon 3D bumper-car brawler: 2–4 drivers on separate devices join
a room by code and try to ram each other off a floating arena. Best of three
(first to two round wins) takes the match.

The work is split into small milestones. Each one leaves the game playable.

## ✅ Milestone 1: Playable product surface (done)

- Landing page with a live AI brawl behind the hero, rules, power-ups and controls.
- Lobby: driver name, four neon liveries, create a room (4-character code + invite
  link) or join with a code, 4-seat roster, ready / start flow.
- 3D arena (`/play`): third-person chase camera, arcade driving, collisions with
  dramatic knockback, Boost + Dash, Shield / Nitro / Heavy pickups, shrinking
  edge after 30 s, falls & eliminations, kill feed, round and match results,
  rematch. Keyboard and touch controls.
- Open seats are filled by AI drivers. All stubbed lobby data lives in
  `src/game/fixtures.ts`; the game talks to "the network" only through the
  `RoomClient` interface in `src/game/room.ts`.

## Milestone 2: Authoritative multiplayer server

Goal: two real people on two devices play the same match and see the same winner.

- Add a `server/` package running Colyseus (Node.js). It imports the existing
  `src/game/sim.ts` unchanged, so physics and rules are identical everywhere.
- One Colyseus room per 4-character code (`filterBy` code). Max 4 clients.
- Server steps the simulation at 60 Hz from client inputs and broadcasts
  snapshots at ~20 Hz. Clients send `PlayerInput` only — never positions or
  results — so nobody can declare their own hits or wins.
- Add `OnlineRoom implements RoomClient` on the client: sends inputs, buffers
  snapshots, interpolates remote cars ~100 ms behind, predicts the local car.
- Config: public server URL in a `VITE_MULTIPLAYER_URL` environment variable on
  Netlify. No secrets in the frontend.
- **Owner action:** create a Colyseus Cloud account (paid, from about $15/month)
  or pick another Node.js host, and share the server URL.

## Milestone 3: Real lobby

- Replace the fixtures roster with live room state: join/leave, names,
  livery selection (no duplicates), ready toggles, host-only Start.
- Optional AI drivers for empty seats, run server-side.
- Disconnects: a dropped player's car keeps rolling and can be knocked off;
  reconnect within 20 s resumes the seat. Host migration if the host leaves.
- Friendly errors: room full, room not found, match already in progress.

## Milestone 4: Feel & polish

- Sound effects (engine, impacts, boost, knockout, countdown) and music with a
  mute toggle.
- Handling and knockback tuning from playtests; per-device performance presets.
- Better car models and a short victory camera at match end.

## Milestone 5: More content (optional)

- Extra arenas (hexagon, moving platforms, bumpers) and cosmetic unlocks.
- Match history / leaderboards stored in Netlify Database.

## Milestone 6: Launch checklist

- Play complete matches with 2, 3 and 4 people on separate devices (desktop +
  phone), including simultaneous falls, disconnects and rematches.
- Open the public URL in a private window to confirm it loads, then submit it.
