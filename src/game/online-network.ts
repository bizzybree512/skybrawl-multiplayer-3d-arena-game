import type { GameEvent, GameState } from './sim'

type Message = Record<string, any>
type Listener = (message: Message) => void
let socket: WebSocket | null = null
let connectedId: string | null = null
const listeners = new Set<Listener>()
const pending: Message[] = []

export function connectMultiplayer(): Promise<void> {
  if (socket?.readyState === WebSocket.OPEN) return Promise.resolve()
  if (socket?.readyState === WebSocket.CONNECTING) return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Multiplayer connection timed out.')), 10000)
    const check = (m: Message) => { if (m.type === 'connected') { clearTimeout(timer); resolve() } if (m.type === 'error') { clearTimeout(timer); reject(new Error(m.message)) } }
    listeners.add(check)
  })
  const configured = import.meta.env.VITE_MULTIPLAYER_URL as string | undefined
  const url = configured || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'ws://localhost:10000' : '')
  if (!url) return Promise.reject(new Error('Online multiplayer is not configured yet. Add VITE_MULTIPLAYER_URL in Netlify settings.'))
  socket = new WebSocket(url.replace(/^http/, 'ws'))
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Multiplayer connection timed out.')), 10000)
    socket!.addEventListener('open', () => {
      clearTimeout(timer)
      socket!.addEventListener('message', event => {
        let message: Message
        try { message = JSON.parse(String(event.data)) } catch { return }
        if (message.type === 'connected') connectedId = message.id
        for (const listener of [...listeners]) listener(message)
      })
      resolve()
      for (const message of pending.splice(0)) sendMultiplayer(message)
    }, { once: true })
    socket!.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Could not connect to the multiplayer server.')) }, { once: true })
    socket!.addEventListener('close', () => { socket = null; connectedId = null })
  })
}
export function sendMultiplayer(message: Message) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
  else pending.push(message)
}
export function subscribeMultiplayer(listener: Listener) { listeners.add(listener); return () => listeners.delete(listener) }
export function getMultiplayerId() { return connectedId }
export type ServerSnapshot = { state: GameState; events: GameEvent[] }
