// Three.js scene for Skybrawl. Reads simulation state, never mutates it.
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

import { POWERUP_COLORS } from './colors'
import { ARENA_START_RADIUS, SHRINK_START } from './sim'
import type { CarState, GameEvent, GameState, PowerUpKind } from './sim'

export type CameraMode = 'follow' | 'orbit'

interface CarVisual {
  root: THREE.Group
  body: THREE.Group
  bumperMat: THREE.MeshStandardMaterial
  shield: THREE.Mesh
  heavyRing: THREE.Mesh
  flames: THREE.Group
  glow: THREE.Mesh
  tag: THREE.Sprite
}

interface PickupVisual {
  root: THREE.Group
  gem: THREE.Mesh
}

const SPARK_COUNT = 500

function radialTexture(inner: string, outer: string, size = 128) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  )
  grad.addColorStop(0, inner)
  grad.addColorStop(1, outer)
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function floorTexture() {
  const size = 1024
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const mid = size / 2
  const bg = g.createRadialGradient(mid, mid, 0, mid, mid, mid)
  bg.addColorStop(0, '#2a0f5c')
  bg.addColorStop(0.7, '#12062e')
  bg.addColorStop(1, '#07021a')
  g.fillStyle = bg
  g.fillRect(0, 0, size, size)

  // Grid
  g.strokeStyle = 'rgba(34,228,255,0.22)'
  g.lineWidth = 2
  for (let i = 0; i <= size; i += 48) {
    g.beginPath()
    g.moveTo(i, 0)
    g.lineTo(i, size)
    g.stroke()
    g.beginPath()
    g.moveTo(0, i)
    g.lineTo(size, i)
    g.stroke()
  }
  // Concentric rings
  for (let r = 1; r <= 4; r++) {
    g.strokeStyle =
      r === 4 ? 'rgba(255,43,214,0.9)' : `rgba(255,43,214,${0.18 + r * 0.06})`
    g.lineWidth = r === 4 ? 10 : 4
    g.beginPath()
    g.arc(mid, mid, (mid - 14) * (r / 4), 0, Math.PI * 2)
    g.stroke()
  }
  // Centre hexagon
  g.strokeStyle = 'rgba(34,228,255,0.85)'
  g.lineWidth = 6
  g.beginPath()
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6
    const x = mid + Math.cos(a) * 90
    const y = mid + Math.sin(a) * 90
    if (i === 0) g.moveTo(x, y)
    else g.lineTo(x, y)
  }
  g.stroke()
  g.fillStyle = 'rgba(255,255,255,0.55)'
  g.font = 'bold 34px Orbitron, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('SKYBRAWL', mid, mid)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function nameTag(text: string, color: string) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = 'rgba(8,3,24,0.72)'
  g.beginPath()
  g.roundRect(4, 8, 248, 48, 14)
  g.fill()
  g.strokeStyle = color
  g.lineWidth = 3
  g.stroke()
  g.fillStyle = '#ffffff'
  g.font = 'bold 28px Orbitron, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text.slice(0, 12), 128, 33)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }),
  )
  sprite.scale.set(2.8, 0.7, 1)
  sprite.position.y = 3.3
  return sprite
}

