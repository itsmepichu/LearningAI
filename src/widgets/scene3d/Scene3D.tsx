/**
 * Draws a scene described by `SceneStep`s (tensor.ts) three ways from the same data: a 3D view (three.js, mounted only
 * near the viewport, rendered on demand), a 2D view of the same matrices for readers without WebGL or who prefer it,
 * and the step's text, which is the description. The camera turns with a drag, the arrow keys or the buttons, and
 * zooms with + and − or the buttons; the scroll wheel is left to the page.
 */
import { Component, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { RotateCcw, RotateCw, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import { useTheme } from '../../store/theme'
import { onRovingKeyDown } from '../../components/common'
import { useNearViewport, useReducedMotion } from '../kit'
import { CELL, type Mat, type SceneStep, type TensorView, type Vec3 } from './tensor'
import './scene3d.css'

// ---- WebGL --------------------------------------------------------------------------------------------------------

export function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export class GLBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

// ---- Colours ------------------------------------------------------------------------------------------------------

function token(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

export interface Palette {
  base: THREE.Color
  pos: THREE.Color
  neg: THREE.Color
  weight: THREE.Color
  ink: string
  rule: string
  dark: boolean
}

function usePalette(): Palette {
  const version = useTheme((s) => s.version)
  const resolved = useTheme((s) => s.resolved)
  return useMemo(
    () => ({
      base: new THREE.Color(token('--sunk', '#eef1f5')),
      pos: new THREE.Color(token('--accent', '#0B7285')),
      neg: new THREE.Color(token('--signal', '#9C5000')),
      weight: new THREE.Color(token('--sim', '#6741D9')),
      ink: token('--ink', '#0F1B2A'),
      rule: token('--muted', '#5b6675'),
      dark: resolved === 'dark',
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, resolved],
  )
}

/** A cell's colour: signed values on a diverging scale (accent above zero, signal below), weights on a sequential one. */
export function cellColor(p: Palette, kind: TensorView['kind'], v: number, scale: number, out = new THREE.Color()) {
  if (kind === 'weight') return out.copy(p.base).lerp(p.weight, Math.pow(Math.max(0, Math.min(1, v / scale)), 0.6))
  const t = Math.max(-1, Math.min(1, v / scale))
  return out.copy(p.base).lerp(t >= 0 ? p.pos : p.neg, Math.pow(Math.abs(t), 0.7))
}

const css = (c: THREE.Color) => `#${c.getHexString()}`

// ---- 3D -----------------------------------------------------------------------------------------------------------

interface View {
  az: number
  el: number
  zoom: number
}
const START: View = { az: 0.55, el: 0.42, zoom: 1 }
const clampEl = (el: number) => Math.max(-0.2, Math.min(1.35, el))
const clampZoom = (z: number) => Math.max(0.45, Math.min(2.2, z))

/** Moves the camera towards where the step and the view ask it to be, rendering frames only while it moves. */
function Rig({ target, distance, view, reduced }: { target: Vec3; distance: number; view: View; reduced: boolean }) {
  const { camera, invalidate } = useThree()
  const look = useRef(new THREE.Vector3(...target))
  const goal = useMemo(() => {
    const r = distance * view.zoom
    return {
      pos: new THREE.Vector3(
        target[0] + r * Math.cos(view.el) * Math.sin(view.az),
        target[1] + r * Math.sin(view.el),
        target[2] + r * Math.cos(view.el) * Math.cos(view.az),
      ),
      look: new THREE.Vector3(...target),
    }
  }, [target, distance, view])
  const first = useRef(true)
  useEffect(() => {
    if (first.current || reduced) {
      camera.position.copy(goal.pos)
      look.current.copy(goal.look)
      camera.lookAt(look.current)
      first.current = false
    }
    invalidate()
  }, [goal, camera, invalidate, reduced])
  useFrame(() => {
    const done = camera.position.distanceTo(goal.pos) < 0.005 && look.current.distanceTo(goal.look) < 0.005
    if (done) return
    camera.position.lerp(goal.pos, 0.14)
    look.current.lerp(goal.look, 0.14)
    camera.lookAt(look.current)
    invalidate()
  })
  return null
}

/** One tensor as an instanced block of cubes. Cells glide to new places when the step moves them. */
function TensorMesh({ t, palette, reduced }: { t: TensorView; palette: Palette; reduced: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const { invalidate } = useThree()
  const current = useRef<Float32Array | null>(null)
  const count = t.cells.length
  const goal = useMemo(() => Float32Array.from(t.cells.flatMap((c) => c.at)), [t.cells])
  const matrix = useMemo(() => new THREE.Matrix4(), [])

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const c = new THREE.Color()
    t.cells.forEach((cell, i) => mesh.setColorAt(i, cellColor(palette, t.kind, cell.v, t.scale, c)))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    if (!current.current || reduced) current.current = Float32Array.from(goal)
    invalidate()
  }, [t, palette, goal, reduced, invalidate])

  useFrame(() => {
    const mesh = ref.current
    const pos = current.current
    if (!mesh || !pos) return
    let moving = false
    for (let i = 0; i < pos.length; i++) {
      const d = goal[i] - pos[i]
      if (Math.abs(d) > 0.001) {
        pos[i] += d * 0.16
        moving = true
      } else pos[i] = goal[i]
    }
    for (let i = 0; i < count; i++) {
      matrix.makeTranslation(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])
      mesh.setMatrixAt(i, matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (moving) invalidate()
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[CELL, CELL, CELL]} />
      <meshLambertMaterial transparent opacity={t.faded ? 0.3 : 1} depthWrite={!t.faded} />
    </instancedMesh>
  )
}

/** Labels attach to `overlay`, an element React owns, so they come away cleanly when the canvas unmounts. */
function Scene({ step, palette, view, reduced, overlay }: { step: SceneStep; palette: Palette; view: View; reduced: boolean; overlay: RefObject<HTMLDivElement | null> }) {
  const portal = overlay as RefObject<HTMLElement>
  return (
    <>
      <ambientLight intensity={palette.dark ? 1.6 : 1.9} />
      <directionalLight position={[4, 8, 6]} intensity={palette.dark ? 1.1 : 0.9} />
      <Rig target={step.target} distance={step.distance} view={view} reduced={reduced} />
      {step.tensors.map((t) => (
        <group key={`${t.id}-${t.cells.length}`}>
          <TensorMesh t={t} palette={palette} reduced={reduced} />
          {!t.faded && (
            <Html position={t.labelAt} className="s3-label" zIndexRange={[20, 0]} portal={portal} aria-hidden>
              <b>{t.label}</b>
              <span>{t.shape}</span>
            </Html>
          )}
        </group>
      ))}
      {step.paths?.map((p) => (
        <group key={p.id}>
          <Line points={p.points} color={palette.rule} lineWidth={2} dashed dashSize={0.18} gapSize={0.12} />
          <Html position={p.points.reduce((hi, q) => (q[1] > hi[1] ? q : hi), p.points[0])} className="s3-label s3-path" zIndexRange={[20, 0]} portal={portal} aria-hidden>
            {p.label}
          </Html>
        </group>
      ))}
    </>
  )
}

// ---- 2D -----------------------------------------------------------------------------------------------------------

function Grid({ m, t, palette, title }: { m: Mat; t: TensorView; palette: Palette; title?: string }) {
  const s = Math.max(6, Math.min(16, Math.floor(180 / m[0].length)))
  const c = new THREE.Color()
  return (
    <svg width={m[0].length * s} height={m.length * s} role="img" aria-label={`${title ?? t.label}: ${m.length} by ${m[0].length}`} className="s3-grid">
      {m.map((row, r) => row.map((v, j) => <rect key={`${r}-${j}`} x={j * s} y={r * s} width={s - 1} height={s - 1} fill={css(cellColor(palette, t.kind, v, t.scale, c))} />))}
    </svg>
  )
}

function Flat({ step, palette }: { step: SceneStep; palette: Palette }) {
  return (
    <div className="s3-flat">
      {step.tensors.map((t) => (
        <div key={t.id} className={'s3-t' + (t.faded ? ' faded' : '')}>
          <div className="s3-cap">
            <b>{t.label}</b> <span>{t.shape}</span>
          </div>
          <div className="s3-slices">
            {t.slices.map((m, i) => (
              <div key={i} className="s3-slice">
                {t.sliceNames && <small>{t.sliceNames[i]}</small>}
                <Grid m={m} t={t} palette={palette} title={t.sliceNames ? `${t.label}, ${t.sliceNames[i]}` : undefined} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---- The widget's frame ---------------------------------------------------------------------------------------------

export function Scene3D({ steps, step, label, legend }: { steps: SceneStep[]; step: number; label: string; legend: ReactNode }) {
  const palette = usePalette()
  const reduced = useReducedMotion()
  const gl = useMemo(hasWebGL, [])
  const [mode, setMode] = useState<'3d' | '2d'>(gl ? '3d' : '2d')
  const [view, setView] = useState<View>(START)
  const [ref, near] = useNearViewport<HTMLDivElement>()
  const drag = useRef<{ x: number; y: number } | null>(null)
  const overlay = useRef<HTMLDivElement>(null)
  const helpId = useId()
  const s = steps[Math.min(step, steps.length - 1)]

  const turn = (daz: number, del = 0) => setView((v) => ({ ...v, az: v.az + daz, el: clampEl(v.el + del) }))
  const zoom = (f: number) => setView((v) => ({ ...v, zoom: clampZoom(v.zoom * f) }))
  const onKey = (e: KeyboardEvent) => {
    const map: Record<string, () => void> = {
      ArrowLeft: () => turn(-0.2), ArrowRight: () => turn(0.2), ArrowUp: () => turn(0, 0.12), ArrowDown: () => turn(0, -0.12),
      '+': () => zoom(1 / 1.15), '=': () => zoom(1 / 1.15), '-': () => zoom(1.15), '0': () => setView(START),
    }
    const f = map[e.key]
    if (f) {
      e.preventDefault()
      f()
    }
  }
  const onDown = (e: PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: PointerEvent) => {
    if (!drag.current) return
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    drag.current = { x: e.clientX, y: e.clientY }
    // On touch, only sideways drags turn the scene, so the page still scrolls.
    turn(-dx * 0.008, e.pointerType === 'touch' ? 0 : dy * 0.006)
  }
  const onUp = () => (drag.current = null)

  return (
    <div className="s3" ref={ref}>
      <div className="ctl s3-bar">
        <div className="seg tabs" role="radiogroup" aria-label="View" onKeyDown={onRovingKeyDown}>
          <button type="button" role="radio" aria-checked={mode === '3d'} tabIndex={mode === '3d' ? 0 : -1} className={mode === '3d' ? 'on' : ''} disabled={!gl} onClick={() => setMode('3d')}>
            3D view
          </button>
          <button type="button" role="radio" aria-checked={mode === '2d'} tabIndex={mode === '2d' ? 0 : -1} className={mode === '2d' ? 'on' : ''} onClick={() => setMode('2d')}>
            2D view
          </button>
        </div>
        {mode === '3d' && (
          <div className="s3-cam">
            <button type="button" className="btn" aria-label="Turn left" onClick={() => turn(-0.3)}><RotateCcw aria-hidden="true" /></button>
            <button type="button" className="btn" aria-label="Turn right" onClick={() => turn(0.3)}><RotateCw aria-hidden="true" /></button>
            <button type="button" className="btn" aria-label="Zoom in" onClick={() => zoom(1 / 1.2)}><ZoomIn aria-hidden="true" /></button>
            <button type="button" className="btn" aria-label="Zoom out" onClick={() => zoom(1.2)}><ZoomOut aria-hidden="true" /></button>
            <button type="button" className="btn" aria-label="Reset the view" onClick={() => setView(START)}><Undo2 aria-hidden="true" /></button>
          </div>
        )}
      </div>
      {!gl && <p className="wk-hint">WebGL is not available in this browser, so this figure shows its 2D view.</p>}
      {mode === '3d' ? (
        <div
          className="s3-canvas"
          tabIndex={0}
          role="application"
          aria-roledescription="3D view"
          aria-label={`${label}. ${s.title}.`}
          aria-describedby={helpId}
          onKeyDown={onKey}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {near ? (
            <GLBoundary fallback={<div className="s3-nogl">The 3D view failed to start (a WebGL error). Choose 2D view above.</div>}>
              <Canvas frameloop="demand" dpr={[1, 2]} camera={{ fov: 40, near: 0.1, far: 200, position: [6, 4, 8] }} gl={{ antialias: true }}>
                <Scene step={s} palette={palette} view={view} reduced={reduced} overlay={overlay} />
              </Canvas>
            </GLBoundary>
          ) : (
            <div className="s3-nogl">Loading the 3D view…</div>
          )}
          <div className="s3-overlay" ref={overlay} aria-hidden="true" />
          <span className="s3-hint" id={helpId}>Drag, or use the arrow keys, to turn · + and − to zoom · 0 to reset</span>
        </div>
      ) : (
        <Flat step={s} palette={palette} />
      )}
      <div className="s3-legend">{legend}</div>
      <p className="s3-text" aria-live="polite">
        <b>{s.title}.</b> {s.text}
      </p>
      <details className="s3-all">
        <summary>The whole figure in words</summary>
        <ol>
          {steps.map((st) => (
            <li key={st.title}>
              <b>{st.title}.</b> {st.text} <span className="s3-shapes">Shown: {st.tensors.filter((t) => !t.faded).map((t) => `${t.label} (${t.shape})`).join('; ')}.</span>
            </li>
          ))}
        </ol>
      </details>
    </div>
  )
}
