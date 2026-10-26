import { useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Gamepad2, KeyRound, Smartphone, Sparkles, Trophy, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { GameCanvas } from '@/components/game/game-canvas'
import {
  ABILITIES,
  KEYBOARD_CONTROLS,
  POWERUPS,
  RulesList,
  TOUCH_CONTROLS,
} from '@/components/game/rules'
import { BOT_DRIVERS, LIVERIES } from '@/game/fixtures'
import { LocalPracticeRoom } from '@/game/room'
import type { RoomClient } from '@/game/room'

export const Route = createFileRoute('/')({
  component: Home,
})

function useAttractRoom() {
  const [room, setRoom] = useState<RoomClient | null>(null)
  useEffect(() => {
    // Four AI drivers brawl forever behind the hero.
    const r = new LocalPracticeRoom(
      null,
      LIVERIES.map((l, i) => ({
        id: `attract-${i}`,
        name: BOT_DRIVERS[i].name,
        color: l.color,
        isBot: true,
        aggression: BOT_DRIVERS[i].aggression,
      })),
    )
    setRoom(r)
    return () => r.dispose()
  }, [])
  return room
}

function Home() {
  const room = useAttractRoom()

  // Endless demo: start a new match whenever one finishes.
  const onFrame = (state: { phase: string }) => {
    if (state.phase === 'matchEnd') room?.rematch()
  }

  return (
    <div className="min-h-screen bg-background">
      <section className="relative h-[100svh] min-h-[560px] overflow-hidden">
        <div className="absolute inset-0">
          {room && <GameCanvas room={room} mode="orbit" onFrame={onFrame} />}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/70 via-background/10 to-background" />

        <header className="relative z-10 mx-auto flex max-w-content items-center justify-between px-5 py-5">
          <span className="font-display text-lg font-black tracking-widest neon-text">
            SKYBRAWL
          </span>
          <Button asChild variant="outline" size="sm" className="bg-background/40 backdrop-blur">
            <Link to="/lobby" search={{ mode: 'join' }}>
              <KeyRound /> Join with code
            </Link>
          </Button>
        </header>

        <div className="relative z-10 mx-auto flex h-[calc(100%-80px)] max-w-content flex-col items-center justify-center px-5 pb-16 text-center">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/50 bg-background/50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-accent backdrop-blur">
            <Sparkles className="size-3.5" /> Neon bumper-car brawler
          </p>
          <h1 className="font-display text-6xl font-black tracking-tight neon-text sm:text-8xl md:text-9xl">
            SKYBRAWL
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-foreground/85 md:text-xl">
            Ram your rivals off the floating neon arena. Last car standing wins
            the round — first to two rounds takes the match.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 px-8 text-base font-bold shadow-[0_0_30px_-4px] shadow-primary">
              <Link to="/lobby" search={{ mode: 'create' }}>
                <Gamepad2 /> Create a room
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 border-accent/60 bg-background/40 px-8 text-base backdrop-blur hover:bg-accent/20">
              <Link to="/lobby" search={{ mode: 'join' }}>
                <KeyRound /> Join with code
              </Link>
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4 text-primary" /> 2–4 players
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Trophy className="size-4 text-primary" /> Best of three
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Smartphone className="size-4 text-primary" /> Keyboard & touch
            </span>
          </div>
        </div>
      </section>

      <main className="grid-backdrop">
        <section className="mx-auto max-w-content px-5 py-20">
          <h2 className="font-display text-center text-3xl font-black md:text-4xl">
            How a match works
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Gather your crew',
                text: 'Create a room, share the 4-letter code, and pick a neon livery. Up to four drivers per arena.',
              },
              {
                step: '02',
                title: 'Ram & survive',
                text: 'Build speed, boost and dash into rivals to launch them off the edge — without flying off yourself.',
              },
              {
                step: '03',
                title: 'Win two rounds',
                text: 'Last car on the platform scores the round. First to two round wins takes the match.',
              },
            ].map((s) => (
              <div key={s.step} className="neon-panel p-6">
                <span className="font-display text-sm text-accent">{s.step}</span>
                <h3 className="font-display mt-2 text-xl font-bold">{s.title}</h3>
                <p className="mt-2 text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-content px-5 pb-20">
          <div className="grid gap-5 lg:grid-cols-5">
            <div className="neon-panel p-6 lg:col-span-3">
              <h2 className="font-display text-2xl font-black">Abilities & power-ups</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Every car has Boost and Dash. Glowing orbs drop onto the arena
                every few seconds — drive through one to grab it.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[...ABILITIES, ...POWERUPS].map((p) => (
                  <div key={p.name} className="flex gap-3 rounded-xl border bg-background/40 p-4">
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: `${p.color}22`, color: p.color, boxShadow: `0 0 18px -4px ${p.color}` }}
                    >
                      <p.icon className="size-5" />
                    </span>
                    <div>
                      <p className="font-display font-bold">
                        {p.name}
                        {'key' in p && (
                          <span className="ml-2 rounded border px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground">
                            {p.key}
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="neon-panel p-6 lg:col-span-2">
              <h2 className="font-display text-2xl font-black">Controls</h2>
              <h3 className="mt-5 text-xs font-semibold uppercase tracking-widest text-primary">Keyboard</h3>
              <dl className="mt-2 space-y-2">
                {KEYBOARD_CONTROLS.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-4 text-sm">
                    <dt>
                      <kbd className="rounded-md border bg-background/60 px-2 py-1 font-mono text-xs">{k}</kbd>
                    </dt>
                    <dd className="text-muted-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
              <h3 className="mt-6 text-xs font-semibold uppercase tracking-widest text-accent">Phone & tablet</h3>
              <dl className="mt-2 space-y-2">
                {TOUCH_CONTROLS.map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-4 text-sm">
                    <dt className="font-semibold whitespace-nowrap">{k}</dt>
                    <dd className="text-right text-muted-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-reading px-5 pb-24">
          <h2 className="font-display text-center text-3xl font-black">The rules</h2>
          <div className="neon-panel mt-8 p-6">
            <RulesList />
          </div>
          <div className="mt-10 flex justify-center">
            <Button asChild size="lg" className="h-12 px-8 text-base font-bold">
              <Link to="/lobby" search={{ mode: 'create' }}>
                <Gamepad2 /> Start brawling
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <span className="font-display font-bold text-foreground">SKYBRAWL</span> ·
        a 3D multiplayer arena game
      </footer>
    </div>
  )
}
