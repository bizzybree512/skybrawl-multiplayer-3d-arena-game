// Skybrawl match simulation.
//
// Pure, deterministic, renderer-free game logic: arcade car handling,
// collisions + knockback, power-ups, falls, rounds and best-of-three scoring.
// It runs on a fixed 60 Hz tick so the exact same code can later run on an
// authoritative multiplayer server (see PLAN.md, milestone 2).

export const TICK = 1 / 60

export const ARENA_START_RADIUS = 20
export const ARENA_MIN_RADIUS = 5
/** Seconds into a round before the arena starts shrinking. */
export const SHRINK_START = 30
/** Seconds it takes to shrink from the start radius to the minimum. */
export const SHRINK_DURATION = 40
export const CAR_RADIUS = 1.25
export const WINS_TO_MATCH = 2
export const MAX_PLAYERS = 4

const COUNTDOWN_SECONDS = 3
const ROUND_END_SECONDS = 4
const ACCEL = 26
const MAX_SPEED = 14
const BOOST_SPEED_MUL = 1.55
const BOOST_ACCEL_MUL = 1.9
const BOOST_DRAIN = 0.45
const BOOST_REGEN = 0.2
const DASH_IMPULSE = 17
const DASH_ACTIVE = 0.35
export const DASH_COOLDOWN = 3.5
const GRIP = 5
const STUN_GRIP = 0.7
const RESTITUTION = 0.9
const KNOCKBACK = 0.95
const GRAVITY = 32
const FALL_DEPTH = -30
const KO_CREDIT_WINDOW = 4

export const POWERUP_DURATION: Record<PowerUpKind, number> = {
  shield: 5,
  nitro: 5,
  heavy: 6,
}
const PICKUP_INTERVAL = 7
const MAX_PICKUPS = 2
const PICKUP_RADIUS = 0.9

export type PowerUpKind = 'shield' | 'nitro' | 'heavy'
export type Phase = 'countdown' | 'battle' | 'roundEnd' | 'matchEnd'

export interface PlayerInput {
  /** -1 (reverse) to 1 (full throttle). */
  throttle: number
  /** -1 (left) to 1 (right). */
  steer: number
  /** Held: spend boost energy for extra speed. */
  boost: boolean
  /** Pressed: lunge forward (cooldown). */
  dash: boolean
}

export const IDLE_INPUT: PlayerInput = {
  throttle: 0,
  steer: 0,
  boost: false,
  dash: false,
}

export interface PlayerSeat {
  id: string
  name: string
  color: string
  isBot: boolean
}

export interface CarState extends PlayerSeat {
  seat: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  /** Facing angle; forward vector is (sin h, cos h) on the XZ plane. */
  heading: number
  falling: boolean
  eliminated: boolean
  boosting: boolean
  boostEnergy: number
  dashCooldown: number
  dashTime: number
  shieldTime: number
  nitroTime: number
  heavyTime: number
  stunTime: number
  lastHitBy: string | null
  lastHitAt: number
  /** Battle time at which this car left the arena (for tie-breaks). */
  fellAt: number
  roundWins: number
  knockouts: number
}

export interface Pickup {
  id: number
  kind: PowerUpKind
  x: number
  z: number
}

export type GameEvent =
  | { type: 'countdown'; n: number }
  | { type: 'go' }
  | { type: 'hit'; x: number; z: number; strength: number; a: string; b: string }
  | { type: 'dash'; player: string }
  | { type: 'pickup'; player: string; kind: PowerUpKind }
  | { type: 'knockout'; victim: string; by: string | null }
  | { type: 'shrink' }
  | { type: 'roundWin'; winner: string; round: number }
  | { type: 'matchWin'; winner: string }

export interface GameState {
  phase: Phase
  /** Seconds remaining in countdown / round-end phases. */
  phaseTime: number
  battleTime: number
  round: number
  arenaRadius: number
  cars: CarState[]
  pickups: Pickup[]
  nextPickupAt: number
  roundWinner: string | null
  matchWinner: string | null
  tick: number
}

