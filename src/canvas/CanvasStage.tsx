import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Stage, Layer } from 'react-konva'
import type Konva from 'konva'
import { useStore, MIN_SCALE, MAX_SCALE } from '../store'
import { TraceNode } from './TraceNode'
import { TraceEdge } from './TraceEdge'

export function CanvasStage() {
  const wrapRef = useRef<HTMLDivElement>(null)

  const nodes = useStore((s) => s.nodes)
  const trace = useStore((s) => s.trace)
  const selectedId = useStore((s) => s.selectedId)
  const select = useStore((s) => s.select)
  const streaming = useStore((s) => s.streaming)
  const activeId = useStore((s) => s.activeId)
  const cameraMode = useStore((s) => s.cameraMode)
  const setViewport = useStore((s) => s.setViewport)
  const scale = useStore((s) => s.viewport.scale)
  const x = useStore((s) => s.viewport.x)
  const y = useStore((s) => s.viewport.y)
  const width = useStore((s) => s.viewport.width)
  const height = useStore((s) => s.viewport.height)

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setViewport({ width: el.clientWidth, height: el.clientHeight })
    })
    ro.observe(el)
    setViewport({ width: el.clientWidth, height: el.clientHeight })
    return () => ro.disconnect()
  }, [setViewport])

  // --- Eased camera: glide the viewport toward a target instead of snapping. ---
  const targetRef = useRef<{ scale: number; x: number; y: number } | null>(null)
  const rafRef = useRef(0)
  const animate = useCallback(() => {
    const t = targetRef.current
    if (!t) return
    const cur = useStore.getState().viewport
    const k = 0.22
    let nx = cur.x + (t.x - cur.x) * k
    let ny = cur.y + (t.y - cur.y) * k
    let ns = cur.scale + (t.scale - cur.scale) * k
    const done =
      Math.abs(t.x - nx) < 0.5 && Math.abs(t.y - ny) < 0.5 && Math.abs(t.scale - ns) < 0.002
    if (done) {
      nx = t.x
      ny = t.y
      ns = t.scale
      targetRef.current = null
    }
    setViewport({ x: nx, y: ny, scale: ns })
    if (!done) rafRef.current = requestAnimationFrame(animate)
  }, [setViewport])

  const glideTo = useCallback(
    (target: { scale: number; x: number; y: number }) => {
      targetRef.current = target
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(animate)
    },
    [animate],
  )

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  // Viewport control:
  //  - while streaming: hold a readable zoom and pan to follow the active node
  //    (a camera tracking the agent left-to-right), so nodes stay legible.
  //  - otherwise: fit the whole trace once (also runs when a run ends → zoom out).
  const fittedRun = useRef<string | null>(null)
  useEffect(() => {
    if (!trace || nodes.length === 0 || width === 0 || height === 0) return
    if (!streaming && fittedRun.current === trace.runId) return

    const minX = Math.min(...nodes.map((n) => n.x))
    const minY = Math.min(...nodes.map((n) => n.y))
    const maxX = Math.max(...nodes.map((n) => n.x + n.width))
    const maxY = Math.max(...nodes.map((n) => n.y + n.height))
    const graphW = maxX - minX
    const graphH = maxY - minY
    const pad = 80

    // Reserve space when the detail panel is open so nodes aren't hidden behind it.
    const PANEL_W = 380
    const panelOpen = !!(selectedId || activeId)
    const availW = width - (panelOpen ? PANEL_W : 0)

    // Fit-the-whole-graph target.
    const fit = Math.min((availW - pad * 2) / graphW, (height - pad * 2) / graphH, 1.2)
    const fitScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, fit))
    const fitTarget = {
      scale: fitScale,
      x: (availW - graphW * fitScale) / 2 - minX * fitScale,
      y: (height - graphH * fitScale) / 2 - minY * fitScale,
    }

    if (streaming) {
      if (cameraMode === 'fit') {
        glideTo(fitTarget) // "normal view" — show the whole graph as it grows
        return
      }
      // Camera-follow: readable zoom (fit height), keep the active step ~2/3 across.
      const active = nodes.find((n) => n.id === activeId) ?? nodes[nodes.length - 1]
      const s = Math.min(1, Math.max(0.55, (height - pad * 2) / graphH))
      const cx = active.x + active.width / 2
      glideTo({ scale: s, x: availW * 0.66 - cx * s, y: (height - graphH * s) / 2 - minY * s })
      return
    }

    glideTo(fitTarget)
    fittedRun.current = trace.runId
  }, [trace, nodes, width, height, streaming, selectedId, activeId, cameraMode, glideTo])

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = e.target.getStage()
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return

    cancelAnimationFrame(rafRef.current) // user takes over
    targetRef.current = null
    const mousePoint = { x: (pointer.x - x) / scale, y: (pointer.y - y) / scale }
    const factor = 1.08
    let newScale = e.evt.deltaY > 0 ? scale / factor : scale * factor
    newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale))

    setViewport({
      scale: newScale,
      x: pointer.x - mousePoint.x * newScale,
      y: pointer.y - mousePoint.y * newScale,
    })
  }

  return (
    <div
      ref={wrapRef}
      style={{
        width: '100%',
        height: '100%',
        background: '#0d0f14',
        backgroundImage: 'radial-gradient(#222733 1.1px, transparent 1.1px)',
        backgroundSize: '26px 26px',
      }}
    >
      <Stage
        width={width}
        height={height}
        x={x}
        y={y}
        scaleX={scale}
        scaleY={scale}
        draggable
        onWheel={handleWheel}
        onDragStart={() => {
          cancelAnimationFrame(rafRef.current)
          targetRef.current = null
        }}
        onDragEnd={(e) => setViewport({ x: e.target.x(), y: e.target.y() })}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) select(null)
        }}
        style={{ background: 'transparent' }}
      >
        <Layer>
          {trace?.edges.map((e, i) => {
            const from = nodeById.get(e.from)
            const to = nodeById.get(e.to)
            if (!from || !to) return null
            return <TraceEdge key={i} from={from} to={to} label={e.label} />
          })}
        </Layer>
        <Layer>
          {nodes.map((n) => (
            <TraceNode
              key={n.id}
              node={n}
              selected={n.id === selectedId}
              active={streaming && n.id === activeId}
              onSelect={select}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  )
}
