// Stubbed data for the Skybrawl preview.
//
// Everything that will later come from the online room service lives here:
// liveries, AI driver names and the "other players" shown in the lobby.
// Swap these out when real rooms land (PLAN.md, milestone 2).

export interface Livery {
  id: string
  name: string
  color: string
  /** Tailwind-friendly glow for UI chips. */
  glow: string
}

export const LIVERIES: Livery[] = [
  { id: 'cyan', name: 'Pulse', color: '#22e4ff', glow: 'rgba(34,228,255,0.55)' },
  {
    id: 'magenta',
    name: 'Hex',
    color: '#ff2bd6',
    glow: 'rgba(255,43,214,0.55)',
  },
  { id: 'lime', name: 'Volt', color: '#b4ff2e', glow: 'rgba(180,255,46,0.5)' },
  {
    id: 'amber',
    name: 'Nova',
    color: '#ffb02e',
    glow: 'rgba(255,176,46,0.55)',
  },
]

export const liveryById = (id: string) =>
  LIVERIES.find((l) => l.id === id) ?? LIVERIES[0]

/** AI drivers that fill open seats in practice rooms. */
export const BOT_DRIVERS = [
  { name: 'GLITCH', aggression: 0.9 },
  { name: 'NEONIX', aggression: 0.7 },
  { name: 'BYTEBOY', aggression: 0.55 },
  { name: 'ZAPPA', aggression: 0.8 },
]

export interface LobbyPlayer {
  id: string
  name: string
  liveryId: string
  isHost: boolean
  isBot: boolean
  ready: boolean
}

/** Pretend remote players that "join" a freshly created lobby. */
export const STUB_LOBBY_JOINERS: Omit<LobbyPlayer, 'liveryId'>[] = [
  { id: 'bot-1', name: 'GLITCH', isHost: false, isBot: true, ready: true },
  { id: 'bot-2', name: 'NEONIX', isHost: false, isBot: true, ready: true },
  { id: 'bot-3', name: 'BYTEBOY', isHost: false, isBot: true, ready: true },
]

/** The host you "join" when entering someone else's room code. */
export const STUB_REMOTE_HOST: Omit<LobbyPlayer, 'liveryId'> = {
  id: 'bot-host',
  name: 'ZAPPA',
  isHost: true,
  isBot: true,
  ready: true,
}

// No I/O/0/1 so codes are easy to read aloud.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateRoomCode(length = 4) {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return code
}

export const normalizeRoomCode = (raw: string) =>
  raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)

export const isValidRoomCode = (code: string) =>
  code.length === 4 && [...code].every((ch) => CODE_ALPHABET.includes(ch))
