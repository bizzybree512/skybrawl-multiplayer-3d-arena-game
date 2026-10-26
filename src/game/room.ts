// Room adapter: the single seam between the game UI and "the network".
//
// The UI only talks to `RoomClient`. Today `LocalPracticeRoom` runs the
// simulation in the browser and fills open seats with AI drivers. Milestone 2
// adds an online implementation backed by an authoritative server running the
// same `Simulation`, without changing the renderer or HUD.
import { BotBrain } from './bots'
import { Simulation, TICK } from './sim'
import type { GameEvent, GameState, PlayerInput, PlayerSeat } from './sim'

export interface RoomClient {
  readonly localId: string | null
  getState(): GameState
  setLocalInput(input: PlayerInput): void
  /** Advance by real elapsed seconds; returns events since the last call. */
  update(dtSeconds: number): GameEvent[]
  rematch(): void
  dispose(): void
}

export interface BotSeat extends PlayerSeat {
  aggression: number
}

export class LocalPracticeRoom implements RoomClient {
  private sim: Simulation
  private brains = new Map<string, BotBrain>()
  private localInput: PlayerInput | null = null
  private accumulator = 0

  constructor(
    readonly localId: string | null,
    seats: (PlayerSeat | BotSeat)[],
    seed = Math.floor(Math.random() * 1e9),
  ) {
    this.sim = new Simulation(seats, seed)
    for (const s of seats) {
      if (s.isBot) {
        this.brains.set(
          s.id,
          new BotBrain(s.id, 'aggression' in s ? s.aggression : 0.75),
        )
      }
    }
  }

  getState() {
    return this.sim.state
  }

  setLocalInput(input: PlayerInput) {
    // Keep an unconsumed dash press if a frame ran zero sim ticks.
    this.localInput = {
      ...input,
      dash: input.dash || (this.localInput?.dash ?? false),
    }
  }

  update(dtSeconds: number) {
    // Clamp so a background tab doesn't fast-forward a whole round.
    this.accumulator += Math.min(dtSeconds, 0.1)
    while (this.accumulator >= TICK) {
      this.accumulator -= TICK
      const inputs: Record<string, PlayerInput | undefined> = {}
      for (const [id, brain] of this.brains) {
        inputs[id] = brain.think(this.sim.state)
      }
      if (this.localId && this.localInput) {
        inputs[this.localId] = this.localInput
        // Dash is an edge-triggered press: consume it once per tick.
        this.localInput = { ...this.localInput, dash: false }
      }
      this.sim.step(inputs)
    }
    return this.sim.drainEvents()
  }

  rematch() {
    this.sim.rematch()
  }

  dispose() {
    this.brains.clear()
  }
}
