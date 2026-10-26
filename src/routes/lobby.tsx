import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Bot,
  Check,
  Copy,
  Crown,
  KeyRound,
  Loader2,
  Play,
  Plus,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CarIcon } from '@/components/game/car-icon'
import { RulesList } from '@/components/game/rules'
import {
  LIVERIES,
  isValidRoomCode,
  liveryById,
  normalizeRoomCode,
} from '@/game/fixtures'
import type { LobbyPlayer } from '@/game/fixtures'
import { connectMultiplayer, sendMultiplayer, subscribeMultiplayer } from '@/game/online-network'
import { MAX_PLAYERS } from '@/game/sim'
import { cn } from '@/lib/utils'

type Mode = 'create' | 'join'

export const Route = createFileRoute('/lobby')({
  validateSearch: (search: Record<string, unknown>): { mode: Mode; code?: string } => ({
    mode: search.mode === 'join' ? 'join' : 'create',
    code: typeof search.code === 'string' ? normalizeRoomCode(search.code) : undefined,
  }),
  head: () => ({ meta: [{ title: 'Lobby · Skybrawl' }] }),
  component: Lobby,
})

const NAME_KEY = 'skybrawl:name'
const LIVERY_KEY = 'skybrawl:livery'

function Lobby() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>(search.mode)
  const [name, setName] = useState('')
  const [liveryId, setLiveryId] = useState(LIVERIES[0].id)
  const [joinCode, setJoinCode] = useState(search.code ?? '')
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [ready, setReady] = useState(false)
  const [serverPlayers, setServerPlayers] = useState<LobbyPlayer[]>([])
  const [serverHostId, setServerHostId] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  // Remember the driver between visits.
  useEffect(() => {
    setName(localStorage.getItem(NAME_KEY) ?? '')
    const saved = localStorage.getItem(LIVERY_KEY)
    if (saved && LIVERIES.some((l) => l.id === saved)) setLiveryId(saved)
  }, [])
  useEffect(() => {
    if (name) localStorage.setItem(NAME_KEY, name)
    localStorage.setItem(LIVERY_KEY, liveryId)
  }, [name, liveryId])

  const isHost = mode === 'create'
  const inRoom = roomCode !== null

  useEffect(() => {
    let active = true
    const unsubscribe = subscribeMultiplayer(message => {
      if (!active) return
      if (message.type === 'lobby') {
        setRoomCode(message.code)
        setServerHostId(message.hostId)
        setServerPlayers((message.players || []).map((p: {id:string;name:string;color:string;isHost:boolean;isBot:boolean;ready:boolean}) => ({
          id: p.id, name: p.name, liveryId: LIVERIES.find(l => l.color.toLowerCase() === String(p.color).toLowerCase())?.id ?? LIVERIES[0].id,
          isHost: !!p.isHost, isBot: !!p.isBot, ready: !!p.ready,
        })))
        setServerError(null)
        if (message.started && mode === 'join') {
          navigate({ to: '/play', search: { code: message.code, name: (name.trim() || 'DRIVER').toUpperCase().slice(0,12), livery: liveryId, rivals: '' } })
        }
      } else if (message.type === 'error') {
        setServerError(message.message || 'Could not connect to that room.')
        setConnecting(false)
        toast.error(message.message || 'Could not connect to that room.')
      }
    })
    if (mode === 'create') {
      connectMultiplayer().then(() => sendMultiplayer({ type: 'create', name: (name.trim() || 'DRIVER').toUpperCase().slice(0,12), color: LIVERIES.find(l=>l.id===liveryId)?.color ?? LIVERIES[0].color)).catch(e => {
        if (active) { setServerError(e instanceof Error ? e.message : 'Could not connect to multiplayer.'); toast.error(e instanceof Error ? e.message : 'Could not connect to multiplayer.') }
      })
    }
    return () => { active = false; unsubscribe() }
  }, [mode])

  const driverName = (name.trim() || 'DRIVER').toUpperCase().slice(0, 12)

  const roster: LobbyPlayer[] = serverPlayers.length ? serverPlayers : [{
    id: 'me', name: driverName, liveryId, isHost: isHost, isBot: false, ready: isHost || ready,
  }]

  const startMatch = () => {
    sendMultiplayer({ type: 'start' })
    navigate({ to: '/play', search: { code: roomCode ?? undefined, name: driverName, livery: liveryId, rivals: '' } })
  }

  const joinRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = normalizeRoomCode(joinCode)
    if (!isValidRoomCode(code)) {
      toast.error('Room codes are 4 letters or numbers, like K7QX.')
      return
    }
    setConnecting(true)
    setServerError(null)
    try {
      await connectMultiplayer()
      sendMultiplayer({ type: 'join', code, name: driverName, color: liveryById(liveryId).color })
      setConnecting(false)
    } catch (error) {
      setConnecting(false)
      const message = error instanceof Error ? error.message : 'Could not connect to multiplayer.'
      setServerError(message)
      toast.error(message)
    }
  }

  const copyInvite = async () => {
    if (!roomCode) return
    const url = `${window.location.origin}/lobby?mode=join&code=${roomCode}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Invite link copied')
    } catch {
      toast(`Room code: ${roomCode}`)
    }
  }

  const switchMode = (next: string) => {
    const m = next as Mode
    setMode(m)
    setRoomCode(null)
    setReady(false)
    navigate({ to: '/lobby', search: { mode: m }, replace: true })
  }

  const myLivery = liveryById(liveryId)
  const canStart = roster.filter(p => !p.isBot).length >= 2 && (serverHostId ? serverPlayers.some(p => p.id === serverHostId) : true)

  return (
    <div className="grid-backdrop min-h-screen">
      <header className="mx-auto flex max-w-content items-center justify-between px-5 py-5">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft /> Home
          </Link>
        </Button>
        <span className="font-display text-lg font-black tracking-widest neon-text">SKYBRAWL</span>
        <span className="w-20" />
      </header>

      <main className="mx-auto grid max-w-content gap-6 px-5 pb-16 lg:grid-cols-[1fr_1.15fr]">
        {/* Driver setup */}
        <section className="neon-panel p-6">
          <h1 className="font-display text-2xl font-black">Your driver</h1>
          <div className="mt-5 space-y-2">
            <Label htmlFor="driver-name">Driver name</Label>
            <Input
              id="driver-name"
              value={name}
              maxLength={12}
              placeholder="DRIVER"
              autoComplete="nickname"
              onChange={(e) => setName(e.target.value)}
              className="font-display h-11 uppercase tracking-wider"
            />
          </div>

          <p className="mt-6 text-sm font-medium">Livery</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {LIVERIES.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLiveryId(l.id)}
                aria-pressed={l.id === liveryId}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border bg-background/40 p-3 transition',
                  l.id === liveryId ? 'scale-[1.03] border-transparent' : 'opacity-70 hover:opacity-100',
                )}
                style={l.id === liveryId ? { boxShadow: `0 0 0 2px ${l.color}, 0 0 24px -4px ${l.glow}` } : undefined}
              >
                <CarIcon color={l.color} className="size-10" />
                <span className="font-display text-xs">{l.name}</span>
              </button>
            ))}
          </div>

          <div
            className="mt-6 flex items-center gap-4 rounded-xl border p-4"
            style={{ background: `linear-gradient(120deg, ${myLivery.glow.replace(/[\d.]+\)$/, '0.18)')}, transparent)` }}
          >
            <CarIcon color={myLivery.color} className="size-16" />
            <div>
              <p className="font-display text-xl font-black">{driverName}</p>
              <p className="text-sm text-muted-foreground">
                Driving the <span style={{ color: myLivery.color }}>{myLivery.name}</span> bumper car
              </p>
            </div>
          </div>

          <details className="mt-6 rounded-xl border bg-background/30 p-4">
            <summary className="cursor-pointer text-sm font-semibold">Rules in 30 seconds</summary>
            <div className="mt-4">
              <RulesList compact />
            </div>
          </details>
        </section>

        {/* Room */}
        <section className="neon-panel p-6">
          <Tabs value={mode} onValueChange={switchMode}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">
                <Plus /> Create room
              </TabsTrigger>
              <TabsTrigger value="join">
                <KeyRound /> Join with code
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="mt-5">
              <RoomCodeCard code={roomCode} onCopy={copyInvite} />
              <p className="mt-5 text-sm text-muted-foreground">Waiting for friends to join. AI rivals fill remaining seats once the match starts.</p>
            </TabsContent>

            <TabsContent value="join" className="mt-5">
              {inRoom ? (
                <RoomCodeCard code={roomCode} onCopy={copyInvite} />
              ) : (
                <form onSubmit={joinRoom} className="space-y-3">
                  <Label htmlFor="room-code">Room code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="room-code"
                      value={joinCode}
                      onChange={(e) => setJoinCode(normalizeRoomCode(e.target.value))}
                      placeholder="K7QX"
                      inputMode="text"
                      autoCapitalize="characters"
                      className="font-display h-12 text-center text-2xl tracking-[0.5em] uppercase"
                    />
                    <Button type="submit" size="lg" className="h-12" disabled={connecting}>
                      {connecting ? <Loader2 className="animate-spin" /> : 'Join'}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">Ask the host for the 4-character code on their screen.</p>
                </form>
              )}
            </TabsContent>
          </Tabs>

          <div className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Drivers</h2>
              <span className="text-sm text-muted-foreground">
                {roster.length}/{MAX_PLAYERS}
              </span>
            </div>
            <ul className="mt-3 space-y-2">
              {Array.from({ length: MAX_PLAYERS }).map((_, i) => {
                const p = roster[i]
                if (!p) {
                  return (
                    <li key={`empty-${i}`} className="flex h-14 items-center gap-3 rounded-xl border border-dashed px-4 text-sm text-muted-foreground">
                      <UserRound className="size-4" /> {inRoom ? 'Open seat' : 'Join a room to see drivers'}
                    </li>
                  )
                }
                const l = liveryById(p.liveryId)
                return (
                  <li
                    key={p.id}
                    className="animate-feed-in flex h-14 items-center gap-3 rounded-xl border bg-background/40 px-3"
                    style={{ borderColor: `${l.color}66` }}
                  >
                    <CarIcon color={l.color} className="size-9" />
                    <span className="font-display font-bold">{p.name}</span>
                    {(p.id === 'me' || p.name === driverName) && <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">YOU</span>}
                    {p.isHost && <Crown className="size-4 text-amber-300" aria-label="Host" />}
                    {p.isBot && <Bot className="size-4 text-muted-foreground" aria-label="AI driver" />}
                    <span className={cn('ml-auto text-xs font-semibold', p.ready ? 'text-lime-300' : 'text-muted-foreground')}>
                      {p.ready ? 'READY' : 'NOT READY'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="mt-6">
            {isHost ? (
              <Button size="lg" className="h-12 w-full text-base font-bold" disabled={!canStart} onClick={startMatch}>
                <Play /> {canStart ? 'Start match' : 'Waiting for drivers…'}
              </Button>
            ) : inRoom ? (
              <Button
                size="lg"
                variant={ready ? 'secondary' : 'default'}
                className="h-12 w-full text-base font-bold"
                onClick={() => { setReady(r => !r); sendMultiplayer({ type: 'ready', ready: !ready }) }}
              >
                <>
                  <Check /> {ready ? 'Ready — waiting for host' : "I'm ready"}
                </>
              </Button>
            ) : null}
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {serverError ?? (inRoom ? 'Connected lobby · invite friends with the room code.' : 'Create a room or join a friend to play online.')}
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

function RoomCodeCard({ code, onCopy }: { code: string | null; onCopy: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-primary/40 bg-primary/5 p-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Room code</p>
        <p className="font-display text-4xl font-black tracking-[0.3em] text-primary neon-text">{code ?? '····'}</p>
      </div>
      <Button variant="outline" onClick={onCopy} disabled={!code}>
        <Copy /> Invite
      </Button>
    </div>
  )
}
