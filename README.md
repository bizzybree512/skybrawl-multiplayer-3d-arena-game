# Skybrawl

A neon, 3D bumper-car party game for the browser. Up to four drivers join a
room by code and try to ram each other off a floating arena above the clouds.
The last car on the platform wins the round, and the first driver to win two
rounds wins the match.

## What's playable now

- **Landing page** (`/`): a live AI brawl behind the hero, plus rules, power-ups and controls.
- **Lobby** (`/lobby`): pick a driver name and livery, create a room with a
  4-character code and invite link, or join with a code.
- **Arena** (`/play`): the full game loop against AI drivers. It has a chase
  camera, arcade physics, Boost and Dash, Shield, Nitro and Heavy pickups, an
  arena edge that shrinks, round and match results, and rematch. It works with a
  keyboard or touch.

Online room support is being added in the multiplayer setup branch. The frontend needs the separately hosted WebSocket server before room codes work across devices. See [MULTIPLAYER_SETUP.md](./MULTIPLAYER_SETUP.md) for the free Render deployment steps.

## How to play

| Keyboard  | Touch      | Action                        |
| --------- | ---------- | ----------------------------- |
| W / ↑     | Stick up   | Accelerate                    |
| S / ↓     | Stick down | Brake / reverse               |
| A D / ← → | Stick side | Steer                         |
| Space     | BOOST      | Boost (hold, uses meter)      |
| E / Shift | DASH       | Dash lunge (3.5 s cooldown)   |

Knock everyone else off the edge. After 30 seconds the edge starts closing in.

## Tech

- TanStack Start + React 19, Tailwind CSS 4, shadcn/ui
- Three.js with UnrealBloom post-processing for the neon look
- A custom deterministic arcade-physics simulation (`src/game/sim.ts`), designed to run unchanged on a future authoritative game server
- Hosted on Netlify

## Run locally

```bash
pnpm install
pnpm dev        # http://localhost:3000
# or, with Netlify emulation:
netlify dev
```

## Roadmap

See [PLAN.md](./PLAN.md). Next up:

1. An authoritative real-time multiplayer server (Colyseus) so real players on separate devices share one match
2. A live lobby with a real roster, ready states, and disconnect/reconnect handling
3. Sound, tuning, and visual polish
4. More arenas, cosmetics, and leaderboards