/** Small seeded PRNG so pickups spawn identically for every client/server. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v))

export const carMass = (c: CarState) => (c.heavyTime > 0 ? 2.4 : 1)
export const isOnArena = (c: CarState) => !c.falling && !c.eliminated

export class Simulation {
  state: GameState
  private events: GameEvent[] = []
  private rng: () => number
  private pickupSeq = 0
  private shrinkAnnounced = false

  constructor(seats: PlayerSeat[], seed = 1) {
    if (seats.length < 2 || seats.length > MAX_PLAYERS) {
      throw new Error(`Skybrawl needs 2–${MAX_PLAYERS} players`)
    }
    this.rng = mulberry32(seed)
    this.state = {
      phase: 'countdown',
      phaseTime: COUNTDOWN_SECONDS,
      battleTime: 0,
      round: 0,
      arenaRadius: ARENA_START_RADIUS,
      cars: seats.map((s, i) => newCar(s, i)),
      pickups: [],
      nextPickupAt: 4,
      roundWinner: null,
      matchWinner: null,
      tick: 0,
    }
    this.startRound()
  }

  drainEvents(): GameEvent[] {
    const out = this.events
    this.events = []
    return out
  }

  /** Reset scores and start a fresh best-of-three. */
  rematch() {
    for (const c of this.state.cars) {
      c.roundWins = 0
      c.knockouts = 0
    }
    this.state.round = 0
    this.state.matchWinner = null
    this.startRound()
  }

  private startRound() {
    const s = this.state
    s.round += 1
    s.phase = 'countdown'
    s.phaseTime = COUNTDOWN_SECONDS
    s.battleTime = 0
    s.arenaRadius = ARENA_START_RADIUS
    s.pickups = []
    s.nextPickupAt = 4
    s.roundWinner = null
    this.shrinkAnnounced = false
    const n = s.cars.length
    s.cars.forEach((c, i) => {
      const angle = (i / n) * Math.PI * 2 + Math.PI / 4
      const r = ARENA_START_RADIUS * 0.6
      c.x = Math.sin(angle) * r
      c.z = Math.cos(angle) * r
      c.y = 0
      c.vx = c.vy = c.vz = 0
      c.heading = Math.atan2(-c.x, -c.z) // face the centre
      c.falling = false
      c.eliminated = false
      c.boosting = false
      c.boostEnergy = 1
      c.dashCooldown = 0
      c.dashTime = 0
      c.shieldTime = 0
      c.nitroTime = 0
      c.heavyTime = 0
      c.stunTime = 0
      c.lastHitBy = null
      c.lastHitAt = -99
      c.fellAt = -1
    })
    this.events.push({ type: 'countdown', n: COUNTDOWN_SECONDS })
  }

  step(inputs: Record<string, PlayerInput | undefined>) {
    const s = this.state
    s.tick += 1

    if (s.phase === 'countdown') {
      const before = Math.ceil(s.phaseTime)
      s.phaseTime -= TICK
      const after = Math.ceil(s.phaseTime)
      if (s.phaseTime <= 0) {
        s.phase = 'battle'
        this.events.push({ type: 'go' })
      } else if (after !== before) {
        this.events.push({ type: 'countdown', n: after })
      }
      return
    }

    // Cars keep driving (and falling) during round-end and match-end screens.
    const live = s.phase === 'battle'
    if (live) {
      s.battleTime += TICK
      this.updateArena()
      this.updatePickups()
    }
    for (const c of s.cars) {
      this.updateCar(c, inputs[c.id] ?? IDLE_INPUT)
    }
    this.resolveCollisions()
    if (live) {
      this.collectPickups()
      this.checkFalls()
      this.checkRoundEnd()
    } else if (s.phase === 'roundEnd') {
      s.phaseTime -= TICK
      if (s.phaseTime <= 0) {
        if (s.matchWinner) {
          s.phase = 'matchEnd'
        } else {
          this.startRound()
        }
      }
    }
  }

  private updateArena() {
    const s = this.state
    if (s.battleTime < SHRINK_START) return
    if (!this.shrinkAnnounced) {
      this.shrinkAnnounced = true
      this.events.push({ type: 'shrink' })
    }
    const t = clamp((s.battleTime - SHRINK_START) / SHRINK_DURATION, 0, 1)
    s.arenaRadius =
      ARENA_START_RADIUS + (ARENA_MIN_RADIUS - ARENA_START_RADIUS) * t
  }

  private updatePickups() {
    const s = this.state
    s.pickups = s.pickups.filter(
      (p) => Math.hypot(p.x, p.z) < s.arenaRadius - 1,
    )
    if (s.battleTime < s.nextPickupAt) return
    s.nextPickupAt = s.battleTime + PICKUP_INTERVAL
    if (s.pickups.length >= MAX_PICKUPS) return
    const kinds: PowerUpKind[] = ['shield', 'nitro', 'heavy']
    const kind = kinds[Math.floor(this.rng() * kinds.length)]
    const angle = this.rng() * Math.PI * 2
    const r = Math.sqrt(this.rng()) * s.arenaRadius * 0.6
    s.pickups.push({
      id: ++this.pickupSeq,
      kind,
      x: Math.sin(angle) * r,
      z: Math.cos(angle) * r,
    })
  }

  private updateCar(c: CarState, inp: PlayerInput) {
    const dt = TICK
    if (c.eliminated) return

    if (c.falling) {
      c.vy -= GRAVITY * dt
      c.x += c.vx * dt
      c.y += c.vy * dt
      c.z += c.vz * dt
      c.heading += 2.5 * dt
      if (c.y < FALL_DEPTH) c.eliminated = true
      return
    }

    c.dashCooldown = Math.max(0, c.dashCooldown - dt)
    c.dashTime = Math.max(0, c.dashTime - dt)
    c.shieldTime = Math.max(0, c.shieldTime - dt)
    c.nitroTime = Math.max(0, c.nitroTime - dt)
    c.heavyTime = Math.max(0, c.heavyTime - dt)
    c.stunTime = Math.max(0, c.stunTime - dt)

    const fx = Math.sin(c.heading)
    const fz = Math.cos(c.heading)
    const rx = -Math.cos(c.heading)
    const rz = Math.sin(c.heading)
    let vf = c.vx * fx + c.vz * fz
    let lat = c.vx * rx + c.vz * rz

    const stunned = c.stunTime > 0
    const control = stunned ? 0.35 : 1
    let throttle = clamp(inp.throttle, -1, 1)

    // Boost: hold to burn energy; nitro power-up makes it free.
    const nitro = c.nitroTime > 0
    c.boosting = inp.boost && throttle >= 0 && (nitro || c.boostEnergy > 0)
    if (c.boosting) {
      throttle = 1
      if (!nitro) c.boostEnergy = Math.max(0, c.boostEnergy - BOOST_DRAIN * dt)
    } else {
      c.boostEnergy = Math.min(1, c.boostEnergy + BOOST_REGEN * dt)
    }

    const topSpeed =
      MAX_SPEED * (c.boosting ? BOOST_SPEED_MUL : 1) * (nitro ? 1.15 : 1)
    if (throttle > 0 && vf < topSpeed) {
      vf += ACCEL * throttle * (c.boosting ? BOOST_ACCEL_MUL : 1) * control * dt
    } else if (throttle < 0) {
      vf += ACCEL * 0.75 * throttle * control * dt
      vf = Math.max(vf, -MAX_SPEED * 0.55)
    }
    // Rolling drag; excess speed from hits/dashes bleeds off gradually.
    vf *= 1 - (throttle === 0 ? 0.9 : 0.25) * dt
    if (vf > topSpeed) vf -= (vf - topSpeed) * (stunned ? 0.8 : 2.5) * dt

    if (inp.dash && c.dashCooldown <= 0 && !stunned) {
      vf += DASH_IMPULSE
      c.dashTime = DASH_ACTIVE
      c.dashCooldown = DASH_COOLDOWN
      this.events.push({ type: 'dash', player: c.id })
    }

    lat *= Math.max(0, 1 - (stunned ? STUN_GRIP : GRIP) * dt)

    // Steering: turning right decreases heading. Reversing flips steering.
    const steerRate = 3.1 * clamp(Math.abs(vf) / 5, 0.4, 1) * control
    const dir = vf < -0.5 ? -1 : 1
    c.heading -= clamp(inp.steer, -1, 1) * steerRate * dir * dt

    c.vx = fx * vf + rx * lat
    c.vz = fz * vf + rz * lat
    c.x += c.vx * dt
    c.z += c.vz * dt

    // Little hop after big hits, purely for drama.
    if (c.y > 0 || c.vy > 0) {
      c.vy -= GRAVITY * dt
      c.y += c.vy * dt
      if (c.y <= 0) {
        c.y = 0
        c.vy = 0
      }
    }
  }

  private resolveCollisions() {
    const s = this.state
    const cars = s.cars.filter(isOnArena)
    const minDist = CAR_RADIUS * 2
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i]
        const b = cars[j]
        const dx = b.x - a.x
        const dz = b.z - a.z
        const d = Math.hypot(dx, dz)
        if (d >= minDist || d < 1e-4) continue
        const nx = dx / d
        const nz = dz / d
        const ma = carMass(a)
        const mb = carMass(b)

        // Push apart, heavier car moves less.
        const overlap = minDist - d
        const wa = mb / (ma + mb)
        const wb = ma / (ma + mb)
        a.x -= nx * overlap * wa
        a.z -= nz * overlap * wa
        b.x += nx * overlap * wb
        b.z += nz * overlap * wb

        const closing = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz
        if (closing <= 0) continue

        // Physical bounce...
        const jImp = ((1 + RESTITUTION) * closing) / (1 / ma + 1 / mb)
        // ...plus arcade knockback from whoever was ramming.
        const aRam = Math.max(0, a.vx * nx + a.vz * nz)
        const bRam = Math.max(0, -(b.vx * nx + b.vz * nz))
        const toB =
          jImp / mb +
          (KNOCKBACK * aRam * (a.dashTime > 0 ? 1.9 : 1) * ma) / mb
        const toA =
          jImp / ma +
          (KNOCKBACK * bRam * (b.dashTime > 0 ? 1.9 : 1) * mb) / ma
        // Shields soak most of the hit and reflect some back.
        const shieldB = b.shieldTime > 0
        const shieldA = a.shieldTime > 0
        const kB = toB * (shieldB ? 0.25 : 1) + (shieldA ? toB * 0.4 : 0)
        const kA = toA * (shieldA ? 0.25 : 1) + (shieldB ? toA * 0.4 : 0)
        b.vx += nx * kB
        b.vz += nz * kB
        a.vx -= nx * kA
        a.vz -= nz * kA

        const strength = closing
        const stun = clamp(0.2 + strength * 0.03, 0.2, 0.75)
        if (!shieldB) b.stunTime = Math.max(b.stunTime, stun)
        if (!shieldA) a.stunTime = Math.max(a.stunTime, stun * 0.6)
        if (strength > 10) {
          b.vy = Math.max(b.vy, Math.min(7, strength * 0.3))
        }
        a.lastHitBy = b.id
        b.lastHitBy = a.id
        a.lastHitAt = b.lastHitAt = s.battleTime
        this.events.push({
          type: 'hit',
          x: a.x + nx * CAR_RADIUS,
          z: a.z + nz * CAR_RADIUS,
          strength,
          a: a.id,
          b: b.id,
        })
      }
    }
  }

  private collectPickups() {
    const s = this.state
    for (const c of s.cars) {
      if (!isOnArena(c)) continue
      for (const p of s.pickups) {
        if (Math.hypot(p.x - c.x, p.z - c.z) > CAR_RADIUS + PICKUP_RADIUS)
          continue
        if (p.kind === 'shield') c.shieldTime = POWERUP_DURATION.shield
        if (p.kind === 'heavy') c.heavyTime = POWERUP_DURATION.heavy
        if (p.kind === 'nitro') {
          c.nitroTime = POWERUP_DURATION.nitro
          c.boostEnergy = 1
        }
        p.id = -1
        this.events.push({ type: 'pickup', player: c.id, kind: p.kind })
      }
      s.pickups = s.pickups.filter((p) => p.id !== -1)
    }
  }

  private checkFalls() {
    const s = this.state
    for (const c of s.cars) {
      if (!isOnArena(c)) continue
      if (Math.hypot(c.x, c.z) <= s.arenaRadius) continue
      c.falling = true
      c.fellAt = s.battleTime
      c.vy = Math.min(c.vy, 0)
      const credited =
        c.lastHitBy && s.battleTime - c.lastHitAt < KO_CREDIT_WINDOW
          ? c.lastHitBy
          : null
      if (credited) {
        const attacker = s.cars.find((o) => o.id === credited)
        if (attacker) attacker.knockouts += 1
      }
      this.events.push({ type: 'knockout', victim: c.id, by: credited })
    }
  }

  private checkRoundEnd() {
    const s = this.state
    const alive = s.cars.filter(isOnArena)
    if (alive.length > 1) return

    // Last car standing wins. If everyone dropped on the same tick, the car
    // that left the arena last wins; exact ties go to the lowest seat.
    const winner =
      alive[0] ??
      [...s.cars].sort((p, q) => q.fellAt - p.fellAt || p.seat - q.seat)[0]

    winner.roundWins += 1
    s.roundWinner = winner.id
    s.phase = 'roundEnd'
    s.phaseTime = ROUND_END_SECONDS
    this.events.push({ type: 'roundWin', winner: winner.id, round: s.round })
    if (winner.roundWins >= WINS_TO_MATCH) {
      s.matchWinner = winner.id
      this.events.push({ type: 'matchWin', winner: winner.id })
    }
  }
}

function newCar(seat: PlayerSeat, index: number): CarState {
  return {
    ...seat,
    seat: index,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    heading: 0,
    falling: false,
    eliminated: false,
    boosting: false,
    boostEnergy: 1,
    dashCooldown: 0,
    dashTime: 0,
    shieldTime: 0,
    nitroTime: 0,
    heavyTime: 0,
    stunTime: 0,
    lastHitBy: null,
    lastHitAt: -99,
    fellAt: -1,
    roundWins: 0,
    knockouts: 0,
  }
}
