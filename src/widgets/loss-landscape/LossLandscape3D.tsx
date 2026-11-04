import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Pause, Play, RotateCcw, StepForward } from 'lucide-react'
import { useTheme } from '../../store/theme'
import { DOMAIN, OPTS, contours, initState, loss, makeNoise, step, type OptName, type OptState } from './optim'
import './loss-landscape.css'

/* World mapping: loss-space (x, y, loss) -> three.js (X, Y-up, Z). */
const XY = 1.0
/** Height is log-compressed so the steep walls do not dwarf the valley: h = 0.95·ln(1 + loss − min). */
const MIN = -1.5
const lift = (l: number) => 0.95 * Math.log1p(Math.max(0, l - MIN))
const toWorld = (x: number, y: number, l = loss(x, y), dy = 0) => new THREE.Vector3(x * XY, lift(l) + dy, -y * XY)

const LEVELS = [-1.35, -1.1, -0.8, -0.5, -0.2, 0.1, 0.4, 0.8, 1.3, 1.9, 2.6, 3.4]

function cssColor(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

function usePalette() {
  const version = useTheme((s) => s.version)
  const resolved = useTheme((s) => s.resolved)
  return useMemo(
    () => ({
      low: cssColor('--accent', '#0B7285'),
      mid: cssColor('--sim', '#6741D9'),
      high: cssColor('--signal', '#B35C00'),
      ink: cssColor('--ink', '#0F1B2A'),
      surface: cssColor('--surface', '#ffffff'),
      opt: { sgd: cssColor('--bad', '#C92A2A'), momentum: cssColor('--ok', '#2B8A3E'), adam: cssColor('--sim', '#6741D9') } as Record<OptName, string>,
      dark: resolved === 'dark',
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, resolved],
  )
}

function Surface({ palette, onPick }: { palette: ReturnType<typeof usePalette>; onPick: (x: number, y: number) => void }) {
  const geo = useMemo(() => {
    const N = 120
    const g = new THREE.PlaneGeometry(2 * DOMAIN * XY, 2 * DOMAIN * XY, N, N)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    const lo = new THREE.Color(palette.low), mi = new THREE.Color(palette.mid), hi = new THREE.Color(palette.high)
    const c = new THREE.Color()
    const wash = new THREE.Color(palette.dark ? '#0A111D' : '#FFFFFF')
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / XY, y = -pos.getZ(i) / XY
      const l = loss(x, y)
      pos.setY(i, lift(l))
      const t = Math.max(0, Math.min(1, lift(l) / 2.3))
      if (t < 0.35) c.copy(lo).lerp(mi, t / 0.35)
      else c.copy(mi).lerp(hi, (t - 0.35) / 0.65)
      c.lerp(wash, palette.dark ? 0.18 : 0.32)
      colors.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    g.computeVertexNormals()
    return g
  }, [palette])
  useEffect(() => () => geo.dispose(), [geo])

  const iso = useMemo(() => contours(LEVELS), [])
  const isoGeo = useMemo(
    () =>
      iso.map((seg) => {
        const p = new Float32Array((seg.length / 2) * 3)
        for (let k = 0; k < seg.length / 2; k++) {
          const v = toWorld(seg[2 * k], seg[2 * k + 1], undefined, 0.012)
          p.set([v.x, v.y, v.z], k * 3)
        }
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.BufferAttribute(p, 3))
        return g
      }),
    [iso],
  )

  const pick = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (e.delta > 4) return // ignore drags used for orbiting
    onPick(e.point.x / XY, -e.point.z / XY)
  }

  return (
    <group>
      <mesh geometry={geo} onClick={pick} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.55} metalness={0.05} side={THREE.DoubleSide} transparent opacity={0.94} />
      </mesh>
      {isoGeo.map((g, i) => (
        <lineSegments key={i} geometry={g}>
          <lineBasicMaterial color={palette.dark ? '#ffffff' : palette.ink} transparent opacity={palette.dark ? 0.28 : 0.22} />
        </lineSegments>
      ))}
      {/* global minimum marker */}
      <mesh position={toWorld(0, 0, undefined, 0.03)}>
        <ringGeometry args={[0.08, 0.12, 32]} />
        <meshBasicMaterial color={palette.ink} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function Trails({ states, enabled, palette }: { states: Record<OptName, OptState>; enabled: Record<OptName, boolean>; palette: ReturnType<typeof usePalette> }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => invalidate(), [states, invalidate])
  return (
    <>
      {OPTS.filter((o) => enabled[o.id]).map((o) => {
        const s = states[o.id]
        const pts = s.path.map(([x, y]) => toWorld(Math.max(-DOMAIN, Math.min(DOMAIN, x)), Math.max(-DOMAIN, Math.min(DOMAIN, y)), undefined, 0.05))
        const head = pts[pts.length - 1]
        return (
          <group key={o.id}>
            {pts.length > 1 && <Line points={pts} color={palette.opt[o.id]} lineWidth={3} />}
            <mesh position={head} castShadow>
              <sphereGeometry args={[0.09, 24, 24]} />
              <meshStandardMaterial color={palette.opt[o.id]} emissive={palette.opt[o.id]} emissiveIntensity={0.35} />
            </mesh>
          </group>
        )
      })}
    </>
  )
}

class GLBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

function LossChart({ states, enabled, palette }: { states: Record<OptName, OptState>; enabled: Record<OptName, boolean>; palette: ReturnType<typeof usePalette> }) {
  const W = 300, H = 120, P = 6
  const maxT = Math.max(20, ...OPTS.map((o) => states[o.id].losses.length - 1))
  const lo = -1.55, hi = Math.max(1, ...OPTS.map((o) => states[o.id].losses[0]))
  const X = (t: number) => P + (t / maxT) * (W - 2 * P)
  const Y = (l: number) => H - P - ((Math.min(l, hi) - lo) / (hi - lo)) * (H - 2 * P)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ll-chart" role="img" aria-label="Loss per step for each optimizer">
      <line x1={P} x2={W - P} y1={Y(-1.5)} y2={Y(-1.5)} className="ll-min" />
      <text x={W - P} y={Y(-1.5) - 4} textAnchor="end" className="ll-min-t">global minimum −1.50</text>
      {OPTS.filter((o) => enabled[o.id]).map((o) => (
        <polyline key={o.id} fill="none" stroke={palette.opt[o.id]} strokeWidth={2} points={states[o.id].losses.map((l, t) => `${X(t)},${Y(l)}`).join(' ')} />
      ))}
    </svg>
  )
}

