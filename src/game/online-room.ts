import { Simulation } from './sim'
import type { GameEvent, GameState, PlayerInput, PlayerSeat } from './sim'
import type { RoomClient } from './room'
import { getMultiplayerId, sendMultiplayer, subscribeMultiplayer } from './online-network'

const LOCAL_ID = 'me'
export class OnlineRoom implements RoomClient {
  private state: GameState
  private events: GameEvent[] = []
  private unsubscribe: () => void
  private disposed = false
  readonly localId = LOCAL_ID

  constructor() {
    const seats: PlayerSeat[] = [
      { id: LOCAL_ID, name: 'YOU', color: '#22e4ff', isBot: false },
      { id: 'waiting', name: 'WAITING', color: '#ff2bd6', isBot: true },
    ]
    this.state = new Simulation(seats, 1).state
    this.unsubscribe = subscribeMultiplayer(message => {
      if (this.disposed) return
      if (message.type !== 'state' || !message.state) return
      const ownId = getMultiplayerId()
      const raw = message.state as GameState
      this.state = {
        ...raw,
        cars: raw.cars.map(car => ({ ...car, id: car.id === ownId ? LOCAL_ID : car.id })),
        roundWinner: raw.roundWinner === ownId ? LOCAL_ID : raw.roundWinner,
        matchWinner: raw.matchWinner === ownId ? LOCAL_ID : raw.matchWinner,
      }
      this.events.push(...(message.events as GameEvent[] || []).map(event => mapEvent(event, ownId)))
    })
  }
  getState() { return this.state }
  setLocalInput(input: PlayerInput) {
    sendMultiplayer({ type: 'input', input: { ...input } })
  }
  update(_dtSeconds: number) {
    const out = this.events
    this.events = []
    return out
  }
  rematch() { sendMultiplayer({ type: 'rematch' }) }
  dispose() { this.disposed = true; this.unsubscribe() }
}
function mapEvent(event: GameEvent, ownId: string | null): GameEvent {
  if (!ownId) return event
  const id = (value: string) => value === ownId ? LOCAL_ID : value
  switch(event.type) {
    case 'dash': return { ...event, player: id(event.player) }
    case 'pickup': return { ...event, player: id(event.player) }
    case 'knockout': return { ...event, victim: id(event.victim), by: event.by ? id(event.by) : null }
    case 'roundWin': return { ...event, winner: id(event.winner) }
    case 'matchWin': return { ...event, winner: id(event.winner) }
    case 'hit': return { ...event, a: id(event.a), b: id(event.b) }
    default: return event
  }
}
