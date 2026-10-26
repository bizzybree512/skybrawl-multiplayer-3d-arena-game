import { Gauge, Shield, Weight, Wind, Zap } from 'lucide-react'

import { POWERUP_COLORS } from '@/game/colors'

export const RULES = [
  'Each round, every car spawns on the floating arena facing the centre. Engines unlock after a 3-second countdown.',
  'Ram opponents to knock them off the edge. Hitting someone head-on while moving fast sends them flying — dashing into them hits almost twice as hard.',
  'If your car leaves the arena, you fall and are out for the rest of that round. You can keep watching the battle.',
  'The last car still on the arena wins the round and scores one point. If the final cars fall together, whoever stayed on longest wins.',
  'After 30 seconds the arena edge glows red and starts shrinking, so every round ends.',
  'The first driver to win 2 rounds wins the match. Then hit Rematch to go again.',
]

export const ABILITIES = [
  {
    icon: Gauge,
    name: 'Boost',
    key: 'Space',
    color: '#22e4ff',
    text: 'Hold for top speed. Drains your boost meter, which refills when you let go.',
  },
  {
    icon: Wind,
    name: 'Dash',
    key: 'E / Shift',
    color: '#ff2bd6',
    text: 'Instant forward lunge with a 3.5 s cooldown. Hits during a dash deal massive knockback.',
  },
]

export const POWERUPS = [
  {
    icon: Shield,
    name: 'Shield',
    color: POWERUP_COLORS.shield,
    text: 'For 5 s you shrug off 75% of incoming knockback and bounce some back at the attacker.',
  },
  {
    icon: Zap,
    name: 'Nitro',
    color: POWERUP_COLORS.nitro,
    text: 'Refills your boost and makes it free and faster for 5 s.',
  },
  {
    icon: Weight,
    name: 'Heavy',
    color: POWERUP_COLORS.heavy,
    text: 'Your car is 2.4× heavier for 6 s: you hit harder and barely budge.',
  },
]

export const KEYBOARD_CONTROLS = [
  ['W / ↑', 'Accelerate'],
  ['S / ↓', 'Brake & reverse'],
  ['A D / ← →', 'Steer'],
  ['Space', 'Boost (hold)'],
  ['E / Shift', 'Dash'],
]

export const TOUCH_CONTROLS = [
  ['Left stick', 'Push up to drive, sideways to steer, down to reverse'],
  ['BOOST', 'Hold for speed'],
  ['DASH', 'Tap to lunge'],
]

export function RulesList({ compact = false }: { compact?: boolean }) {
  return (
    <ol className={compact ? 'space-y-2 text-sm' : 'space-y-3'}>
      {RULES.map((rule, i) => (
        <li key={rule} className="flex gap-3">
          <span className="font-display mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/60 text-xs text-primary">
            {i + 1}
          </span>
          <span className="text-muted-foreground">{rule}</span>
        </li>
      ))}
    </ol>
  )
}
