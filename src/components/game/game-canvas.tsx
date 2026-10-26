import { useEffect, useRef, useState } from 'react'

import type { CameraMode } from '@/game/renderer'
import type { InputController } from '@/game/input'
import type { RoomClient } from '@/game/room'
import type { GameEvent, GameState } from '@/game/sim'
import { cn } from '@/lib/utils'

interface GameCanvasProps {
  room: RoomClient
  mode: CameraMode
  input?: InputController
  onFrame?: (state: GameState, events: GameEvent[]) => void
  className?: string
}

/**
 * Hosts the WebGL renderer and drives the room + render loop.
 * The renderer (and Three.js) is loaded client-side only.
 */
export function GameCanvas({
  room,
  mode,
  input,
  onFrame,
  className,
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onFrameRef = useRef(onFrame)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    onFrameRef.current = onFrame
  }, [onFrame])

  useEffect(() => {
    let disposed = false
    let raf = 0
    let renderer: import('@/game/renderer').ArenaRenderer | null = null

    import('@/game/renderer').then(({ ArenaRenderer }) => {
      if (disposed || !containerRef.current) return
      try {
        renderer = new ArenaRenderer(containerRef.current, {
          localId: room.localId,
          mode,
        })
      } catch {
        setFailed(true)
        return
      }
      let last = performance.now()
      const loop = (now: number) => {
        const dt = Math.min(0.1, (now - last) / 1000)
        last = now
        if (input) room.setLocalInput(input.read())
        const events = room.update(dt)
        const state = room.getState()
        renderer?.frame(state, events, dt)
        onFrameRef.current?.(state, events)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    })

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      renderer?.dispose()
    }
  }, [room, mode, input])

  return (
    <div ref={containerRef} className={cn('relative h-full w-full', className)}>
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-muted-foreground">
          Your browser couldn’t start 3D graphics. Try a recent Chrome, Edge,
          Safari or Firefox with hardware acceleration turned on.
        </div>
      )}
    </div>
  )
}
