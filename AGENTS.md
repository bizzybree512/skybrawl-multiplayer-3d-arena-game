# AGENTS.md

This document describes the project for developers and AI agents working on this codebase.

## Project Overview

**Skybrawl** is a neon 3D bumper-car party game. 2–4 drivers join a room by a 4-character code and try to knock each other off a floating arena. The last car on the arena wins the round, and the first to 2 round wins takes the match.

**Current state:** Milestone 1 of [PLAN.md](PLAN.md) is done. The landing page, lobby and full 3D game loop are playable, and AI drivers fill the open seats. **Continue from PLAN.md**. The next milestone is the authoritative real-time server (Colyseus) and an `OnlineRoom` client.

### Tech Stack

| Layer      | Technology                                                    |
| ---------- | ------------------------------------------------------------- |
| Framework  | TanStack Start, React 19, TanStack Router                     |
| 3D         | Three.js 0.186 (+ EffectComposer / UnrealBloomPass)           |
| Physics    | Custom deterministic arcade sim (`src/game/sim.ts`), 60 Hz    |
| Styling    | Tailwind CSS 4, neon theme variables in `src/styles.css`      |
| UI         | shadcn/ui (Radix), sonner toasts, lucide-react icons          |
| Fonts      | Orbitron (display, `font-display`), Chakra Petch (body)       |
| Deployment | Netlify via `@netlify/vite-plugin-tanstack-start`             |

## Directory Structure

```
src/
├── game/                 # Framework-free game code (no React)
│   ├── sim.ts            # Rules + physics: driving, collisions, knockback, power-ups, rounds, scoring
│   ├── bots.ts           # AI driver brains (BotBrain.think(state) -> PlayerInput)
│   ├── room.ts           # RoomClient interface + LocalPracticeRoom (sim + bots in the browser)
│   ├── renderer.ts       # ArenaRenderer: Three.js scene, cars, pickups, sparks, chase/orbit camera
│   ├── input.ts          # Keyboard + touch -> PlayerInput
│   ├── colors.ts         # Power-up colours (shared by UI and renderer without importing three)
│   └── fixtures.ts       # ALL stubbed data: liveries, bot names, fake lobby joiners, room-code helpers
├── components/game/
│   ├── game-canvas.tsx   # Mounts the renderer (dynamic import, client-only) and runs the rAF loop
│   ├── rules.tsx         # Rules, abilities, power-ups, controls copy (single source for all screens)
│   └── car-icon.tsx      # SVG bumper car tinted per livery
├── routes/
│   ├── __root.tsx        # HTML shell, site name/description, fonts, `dark` class
│   ├── index.tsx         # Landing page with a live AI attract-mode brawl
│   ├── lobby.tsx         # Name/livery, create/join room, roster, start (search: mode, code)
│   └── play.tsx          # Game screen + HUD/overlays/touch controls (search: code, name, livery, rivals)
└── styles.css            # Theme variables + .neon-panel, .neon-text, .grid-backdrop, pop-in/feed-in animations
```

## Game Architecture (read before changing gameplay)

- **`sim.ts` is the source of truth.** It is pure TypeScript with no DOM or three.js and a fixed `TICK` of 1/60 s. It uses a seeded PRNG for pickups, so the same code can run on the authoritative server in milestone 2. Keep it deterministic: don't call `Math.random()` or `Date` inside it.
- The UI only talks to **`RoomClient`** (`room.ts`). To add online play, implement `OnlineRoom` with the same interface. The renderer and HUD should not need changes.
- Heading convention: forward = `(sin h, cos h)` on XZ. Steering right *decreases* `h`. Car meshes are modelled facing +Z and use `rotation.y = heading`.
- The renderer only reads state. One-off visual effects (sparks, shake) are driven by `GameEvent`s that `update()` returns.
- Dash is edge-triggered. `InputController.read()` returns it once, and `LocalPracticeRoom` keeps it until a sim tick consumes it.
- The HUD (`play.tsx`) snapshots state about every 80 ms plus on events, instead of re-rendering React at 60 fps.
- Three.js is imported only through `renderer.ts`, which is loaded with dynamic `import()` in `GameCanvas`. Don't import `three` from route modules.
- Tie-break: if the final cars fall on the same tick, the car with the latest `fellAt` wins, then the lowest seat. The arena starts shrinking at 30 s so every round ends.

## Key Concepts

### File-Based Routing

Route files in `src/routes/` define pages and endpoints:

- `__root.tsx` wraps every page.
- `index.tsx` is `/`.
- `about.tsx` would be `/about`.
- `api.*.ts` files are server API endpoints. See the `tanstack-start-api-routes` skill.

### Theme Variables

Colors and corner radius are CSS variables in `src/styles.css` (`--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--radius`, and more), with a second set under `.dark`. Tailwind exposes them as classes such as `bg-primary`, `text-muted-foreground`, and `border-border`.

