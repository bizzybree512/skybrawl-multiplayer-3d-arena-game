# Skybrawl multiplayer deployment

The game frontend stays on Netlify. The WebSocket room server runs as a separate Node service on Render.

## Deploy the free server

1. Sign in to [Render](https://render.com/) and connect your GitHub account if asked.
2. Choose **New + → Blueprint** and select this repository.
3. Render detects `render.yaml`. Review the service named `skybrawl-multiplayer` and create it on the **Free** plan.
4. Wait for the deploy to finish. Open the service's `/health` URL; it should return JSON containing `"ok": true`.
5. Copy the service's public URL, such as `https://your-service.onrender.com`.

Render's free service can spin down when idle. The first connection after idle may take a while. This is a free-tier limitation, not a game bug.

## Connect Netlify

1. Open the Skybrawl site in Netlify and go to **Site configuration → Environment variables** (wording may vary).
2. Add `VITE_MULTIPLAYER_URL` with the Render service URL, using `wss://` instead of `https://`. Example: `wss://your-service.onrender.com`.
3. Trigger a new deploy of the frontend so Vite embeds the variable.

Do not put private credentials in `VITE_*` variables; they are visible in the browser.

## Local development

Run the server in one terminal:

```sh
cd server
npm install
npm run dev
```

Set `VITE_MULTIPLAYER_URL=ws://localhost:10000` in the frontend environment, then start the frontend as usual.

## Current implementation notes

- Room codes are allocated by the server and refer to a shared live room.
- The host starts the match after at least two real players have joined.
- The server runs the deterministic game simulation and fills remaining seats with server-side bots.
- The lobby and match use one persistent WebSocket connection in the browser.
- Render free services may sleep; for reliable always-on play, use a paid host later.
