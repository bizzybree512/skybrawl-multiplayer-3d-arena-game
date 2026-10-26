import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { CircleHelp, Gauge, Home, RotateCcw, Shield, Users, Weight, Wind, X, Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { GameCanvas } from '@/components/game/game-canvas'
import { KEYBOARD_CONTROLS, RulesList, TOUCH_CONTROLS } from '@/components/game/rules'
import { POWERUP_COLORS } from '@/game/colors'
import { BOT_DRIVERS, LIVERIES, liveryById, normalizeRoomCode } from '@/game/fixtures'
import { InputController } from '@/game/input'
import { LocalPracticeRoom } from '@/game/room'
import type { RoomClient } from '@/game/room'
import {
  DASH_COOLDOWN,
  POWERUP_DURATION,
  SHRINK_START,
  WINS_TO_MATCH,
  isOnArena,
} from '@/game/sim'
import type { GameEvent, GameState, Phase, PowerUpKind } from '@/game/sim'
import { cn } from '@/lib/utils'

interface PlaySearch {
  code?: string
  name: string
  livery: string
  rivals: string
}

export const Route = createFileRoute('/play')({
  validateSearch: (s: Record<string, unknown>): PlaySearch => ({
    code: typeof s.code === 'string' ? normalizeRoomCode(s.code) : undefined,
    name:
      typeof s.name === 'string' && s.name.trim()
        ? s.name.trim().toUpperCase().slice(0, 12)
        : 'DRIVER',
    livery: typeof s.livery === 'string' ? liveryById(s.livery).id : LIVERIES[0].id,
    rivals: typeof s.rivals === 'string' ? s.rivals : '',
  }),
  head: () => ({ meta: [{ title: 'Arena · Skybrawl' }] }),
  component: Play,
})

const LOCAL_ID = 'me'

interface HudCar {
  id: string
  name: string
  color: string
  roundWins: number
  knockouts: number
  out: boolean
}

interface Hud {
  phase: Phase
  phaseTime: number
  round: number
  battleTime: number
  cars: HudCar[]
  me: {
    boost: number
    dashCd: number
    shield: number
    nitro: number
    heavy: number
    out: boolean
  } | null
  roundWinner: string | null
  matchWinner: string | null
}

interface Banner {
  key: number
  text: string
  sub?: string
  color?: string
  big?: boolean
}

interface FeedItem {
  key: number
  node: React.ReactNode
}

function snapshot(s: GameState): Hud {
  const me = s.cars.find((c) => c.id === LOCAL_ID)
  return {
    phase: s.phase,
    phaseTime: s.phaseTime,
    round: s.round,
    battleTime: s.battleTime,
    cars: s.cars.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      roundWins: c.roundWins,
      knockouts: c.knockouts,
      out: !isOnArena(c),
    })),
    me: me
      ? {
          boost: me.boostEnergy,
          dashCd: me.dashCooldown,
          shield: me.shieldTime,
          nitro: me.nitroTime,
          heavy: me.heavyTime,
          out: !isOnArena(me),
        }
      : null,
    roundWinner: s.roundWinner,
    matchWinner: s.matchWinner,
  }
}

function buildRoom(search: PlaySearch): RoomClient {
  const others = LIVERIES.filter((l) => l.id !== search.livery)
  const rivalNames = search.rivals
    .split(',')
    .map((n) => n.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 3)
  if (rivalNames.length === 0) rivalNames.push(BOT_DRIVERS[0].name)
  return new LocalPracticeRoom(LOCAL_ID, [
    { id: LOCAL_ID, name: search.name, color: liveryById(search.livery).color, isBot: false },
    ...rivalNames.map((name, i) => ({
      id: `bot-${i}`,
      name,
      color: others[i].color,
      isBot: true,
      aggression: BOT_DRIVERS.find((b) => b.name === name)?.aggression ?? 0.7,
    })),
  ])
}

