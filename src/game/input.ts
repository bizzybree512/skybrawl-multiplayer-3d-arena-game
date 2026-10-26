// Keyboard + touch input, merged into one PlayerInput per frame.
import type { PlayerInput } from './sim'

const THROTTLE_KEYS = new Set(['KeyW', 'ArrowUp'])
const REVERSE_KEYS = new Set(['KeyS', 'ArrowDown'])
const LEFT_KEYS = new Set(['KeyA', 'ArrowLeft'])
const RIGHT_KEYS = new Set(['KeyD', 'ArrowRight'])
const BOOST_KEYS = new Set(['Space'])
const DASH_KEYS = new Set(['KeyE', 'ShiftLeft', 'ShiftRight'])
const GAME_KEYS = new Set([
  ...THROTTLE_KEYS,
  ...REVERSE_KEYS,
  ...LEFT_KEYS,
  ...RIGHT_KEYS,
  ...BOOST_KEYS,
  ...DASH_KEYS,
])

export class InputController {
  private keys = new Set<string>()
  private stick = { x: 0, y: 0 }
  private touchBoost = false
  private dashQueued = false

  private onKeyDown = (e: KeyboardEvent) => {
    if (!GAME_KEYS.has(e.code)) return
    if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return
    e.preventDefault()
    if (DASH_KEYS.has(e.code) && !e.repeat) this.dashQueued = true
    this.keys.add(e.code)
  }
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code)
  private onBlur = () => this.keys.clear()

  attach() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
  }

  detach() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
  }

  /** Joystick vector, x right / y up, each -1..1. */
  setStick(x: number, y: number) {
    this.stick.x = x
    this.stick.y = y
  }
  setBoost(on: boolean) {
    this.touchBoost = on
  }
  queueDash() {
    this.dashQueued = true
  }

  read(): PlayerInput {
    const has = (set: Set<string>) => [...set].some((k) => this.keys.has(k))
    let throttle = (has(THROTTLE_KEYS) ? 1 : 0) - (has(REVERSE_KEYS) ? 1 : 0)
    let steer = (has(RIGHT_KEYS) ? 1 : 0) - (has(LEFT_KEYS) ? 1 : 0)
    if (Math.hypot(this.stick.x, this.stick.y) > 0.15) {
      // Pushing sideways still drives forward, like turning a wheel.
      throttle =
        this.stick.y < -0.3
          ? this.stick.y
          : Math.max(this.stick.y, Math.abs(this.stick.x) * 0.7)
      steer = this.stick.x
    }
    const dash = this.dashQueued
    this.dashQueued = false
    return {
      throttle,
      steer,
      boost: has(BOOST_KEYS) || this.touchBoost,
      dash,
    }
  }
}