export default function LossLandscape3D() {
  const palette = usePalette()
  const [start, setStart] = useState<[number, number]>([3.2, -2.4])
  const [lr, setLr] = useState(0.03)
  const [noise, setNoise] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [enabled, setEnabled] = useState<Record<OptName, boolean>>({ sgd: true, momentum: true, adam: true })
  const fresh = (p: [number, number]) => ({ sgd: initState(...p), momentum: initState(...p), adam: initState(...p) })
  const [states, setStates] = useState<Record<OptName, OptState>>(() => fresh(start))
  const rnd = useRef(makeNoise(11))
  const [visible, setVisible] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const gl = useMemo(hasWebGL, [])
  const MAX = 400

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '200px' })
    if (wrap.current) io.observe(wrap.current)
    return () => io.disconnect()
  }, [])

  const reset = (p = start) => {
    setPlaying(false)
    rnd.current = makeNoise(11)
    setStates(fresh(p))
  }
  const advance = (n = 1) =>
    setStates((s) => {
      const out = { ...s }
      for (let k = 0; k < n; k++) for (const o of OPTS) if (out[o.id].t < MAX) out[o.id] = step(out[o.id], o.id, lr, noise, rnd.current)
      return out
    })

  const finished = OPTS.every((o) => !enabled[o.id] || states[o.id].t >= MAX || states[o.id].diverged)
  useEffect(() => {
    if (!playing) return
    if (finished) {
      setPlaying(false)
      return
    }
    const id = setInterval(() => advance(2), 33)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, finished, lr, noise])

  const pick = (x: number, y: number) => {
    const p: [number, number] = [Math.max(-DOMAIN, Math.min(DOMAIN, x)), Math.max(-DOMAIN, Math.min(DOMAIN, y))]
    setStart(p)
    reset(p)
  }

  const lrPos = Math.log10(lr) // slider in log space: 0.003 … 1.5
  return (
    <figure className="fig live ll" ref={wrap}>
      <div className="stage">
        <div className="ll-wrap">
          <div className="ll-canvas" aria-label="3D loss surface. Drag to orbit, scroll to zoom, click the surface to choose a start point.">
            {!gl ? (
              <div className="ll-nogl">WebGL is not available in this browser, so the 3D surface cannot be drawn. The optimizer numbers on the right still run.</div>
            ) : visible ? (
              <GLBoundary fallback={<div className="ll-nogl">The 3D view failed to start (WebGL error). The optimizer numbers on the right still run.</div>}>
                <Canvas frameloop="demand" camera={{ position: [6.4, 6.6, 9.6], fov: 36 }} dpr={[1, 2]} shadows>
                  <ambientLight intensity={palette.dark ? 0.55 : 0.75} />
                  <directionalLight position={[4, 8, 3]} intensity={1.1} castShadow />
                  <directionalLight position={[-5, 3, -4]} intensity={0.35} />
                  <Surface palette={palette} onPick={pick} />
                  <Trails states={states} enabled={enabled} palette={palette} />
                  <OrbitControls enableDamping makeDefault minDistance={4} maxDistance={16} maxPolarAngle={Math.PI * 0.49} target={[0, 0.5, 0]} />
                </Canvas>
              </GLBoundary>
            ) : (
              <div className="ll-nogl">Preparing 3D view…</div>
            )}
            <span className="ll-hint">Drag to orbit · scroll to zoom · click the surface to set the start point</span>
          </div>

          <div className="ll-side">
            <div className="ll-opts">
              {OPTS.map((o) => {
                const s = states[o.id]
                return (
                  <label key={o.id} className={'ll-opt' + (enabled[o.id] ? '' : ' off')} style={{ ['--oc' as string]: palette.opt[o.id] }}>
                    <input type="checkbox" checked={enabled[o.id]} onChange={(e) => setEnabled((v) => ({ ...v, [o.id]: e.target.checked }))} />
                    <span className="ll-dot" />
                    <span className="ll-opt-b">
                      <b>{o.label}</b>
                      <code>{o.rule}</code>
                    </span>
                    <span className="ll-opt-v" aria-live="polite">
                      {s.diverged ? <em>diverged</em> : <>loss {s.losses[s.losses.length - 1].toFixed(3)}</>}
                      <small>step {s.t}</small>
                    </span>
                  </label>
                )
              })}
            </div>
            <LossChart states={states} enabled={enabled} palette={palette} />
            <div className="ctl ll-ctl">
              <label>
                Learning rate η <output>{lr < 0.1 ? lr.toFixed(3) : lr.toFixed(2)}</output>
                <input type="range" min={-2.5} max={0.2} step={0.01} value={lrPos} onChange={(e) => { setLr(+(10 ** +e.target.value).toPrecision(2)); reset() }} />
              </label>
              <label>
                Mini-batch noise σ <output>{noise.toFixed(2)}</output>
                <input type="range" min={0} max={1.5} step={0.05} value={noise} onChange={(e) => { setNoise(+e.target.value); reset() }} />
              </label>
              <div className="ll-btns">
                <button type="button" className="btn primary" onClick={() => setPlaying((p) => !p)} disabled={finished && !playing}>
                  {playing ? <Pause size={15} /> : <Play size={15} />} {playing ? 'Pause' : 'Run'}
                </button>
                <button type="button" className="btn" onClick={() => advance(1)} disabled={playing}>
                  <StepForward size={15} /> Step
                </button>
                <button type="button" className="btn" onClick={() => reset()}>
                  <RotateCcw size={15} /> Reset
                </button>
              </div>
              <div className="ll-presets">
                Try:
                <button type="button" onClick={() => { setLr(0.03); setNoise(0); reset() }}>η 0.03 (slow SGD)</button>
                <button type="button" onClick={() => { setLr(0.9); setNoise(0); reset() }}>η 0.9 (SGD oscillates)</button>
                <button type="button" onClick={() => { setLr(1.6); setNoise(0); reset() }}>η 1.6 (diverges)</button>
                <button type="button" onClick={() => { setLr(0.06); setNoise(0.9); reset() }}>noisy batches</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption>
        <b>Three optimizers racing down a real loss surface, running in your browser.</b> The height is the loss for two parameters; the gradient is
        computed exactly at every step. A small local basin sits on the slope at the front right, and the ring marks the global minimum. At a low
        learning rate SGD crawls, momentum builds speed and rolls through the basin, and Adam takes evenly sized steps whatever the slope. Raise η
        and SGD starts to zig-zag across the steep direction, then diverges. Add mini-batch noise to see why noisy gradients can still converge.
        Height is drawn on a log scale so the valley floor stays visible. Real networks have millions of parameters, not two, so this shows the update rules, not a real network's loss surface.
      </figcaption>
    </figure>
  )
}