function buildCar(car: CarState, isLocal: boolean, glowTex: THREE.Texture) {
  const color = new THREE.Color(car.color)
  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)

  const dark = new THREE.MeshStandardMaterial({
    color: '#14102a',
    metalness: 0.8,
    roughness: 0.35,
  })
  const paint = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.45,
    roughness: 0.3,
    emissive: color,
    emissiveIntensity: 0.18,
  })
  const bumperMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 2.2,
    roughness: 0.4,
  })

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.28, 0.45, 32), dark)
  base.position.y = 0.38
  body.add(base)

  const bumper = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.2, 12, 48), bumperMat)
  bumper.rotation.x = Math.PI / 2
  bumper.position.y = 0.38
  body.add(bumper)

  const shell = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 1.8), paint)
  shell.position.set(0, 0.85, -0.05)
  body.add(shell)

  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.32, 0.7), paint)
  hood.position.set(0, 0.72, 0.8)
  hood.rotation.x = 0.18
  body.add(hood)

  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.75, 0.25), dark)
  seat.position.set(0, 1.35, -0.72)
  body.add(seat)

  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 20, 16),
    new THREE.MeshStandardMaterial({ color: '#f4f1ff', metalness: 0.3, roughness: 0.25 }),
  )
  helmet.position.set(0, 1.5, -0.28)
  body.add(helmet)
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.14, 0.12),
    new THREE.MeshStandardMaterial({ color: '#000', emissive: '#22e4ff', emissiveIntensity: 2 }),
  )
  visor.position.set(0, 1.52, 0.02)
  body.add(visor)

  // Classic bumper-car pole with a glowing tip.
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 8), dark)
  pole.position.set(0, 2.0, -0.85)
  body.add(pole)
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), bumperMat)
  tip.position.set(0, 2.78, -0.85)
  body.add(tip)

  const lightMat = new THREE.MeshStandardMaterial({
    color: '#fff',
    emissive: '#fffbe6',
    emissiveIntensity: 3,
  })
  for (const side of [-0.42, 0.42]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.08), lightMat)
    hl.position.set(side, 0.78, 1.16)
    body.add(hl)
  }

  const flames = new THREE.Group()
  const flameMat = new THREE.MeshBasicMaterial({
    color: '#ff8a2a',
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  for (const side of [-0.45, 0.45]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.1, 10), flameMat)
    f.rotation.x = -Math.PI / 2
    f.position.set(side, 0.55, -1.75)
    flames.add(f)
  }
  flames.visible = false
  body.add(flames)

  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(2.0, 24, 18),
    new THREE.MeshBasicMaterial({
      color: POWERUP_COLORS.shield,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  shield.position.y = 1
  shield.visible = false
  root.add(shield)

  const heavyRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.55, 0.12, 8, 6),
    new THREE.MeshStandardMaterial({
      color: POWERUP_COLORS.heavy,
      emissive: POWERUP_COLORS.heavy,
      emissiveIntensity: 2.5,
    }),
  )
  heavyRing.rotation.x = Math.PI / 2
  heavyRing.position.y = 0.4
  heavyRing.visible = false
  body.add(heavyRing)

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 5),
    new THREE.MeshBasicMaterial({
      map: glowTex,
      color,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  glow.rotation.x = -Math.PI / 2
  glow.position.y = 0.04
  root.add(glow)

  const tag = nameTag(isLocal ? 'YOU' : car.name, car.color)
  root.add(tag)

  return { root, body, bumperMat, shield, heavyRing, flames, glow, tag }
}

function buildPickup(kind: PowerUpKind, glowTex: THREE.Texture): PickupVisual {
  const color = new THREE.Color(POWERUP_COLORS[kind])
  const root = new THREE.Group()
  const gem = new THREE.Mesh(
    kind === 'shield'
      ? new THREE.IcosahedronGeometry(0.6, 0)
      : kind === 'nitro'
        ? new THREE.OctahedronGeometry(0.65, 0)
        : new THREE.BoxGeometry(0.8, 0.8, 0.8),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 2.4,
      metalness: 0.2,
      roughness: 0.2,
    }),
  )
  gem.position.y = 1.2
  root.add(gem)
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.5, 8, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  )
  beam.position.y = 4
  root.add(beam)
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 3),
    new THREE.MeshBasicMaterial({
      map: glowTex,
      color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  halo.rotation.x = -Math.PI / 2
  halo.position.y = 0.05
  root.add(halo)
  return { root, gem }
}

export class ArenaRenderer {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private composer: EffectComposer
  private resizeObserver: ResizeObserver
  private arena = new THREE.Group()
  private edgeMat: THREE.MeshStandardMaterial
  private warnMat: THREE.MeshBasicMaterial
  private glowTex: THREE.Texture
  private cars = new Map<string, CarVisual>()
  private pickups = new Map<number, PickupVisual>()
  private rocks: THREE.Mesh[] = []
  private sparks: THREE.Points
  private sparkVel = new Float32Array(SPARK_COUNT * 3)
  private sparkLife = new Float32Array(SPARK_COUNT)
  private sparkCursor = 0
  private shake = 0
  private time = 0
  private camHeading = 0
  private lookTarget = new THREE.Vector3()

  constructor(
    private container: HTMLElement,
    private opts: { localId: string | null; mode: CameraMode; lowPower?: boolean },
  ) {
    const lowPower =
      opts.lowPower ?? window.matchMedia('(pointer: coarse)').matches
    this.renderer = new THREE.WebGLRenderer({ antialias: !lowPower, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.25 : 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.touchAction = 'none'
    container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 600)
    this.camera.position.set(0, 26, 38)

    this.scene.background = new THREE.Color('#060214')
    this.scene.fog = new THREE.FogExp2('#0d0428', 0.0085)
    this.glowTex = radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)')

    this.buildEnvironment()
    this.sparks = this.buildSparks()

    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.composer.addPass(
      new UnrealBloomPass(new THREE.Vector2(256, 256), lowPower ? 0.7 : 0.95, 0.55, 0.62),
    )
    this.composer.addPass(new OutputPass())

    this.edgeMat = this.arena.userData.edgeMat
    this.warnMat = this.arena.userData.warnMat

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()
  }

  private buildEnvironment() {
    const s = this.scene
    s.add(new THREE.HemisphereLight('#8a6cff', '#12002a', 0.9))
    const sun = new THREE.DirectionalLight('#ffffff', 1.4)
    sun.position.set(12, 30, 8)
    s.add(sun)
    const rim = new THREE.DirectionalLight('#ff2bd6', 0.8)
    rim.position.set(-20, 6, -18)
    s.add(rim)

    // Sky gradient dome
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(400, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {},
        vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `varying vec3 vP; void main(){ float h = vP.y; vec3 top = vec3(0.02,0.0,0.08); vec3 mid = vec3(0.16,0.03,0.32); vec3 low = vec3(0.45,0.05,0.42); vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0,0.6,h)) : mix(mid, low, smoothstep(0.0,-0.5,h)); gl_FragColor = vec4(c,1.0); }`,
      }),
    )
    s.add(sky)

    // Stars
    const starGeo = new THREE.BufferGeometry()
    const starPos = new Float32Array(1500 * 3)
    for (let i = 0; i < 1500; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(250 + Math.random() * 100)
      v.y = Math.abs(v.y) * 0.9 - 20
      starPos.set([v.x, v.y, v.z], i * 3)
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    s.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({ color: '#cfc4ff', size: 1.1, fog: false, sizeAttenuation: true }),
      ),
    )

    // Glowing cloud sea far below
    const cloud = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshBasicMaterial({
        map: radialTexture('rgba(255,60,200,0.55)', 'rgba(40,0,80,0)', 256),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    )
    cloud.rotation.x = -Math.PI / 2
    cloud.position.y = -60
    s.add(cloud)

    // Arena platform (scaled as it shrinks)
    const R = ARENA_START_RADIUS
    const floorTex = floorTexture()
    const topMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      emissiveMap: floorTex,
      emissive: '#ffffff',
      emissiveIntensity: 0.85,
      metalness: 0.55,
      roughness: 0.45,
    })
    const sideMat = new THREE.MeshStandardMaterial({
      color: '#1a0b3a',
      emissive: '#5b1bff',
      emissiveIntensity: 0.6,
      metalness: 0.8,
      roughness: 0.3,
    })
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 1.2, 96), [sideMat, topMat, sideMat])
    disc.position.y = -0.6
    this.arena.add(disc)

    const edgeMat = new THREE.MeshStandardMaterial({
      color: '#22e4ff',
      emissive: '#22e4ff',
      emissiveIntensity: 2.6,
    })
    const edge = new THREE.Mesh(new THREE.TorusGeometry(R, 0.16, 10, 160), edgeMat)
    edge.rotation.x = Math.PI / 2
    edge.position.y = 0.02
    this.arena.add(edge)

    const warnMat = new THREE.MeshBasicMaterial({
      color: '#ff2bd6',
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const warn = new THREE.Mesh(new THREE.RingGeometry(R * 0.86, R, 128), warnMat)
    warn.rotation.x = -Math.PI / 2
    warn.position.y = 0.03
    this.arena.add(warn)

    const under = new THREE.Mesh(
      new THREE.ConeGeometry(R * 0.98, 16, 48, 1, true),
      new THREE.MeshStandardMaterial({
        color: '#0e0624',
        emissive: '#3a0f8a',
        emissiveIntensity: 0.35,
        metalness: 0.9,
        roughness: 0.4,
        side: THREE.DoubleSide,
      }),
    )
    under.rotation.x = Math.PI
    under.position.y = -9.2
    this.arena.add(under)
    const underLines = new THREE.Mesh(
      new THREE.ConeGeometry(R * 0.985, 16, 24, 4, true),
      new THREE.MeshBasicMaterial({ color: '#7a3cff', wireframe: true, transparent: true, opacity: 0.35 }),
    )
    underLines.rotation.x = Math.PI
    underLines.position.y = -9.2
    this.arena.add(underLines)

    this.arena.userData = { edgeMat, warnMat }
    s.add(this.arena)

    // Floating debris rocks for depth
    const rockMat = new THREE.MeshStandardMaterial({
      color: '#1b0d3d',
      emissive: '#ff2bd6',
      emissiveIntensity: 0.25,
      flatShading: true,
      metalness: 0.6,
      roughness: 0.5,
    })
    for (let i = 0; i < 14; i++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1 + Math.random() * 2.5, 0), rockMat)
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3
      const d = R + 12 + Math.random() * 30
      rock.position.set(Math.sin(a) * d, -6 - Math.random() * 18, Math.cos(a) * d)
      rock.userData.baseY = rock.position.y
      rock.userData.phase = Math.random() * 10
      this.rocks.push(rock)
      s.add(rock)
    }
  }

  private buildSparks() {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARK_COUNT * 3).fill(-999), 3))
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(SPARK_COUNT * 3), 3))
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.35,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        map: this.glowTex,
      }),
    )
    pts.frustumCulled = false
    this.scene.add(pts)
    return pts
  }

  private emitSparks(x: number, y: number, z: number, count: number, colors: string[], speed = 10) {
    const pos = this.sparks.geometry.getAttribute('position') as THREE.BufferAttribute
    const col = this.sparks.geometry.getAttribute('color') as THREE.BufferAttribute
    const tmp = new THREE.Color()
    for (let i = 0; i < count; i++) {
      const k = this.sparkCursor
      this.sparkCursor = (this.sparkCursor + 1) % SPARK_COUNT
      const dir = new THREE.Vector3().randomDirection()
      dir.y = Math.abs(dir.y) * 0.8 + 0.2
      const sp = speed * (0.4 + Math.random() * 0.8)
      pos.setXYZ(k, x, y, z)
      this.sparkVel.set([dir.x * sp, dir.y * sp, dir.z * sp], k * 3)
      this.sparkLife[k] = 0.5 + Math.random() * 0.5
      tmp.set(colors[i % colors.length])
      col.setXYZ(k, tmp.r * 2, tmp.g * 2, tmp.b * 2)
    }
    pos.needsUpdate = true
    col.needsUpdate = true
  }

  private updateSparks(dt: number) {
    const pos = this.sparks.geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    for (let k = 0; k < SPARK_COUNT; k++) {
      if (this.sparkLife[k] <= 0) continue
      this.sparkLife[k] -= dt
      this.sparkVel[k * 3 + 1] -= 22 * dt
      arr[k * 3] += this.sparkVel[k * 3] * dt
      arr[k * 3 + 1] += this.sparkVel[k * 3 + 1] * dt
      arr[k * 3 + 2] += this.sparkVel[k * 3 + 2] * dt
      if (this.sparkLife[k] <= 0) arr[k * 3 + 1] = -999
    }
    pos.needsUpdate = true
  }

  private resize() {
    const w = this.container.clientWidth || 1
    const h = this.container.clientHeight || 1
    this.renderer.setSize(w, h, false)
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.composer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.fov = w < h ? 75 : 62
    this.camera.updateProjectionMatrix()
  }

  private handleEvents(state: GameState, events: GameEvent[]) {
    const carById = (id: string) => state.cars.find((c) => c.id === id)
    for (const e of events) {
      if (e.type === 'hit') {
        const a = carById(e.a)
        const b = carById(e.b)
        const n = Math.min(60, Math.round(e.strength * 3))
        this.emitSparks(e.x, 0.9, e.z, n, [a?.color ?? '#fff', b?.color ?? '#fff', '#ffffff'], 4 + e.strength * 0.6)
        const involvesMe = e.a === this.opts.localId || e.b === this.opts.localId
        this.shake = Math.max(this.shake, Math.min(1, e.strength / 20) * (involvesMe ? 1 : 0.4))
      } else if (e.type === 'knockout') {
        const v = carById(e.victim)
        if (v) this.emitSparks(v.x, 0, v.z, 80, [v.color, '#ffffff'], 14)
        this.shake = Math.max(this.shake, e.victim === this.opts.localId ? 1 : 0.5)
      } else if (e.type === 'pickup') {
        const c = carById(e.player)
        if (c) this.emitSparks(c.x, 1.2, c.z, 40, [POWERUP_COLORS[e.kind], '#ffffff'], 7)
      } else if (e.type === 'dash') {
        const c = carById(e.player)
        if (c) this.emitSparks(c.x, 0.4, c.z, 18, [c.color], 5)
      }
    }
  }

  private syncCars(state: GameState, dt: number) {
    for (const car of state.cars) {
      let v = this.cars.get(car.id)
      if (!v) {
        v = buildCar(car, car.id === this.opts.localId, this.glowTex)
        this.cars.set(car.id, v)
        this.scene.add(v.root)
      }
      v.root.visible = !car.eliminated
      v.root.position.set(car.x, car.y, car.z)
      v.root.rotation.y = car.heading
      // Wobble when stunned, lean into turns via velocity.
      v.body.rotation.z = Math.sin(this.time * 38) * 0.12 * Math.min(1, car.stunTime * 2)
      v.body.rotation.x = car.falling ? Math.min(1.2, -car.vy * 0.04) : 0
      v.bumperMat.emissiveIntensity = car.dashTime > 0 ? 6 : 2.2
      v.shield.visible = car.shieldTime > 0
      if (v.shield.visible) {
        const blink = car.shieldTime < 1 ? (Math.sin(this.time * 30) > 0 ? 1 : 0.3) : 1
        ;(v.shield.material as THREE.MeshBasicMaterial).opacity = 0.22 * blink
        v.shield.rotation.y += dt * 2
      }
      v.heavyRing.visible = car.heavyTime > 0
      v.heavyRing.rotation.z += dt * 3
      v.flames.visible = car.boosting || car.dashTime > 0
      if (v.flames.visible) {
        const s = 0.8 + Math.random() * 0.5 + (car.nitroTime > 0 ? 0.4 : 0)
        v.flames.scale.set(1, 1, s)
      }
      v.glow.visible = !car.falling
      v.tag.visible = !car.falling
    }
  }

  private syncPickups(state: GameState) {
    const live = new Set(state.pickups.map((p) => p.id))
    for (const [id, v] of this.pickups) {
      if (!live.has(id)) {
        this.scene.remove(v.root)
        this.pickups.delete(id)
      }
    }
    for (const p of state.pickups) {
      let v = this.pickups.get(p.id)
      if (!v) {
        v = buildPickup(p.kind, this.glowTex)
        this.pickups.set(p.id, v)
        this.scene.add(v.root)
      }
      v.root.position.set(p.x, 0, p.z)
      v.gem.rotation.y = this.time * 2
      v.gem.rotation.x = this.time * 1.3
      v.gem.position.y = 1.2 + Math.sin(this.time * 3 + p.id) * 0.25
    }
  }

  private updateCamera(state: GameState, dt: number) {
    const me = this.opts.localId
      ? state.cars.find((c) => c.id === this.opts.localId)
      : undefined
    const follow = this.opts.mode === 'follow' && me && !me.eliminated
    const desired = new THREE.Vector3()
    const look = new THREE.Vector3()
    let fov = this.container.clientWidth < this.container.clientHeight ? 75 : 62

    if (follow && me) {
      if (me.falling) {
        // Freeze in place and watch yourself drop.
        desired.copy(this.camera.position)
        look.set(me.x, me.y, me.z)
      } else {
        const turn = Math.atan2(Math.sin(me.heading - this.camHeading), Math.cos(me.heading - this.camHeading))
        this.camHeading += turn * Math.min(1, dt * 4.5)
        const fx = Math.sin(this.camHeading)
        const fz = Math.cos(this.camHeading)
        desired.set(me.x - fx * 10, 5.6, me.z - fz * 10)
        look.set(me.x + fx * 4, 1, me.z + fz * 4)
        if (me.boosting) fov += 10
      }
    } else {
      const a = this.time * 0.07
      const d = this.opts.mode === 'orbit' ? 38 : 34
      desired.set(Math.sin(a) * d, this.opts.mode === 'orbit' ? 17 : 24, Math.cos(a) * d)
      look.set(0, -1, 0)
    }

    const k = 1 - Math.exp(-dt * (follow ? 6 : 1.5))
    this.camera.position.lerp(desired, k)
    this.lookTarget.lerp(look, k)
    this.camera.lookAt(this.lookTarget)
    if (this.shake > 0.01) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.8
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.8
      this.shake *= Math.exp(-dt * 6)
    }
    if (Math.abs(this.camera.fov - fov) > 0.1) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 4)
      this.camera.updateProjectionMatrix()
    }
  }

  frame(state: GameState, events: GameEvent[], dt: number) {
    this.time += dt
    this.handleEvents(state, events)

    const scale = state.arenaRadius / ARENA_START_RADIUS
    this.arena.scale.set(scale, 1, scale)
    const shrinking = state.phase === 'battle' && state.battleTime >= SHRINK_START
    const pulse = shrinking ? 0.5 + 0.5 * Math.sin(this.time * 8) : 0
    this.edgeMat.emissive.set(shrinking ? '#ff2b6a' : '#22e4ff')
    this.edgeMat.color.copy(this.edgeMat.emissive)
    this.edgeMat.emissiveIntensity = 2.6 + pulse * 2
    this.warnMat.opacity = 0.16 + pulse * 0.3

    for (const r of this.rocks) {
      r.position.y = r.userData.baseY + Math.sin(this.time * 0.6 + r.userData.phase) * 1.2
      r.rotation.y += dt * 0.1
    }

    this.syncCars(state, dt)
    this.syncPickups(state)
    this.updateSparks(dt)
    this.updateCamera(state, dt)
    this.composer.render()
  }

  dispose() {
    this.resizeObserver.disconnect()
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      mesh.geometry?.dispose()
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat?.dispose()
    })
    this.composer.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