Set these variables for the product before you build any page. In components, use the variable classes instead of raw colors like `bg-white` or `text-gray-600`, so the whole site changes when a variable changes.

### UI Components

Ready-made components are in `src/components/ui/`. Use them before writing your own, and restyle them through the theme variables or their variants. Add more with `npx shadcn add <name>`. Show a toast by calling `toast()` from `sonner`; the container is already mounted in `__root.tsx`. `TooltipProvider` is mounted there too, so `Tooltip` works anywhere without its own provider.

| Need               | Components                                                         |
| ------------------ | ------------------------------------------------------------------ |
| Actions and status | Button, Badge, Progress, Skeleton, Alert, Sonner                   |
| Forms              | Input, Textarea, Label, Checkbox, RadioGroup, Switch, Select, Form |
| Overlays and menus | Dialog, Sheet, Popover, DropdownMenu, Tooltip                      |
| Content and layout | Card, Tabs, Accordion, Separator, Table                            |

Use `Form` with React Hook Form and the Zod resolver. Start from `src/examples/validated-form.tsx`; it isn't mounted or connected to a backend. Its required `onSubmit` callback must reject on failure. See [the form pattern](docs/forms.md) for HTTP submission and error handling.

Use Sheet for a mobile menu and DropdownMenu for short action lists. Give Dialog and Sheet an accessible title and description. Pair Checkbox, RadioGroup, Switch, and inputs with visible labels. Reserve tables for tabular data and wrap them in their provided scroll container.

### Design Choices

Set the product's palette, heading/body fonts, and layout before building its screens. Use an explicit user design when supplied; otherwise choose defaults that fit the product. 
- Set `--font-body` and `--font-heading` in `src/styles.css`. Use `font-display` for headings when the product needs a separate heading font.
- Use `max-w-content` for a page container and `max-w-reading` for long text. Keep consistent horizontal padding, such as `px-4 sm:px-6`, and a small repeated spacing scale, such as `gap-4`, `gap-6`, and `py-12`.
- Keep one main heading per page and a clear heading order. Use muted text for supporting copy, not essential low-contrast labels.
- Preserve focus rings. Give icon-only buttons an accessible name. Ensure actions work with a keyboard and on narrow screens.
- Use short color/opacity transitions. Add `motion-reduce:transition-none` or `motion-reduce:animate-none` when adding motion; don't make essential content depend on animation.
- Provide loading, empty, error, and success states for each data-driven screen. Skeletons should follow the shape of the content they replace.

### Routing and Server Data

Router types are registered in `src/router.tsx`, so use typed `Link` destinations and route parameters. The root route supplies the themed 404 page; the router's default error component supplies the safe retry/home page, including child-route SSR failures. Use `throw notFound()` for absent records; keep unexpected failures on the error path. See [routing conventions](src/routes/README.md).

Start with route loaders and server functions for server data. Validate server-function input with `.validator(...)`, keep secrets on the server, and handle HTTP failures before returning data. See [the data-fetching pattern](docs/data-fetching.md). Add TanStack Query only when client-side caching, mutations, or background refresh are needed.

### Browser Storage

Pages are rendered on the server first, where `window` and `localStorage` don't exist. Read `localStorage` inside `useEffect`, not during render or in a `useState` initializer, or the first render will differ from the server HTML and React will log a hydration error.

## Configuration Files

| File             | Purpose                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| `vite.config.ts` | Vite path aliases and Tailwind, Netlify, TanStack Start, React plugins                           |
| `tsconfig.json`  | Strict TypeScript, with the `@/*` alias for `src/*`                                              |
| `netlify.toml`   | Builds with `vite build`, publishes `dist/client`, dev server on port 8888 proxying Vite on 3000 |

## Development Commands

Use Node 22.13+ on the Node 22 line, Node 24, or Node 26+. The installed lint and test tools set this minimum alongside the framework.

```bash
npm run dev        # Start the Vite dev server on port 3000
npm run build      # Production build
npm run typecheck  # Type-check with tsc; the build doesn't
npm run lint       # Check TypeScript and React Hooks rules
npm run format:check # Check formatting
npm run format     # Format project files
npm test           # Run local form, control, and error page tests
npm run preview    # Preview the production build
```

## Conventions

- Components: PascalCase. Utilities and hooks: camelCase. Route files: kebab-case.
- Import from `src` with the `@/` alias.
- TypeScript fails on unused locals and parameters, so remove what you don't use.
- Use React hooks for state.
- Run the dev server or build once to generate route types before type-checking a fresh copy.
- Run build, typecheck, lint, format:check, and tests before reporting completion. Verify changed user flows locally; a passing build doesn't prove an interaction works.

## Application Name

The product name and description are `siteName` and `siteDescription` in `src/routes/__root.tsx`.