function Play() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const [room, setRoom] = useState<RoomClient | null>(null)
  const [input] = useState(() => new InputController())
  const [hud, setHud] = useState<Hud | null>(null)
  const [banner, setBanner] = useState<Banner | null>(null)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [touch, setTouch] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const lastHud = useRef(0)
  const seq = useRef(0)

  useEffect(() => {
    const r = buildRoom(search)
    setRoom(r)
    return () => r.dispose()
  }, [search])

  useEffect(() => {
    input.attach()
    setTouch(window.matchMedia('(pointer: coarse)').matches)
    return () => input.detach()
  }, [input])

  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(null), banner.big ? 900 : 1600)
    return () => clearTimeout(t)
  }, [banner])

  useEffect(() => {
    if (feed.length === 0) return
    const t = setTimeout(() => setFeed((f) => f.slice(1)), 4000)
    return () => clearTimeout(t)
  }, [feed])

  const handleEvents = useCallback((state: GameState, events: GameEvent[]) => {
    const name = (id: string | null) => {
      const c = state.cars.find((x) => x.id === id)
      return c ? (c.id === LOCAL_ID ? 'YOU' : c.name) : '???'
    }
    const color = (id: string | null) => state.cars.find((x) => x.id === id)?.color
    const show = (b: Omit<Banner, 'key'>) => setBanner({ ...b, key: ++seq.current })
    const push = (node: React.ReactNode) =>
      setFeed((f) => [...f.slice(-3), { key: ++seq.current, node }])

    for (const e of events) {
      if (e.type === 'countdown') show({ text: String(e.n), big: true })
      else if (e.type === 'go') show({ text: 'BRAWL!', big: true, color: '#ff2bd6' })
      else if (e.type === 'shrink') show({ text: 'EDGE CLOSING IN', sub: 'The arena is shrinking', color: '#ff2b6a' })
      else if (e.type === 'knockout') {
        if (e.victim === LOCAL_ID) {
          show({ text: 'KNOCKED OUT', sub: e.by ? `${name(e.by)} sent you flying` : 'You drove off the edge', color: '#ff2b6a' })
        } else if (e.by === LOCAL_ID) {
          show({ text: 'KNOCKOUT!', sub: `You launched ${name(e.victim)}`, color: '#b4ff2e' })
        }
        push(
          e.by ? (
            <>
              <b style={{ color: color(e.by) }}>{name(e.by)}</b> rammed{' '}
              <b style={{ color: color(e.victim) }}>{name(e.victim)}</b> off
            </>
          ) : (
            <>
              <b style={{ color: color(e.victim) }}>{name(e.victim)}</b> fell off
            </>
          ),
        )
      } else if (e.type === 'pickup') {
        push(
          <>
            <b style={{ color: color(e.player) }}>{name(e.player)}</b> grabbed{' '}
            <b style={{ color: POWERUP_COLORS[e.kind] }}>{e.kind.toUpperCase()}</b>
          </>,
        )
      }
    }
  }, [])

  const onFrame = useCallback(
    (state: GameState, events: GameEvent[]) => {
      if (events.length) handleEvents(state, events)
      const now = performance.now()
      if (events.length || now - lastHud.current > 80) {
        lastHud.current = now
        setHud(snapshot(state))
      }
    },
    [handleEvents],
  )

  const rematch = () => {
    room?.rematch()
    setFeed([])
  }

  const winnerName = (id: string | null) => {
    const c = hud?.cars.find((x) => x.id === id)
    return c ? (c.id === LOCAL_ID ? 'YOU' : c.name) : ''
  }
  const winnerColor = (id: string | null) => hud?.cars.find((x) => x.id === id)?.color
  const showMatchEnd = !!hud?.matchWinner && (hud.phase === 'matchEnd' || hud.phase === 'roundEnd')
  const showRoundEnd = hud?.phase === 'roundEnd' && !hud.matchWinner
  const shrinking = hud?.phase === 'battle' && hud.battleTime >= SHRINK_START

  return (
    <div className="fixed inset-0 touch-none overflow-hidden bg-background select-none">
      {room && <GameCanvas room={room} mode="follow" input={input} onFrame={onFrame} />}

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex items-center gap-2">
          <Button asChild variant="outline" size="icon" className="bg-background/50 backdrop-blur" aria-label="Leave match">
            <Link to="/lobby" search={{ mode: 'create' }}>
              <X />
            </Link>
          </Button>
          <div className="rounded-lg border bg-background/50 px-3 py-1.5 backdrop-blur">
            <p className="font-display text-xs leading-tight text-muted-foreground">
              {search.code ? `ROOM ${search.code}` : 'PRACTICE'}
            </p>
            <p className="font-display text-sm leading-tight font-bold">
              ROUND {hud?.round ?? 1}
              <span className="ml-2 font-sans font-medium text-muted-foreground tabular-nums">
                {formatTime(hud?.battleTime ?? 0)}
              </span>
            </p>
          </div>
          {shrinking && (
            <span className="animate-pulse rounded-lg border border-red-400/60 bg-red-500/20 px-2 py-1 text-xs font-bold text-red-200">
              EDGE CLOSING
            </span>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-1.5">
          {hud?.cars.map((c) => (
            <div
              key={c.id}
              className={cn(
                'flex items-center gap-2 rounded-lg border bg-background/55 px-2.5 py-1 backdrop-blur transition-opacity',
                c.out && hud.phase === 'battle' && 'opacity-40',
              )}
              style={{ borderColor: `${c.color}88` }}
            >
              <span className="size-2.5 rounded-full" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }} />
              <span className="font-display max-w-20 truncate text-xs font-bold">
                {c.id === LOCAL_ID ? 'YOU' : c.name}
              </span>
              <span className="flex gap-0.5" aria-label={`${c.roundWins} round wins`}>
                {Array.from({ length: WINS_TO_MATCH }).map((_, i) => (
                  <span
                    key={i}
                    className="size-2 rounded-full border"
                    style={i < c.roundWins ? { background: c.color, borderColor: c.color } : undefined}
                  />
                ))}
              </span>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          size="icon"
          className="pointer-events-auto bg-background/50 backdrop-blur"
          onClick={() => setHelpOpen(true)}
          aria-label="How to play"
        >
          <CircleHelp />
        </Button>
      </div>

      {/* Kill feed */}
      <div className="pointer-events-none absolute top-20 right-3 flex flex-col items-end gap-1.5">
        {feed.map((f) => (
          <div key={f.key} className="animate-feed-in rounded-md border bg-background/60 px-2.5 py-1 text-xs backdrop-blur">
            {f.node}
          </div>
        ))}
      </div>

      {/* Centre banner */}
      {banner && !showMatchEnd && (
        <div className="pointer-events-none absolute inset-x-0 top-[28%] flex flex-col items-center text-center">
          <p
            key={banner.key}
            className={cn('animate-pop-in font-display font-black neon-text', banner.big ? 'text-8xl md:text-9xl' : 'text-4xl md:text-6xl')}
            style={banner.color ? { color: banner.color } : undefined}
          >
            {banner.text}
          </p>
          {banner.sub && <p className="mt-2 text-lg font-semibold text-foreground/90">{banner.sub}</p>}
        </div>
      )}

      {/* Spectating notice */}
      {hud?.me?.out && hud.phase === 'battle' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-28 flex justify-center md:bottom-10">
          <p className="rounded-full border bg-background/60 px-4 py-2 text-sm backdrop-blur">
            You’re out this round — spectating until one car is left
          </p>
        </div>
      )}

      {/* First countdown hint */}
      {hud?.phase === 'countdown' && hud.round === 1 && !touch && (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center">
          <div className="flex flex-wrap justify-center gap-3 rounded-xl border bg-background/60 px-4 py-2 text-xs backdrop-blur">
            {KEYBOARD_CONTROLS.map(([k, v]) => (
              <span key={k}>
                <kbd className="rounded border px-1.5 py-0.5 font-mono">{k}</kbd> {v}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Meters (desktop) */}
      {hud?.me && !touch && (
        <div className="pointer-events-none absolute bottom-6 left-6 w-60 space-y-2">
          <PowerUpChips me={hud.me} />
          <Meter icon={<Gauge className="size-4" />} label="BOOST · Space" value={hud.me.boost} color="#22e4ff" />
          <Meter
            icon={<Wind className="size-4" />}
            label={hud.me.dashCd > 0 ? `DASH · ${hud.me.dashCd.toFixed(1)}s` : 'DASH READY · E'}
            value={1 - hud.me.dashCd / DASH_COOLDOWN}
            color="#ff2bd6"
          />
        </div>
      )}

      {touch && hud?.me && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center">
            <PowerUpChips me={hud.me} />
          </div>
          <TouchControls input={input} boost={hud.me.boost} dashCd={hud.me.dashCd} />
        </>
      )}

      {/* Round result */}
      {showRoundEnd && hud && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
          <div className="animate-pop-in neon-panel w-full max-w-sm p-6 text-center">
            <p className="font-display text-sm text-muted-foreground">ROUND {hud.round} RESULT</p>
            <p className="font-display mt-2 text-3xl font-black" style={{ color: winnerColor(hud.roundWinner) }}>
              {hud.roundWinner === LOCAL_ID ? 'YOU WIN THE ROUND!' : `${winnerName(hud.roundWinner)} WINS`}
            </p>
            <Standings cars={hud.cars} />
            <p className="mt-4 text-xs text-muted-foreground">Next round starting…</p>
          </div>
        </div>
      )}

      {/* Match result */}
      {showMatchEnd && hud && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 p-4 backdrop-blur-sm">
          <div className="animate-pop-in neon-panel w-full max-w-md p-7 text-center">
            <p className="font-display text-sm tracking-widest text-accent">MATCH OVER</p>
            <p
              className="font-display mt-2 text-4xl font-black neon-text md:text-5xl"
              style={{ color: winnerColor(hud.matchWinner) }}
            >
              {hud.matchWinner === LOCAL_ID ? 'YOU ARE CHAMPION' : `${winnerName(hud.matchWinner)} WINS`}
            </p>
            <Standings cars={hud.cars} showKos />
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <Button size="lg" className="h-12 font-bold" onClick={rematch}>
                <RotateCcw /> Rematch
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12"
                onClick={() => navigate({ to: '/lobby', search: { mode: 'create' } })}
              >
                <Users /> Back to lobby
              </Button>
            </div>
            <Button asChild variant="link" className="mt-2">
              <Link to="/">
                <Home /> Home
              </Link>
            </Button>
          </div>
        </div>
      )}

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">How to play Skybrawl</DialogTitle>
            <DialogDescription>Knock everyone off the arena. First to {WINS_TO_MATCH} round wins takes the match.</DialogDescription>
          </DialogHeader>
          <RulesList compact />
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="mb-1 font-semibold text-primary">Keyboard</p>
              {KEYBOARD_CONTROLS.map(([k, v]) => (
                <p key={k} className="text-muted-foreground">
                  <span className="text-foreground">{k}</span> — {v}
                </p>
              ))}
            </div>
            <div>
              <p className="mb-1 font-semibold text-accent">Touch</p>
              {TOUCH_CONTROLS.map(([k, v]) => (
                <p key={k} className="text-muted-foreground">
                  <span className="text-foreground">{k}</span> — {v}
                </p>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function formatTime(t: number) {
  const s = Math.floor(t)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function Standings({ cars, showKos = false }: { cars: HudCar[]; showKos?: boolean }) {
  const sorted = [...cars].sort((a, b) => b.roundWins - a.roundWins || b.knockouts - a.knockouts)
  return (
    <ul className="mt-5 space-y-1.5 text-left">
      {sorted.map((c) => (
        <li key={c.id} className="flex items-center gap-3 rounded-lg border bg-background/40 px-3 py-2">
          <span className="size-3 rounded-full" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }} />
          <span className="font-display flex-1 truncate text-sm font-bold">{c.id === LOCAL_ID ? 'YOU' : c.name}</span>
          {showKos && <span className="text-xs text-muted-foreground">{c.knockouts} KO</span>}
          <span className="flex gap-1">
            {Array.from({ length: WINS_TO_MATCH }).map((_, i) => (
              <span
                key={i}
                className="size-2.5 rounded-full border"
                style={i < c.roundWins ? { background: c.color, borderColor: c.color } : undefined}
              />
            ))}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Meter({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="rounded-lg border bg-background/55 p-2 backdrop-blur">
      <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider" style={{ color }}>
        {icon} {label}
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${v * 100}%`, background: color, boxShadow: `0 0 10px ${color}` }} />
      </div>
    </div>
  )
}

const POWERUP_ICONS: Record<PowerUpKind, typeof Shield> = { shield: Shield, nitro: Zap, heavy: Weight }

function PowerUpChips({ me }: { me: NonNullable<Hud['me']> }) {
  const active = (
    [
      ['shield', me.shield],
      ['nitro', me.nitro],
      ['heavy', me.heavy],
    ] as [PowerUpKind, number][]
  ).filter(([, t]) => t > 0)
  if (active.length === 0) return null
  return (
    <div className="flex gap-1.5">
      {active.map(([kind, t]) => {
        const Icon = POWERUP_ICONS[kind]
        const color = POWERUP_COLORS[kind]
        return (
          <span
            key={kind}
            className="relative flex items-center gap-1 overflow-hidden rounded-md border px-2 py-1 text-[11px] font-bold"
            style={{ borderColor: color, color }}
          >
            <span
              className="absolute inset-y-0 left-0 opacity-25"
              style={{ width: `${(t / POWERUP_DURATION[kind]) * 100}%`, background: color }}
            />
            <Icon className="relative size-3.5" />
            <span className="relative">{kind.toUpperCase()}</span>
          </span>
        )
      })}
    </div>
  )
}

function TouchControls({ input, boost, dashCd }: { input: InputController; boost: number; dashCd: number }) {
  const baseRef = useRef<HTMLDivElement>(null)
  const pointer = useRef<number | null>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const [boosting, setBoosting] = useState(false)

  const move = (e: React.PointerEvent) => {
    const r = baseRef.current?.getBoundingClientRect()
    if (!r) return
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2)
    let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2)
    const m = Math.hypot(dx, dy)
    if (m > 1) {
      dx /= m
      dy /= m
    }
    setKnob({ x: dx, y: dy })
    input.setStick(dx, -dy)
  }
  const release = () => {
    pointer.current = null
    setKnob({ x: 0, y: 0 })
    input.setStick(0, 0)
  }
  const setBoost = (on: boolean) => {
    setBoosting(on)
    input.setBoost(on)
  }

  return (
    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div
        ref={baseRef}
        className="relative size-36 rounded-full border-2 border-primary/50 bg-background/30 backdrop-blur"
        onPointerDown={(e) => {
          pointer.current = e.pointerId
          e.currentTarget.setPointerCapture(e.pointerId)
          move(e)
        }}
        onPointerMove={(e) => pointer.current === e.pointerId && move(e)}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <div
          className="absolute top-1/2 left-1/2 size-16 rounded-full bg-primary/70 shadow-[0_0_24px] shadow-primary"
          style={{ transform: `translate(calc(-50% + ${knob.x * 40}px), calc(-50% + ${knob.y * 40}px))` }}
        />
      </div>
      <div className="flex items-end gap-3">
        <button
          type="button"
          className="font-display relative size-20 overflow-hidden rounded-full border-2 border-accent bg-background/40 text-xs font-black text-accent backdrop-blur active:scale-95"
          onPointerDown={() => dashCd <= 0 && input.queueDash()}
        >
          <span
            className="absolute inset-x-0 bottom-0 bg-accent/30"
            style={{ height: `${(1 - dashCd / DASH_COOLDOWN) * 100}%` }}
          />
          <span className="relative">{dashCd > 0 ? dashCd.toFixed(1) : 'DASH'}</span>
        </button>
        <button
          type="button"
          className={cn(
            'font-display relative size-24 overflow-hidden rounded-full border-2 border-primary bg-background/40 text-sm font-black text-primary backdrop-blur',
            boosting && 'scale-95 shadow-[0_0_30px] shadow-primary',
          )}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            setBoost(true)
          }}
          onPointerUp={() => setBoost(false)}
          onPointerCancel={() => setBoost(false)}
        >
          <span className="absolute inset-x-0 bottom-0 bg-primary/30" style={{ height: `${boost * 100}%` }} />
          <span className="relative">BOOST</span>
        </button>
      </div>
    </div>
  )
}
