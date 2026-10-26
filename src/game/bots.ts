// AI drivers for practice rooms and the landing-page attract mode.
import { CAR_RADIUS, isOnArena, IDLE_INPUT } from './sim'
import type { CarState, GameState, PlayerInput } from './sim'

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

export class BotBrain {
  private targetId: string | null = null
  private retargetAt = 0
  private phaseOffset: number

  constructor(
    private carId: string,
    private aggression = 0.75,
  ) {
    this.phaseOffset = (carId.charCodeAt(carId.length - 1) % 7) * 1.3
  }

  think(state: GameState): PlayerInput {
    const me = state.cars.find((c) => c.id === this.carId)
    if (!me || !isOnArena(me) || state.phase === 'countdown') {
      return IDLE_INPUT
    }
    const t = state.battleTime
    const R = state.arenaRadius
    const dist = Math.hypot(me.x, me.z)
    const outward =
      dist > 0.01 ? (me.vx * me.x + me.vz * me.z) / dist : 0

    // Danger: predicted position is near the edge → head home.
    const danger = dist + Math.max(0, outward) * 0.55 > R - 2.5
    let tx = 0
    let tz = 0
    let chasing: CarState | null = null

    if (!danger) {
      const opponents = state.cars.filter(
        (c) => c.id !== me.id && isOnArena(c),
      )
      if (t >= this.retargetAt || !opponents.some((o) => o.id === this.targetId)) {
        this.retargetAt = t + 1.5 + (1 - this.aggression) * 2
        // Prefer whoever is closest to the edge, weighted by distance to us.
        let best = Infinity
        for (const o of opponents) {
          const score =
            Math.hypot(o.x - me.x, o.z - me.z) -
            Math.hypot(o.x, o.z) * 0.6 * this.aggression
          if (score < best) {
            best = score
            this.targetId = o.id
          }
        }
      }
      chasing = opponents.find((o) => o.id === this.targetId) ?? null

      const pickup = state.pickups.find(
        (p) => Math.hypot(p.x - me.x, p.z - me.z) < 8,
      )
      if (pickup && me.shieldTime + me.heavyTime + me.nitroTime === 0) {
        tx = pickup.x
        tz = pickup.z
        chasing = null
      } else if (chasing) {
        // Aim slightly behind them on the centre side, so hits push outward.
        const od = Math.hypot(chasing.x, chasing.z) || 1
        tx = chasing.x + chasing.vx * 0.3 - (chasing.x / od) * CAR_RADIUS
        tz = chasing.z + chasing.vz * 0.3 - (chasing.z / od) * CAR_RADIUS
      } else {
        // Nobody to chase: idle circle near the middle.
        tx = Math.sin(t * 0.7 + this.phaseOffset) * 4
        tz = Math.cos(t * 0.7 + this.phaseOffset) * 4
      }
    }

    const desired = Math.atan2(tx - me.x, tz - me.z)
    const diff = wrapAngle(desired - me.heading)
    const wobble = Math.sin(t * 2.3 + this.phaseOffset) * 0.15
    const steer = Math.max(-1, Math.min(1, -diff * 2.2 + wobble))
    const targetDist = Math.hypot(tx - me.x, tz - me.z)
    const aligned = Math.abs(diff) < 0.3

    return {
      throttle: Math.abs(diff) > 2.2 ? 0.35 : danger ? 0.8 : 1,
      steer,
      boost:
        !danger &&
        aligned &&
        !!chasing &&
        targetDist < 14 &&
        me.boostEnergy > 0.35 * (1.2 - this.aggression),
      dash:
        !danger &&
        aligned &&
        !!chasing &&
        targetDist < 5.5 &&
        Math.sin(t * 5 + this.phaseOffset) > 1 - this.aggression,
    }
  }
}
