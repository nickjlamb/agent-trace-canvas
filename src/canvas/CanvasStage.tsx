import { useEffect, useMemo, useRef } from 'react'
import { Stage, Layer, Rect } from 'react-konva'
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

  // Fit the whole trace into view. Once per trace normally; continuously while
  // streaming so the growing graph stays framed as nodes arrive.
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

    // When the detail panel is open, fit into the space left of it so nodes
    // (and the active step) aren't hidden behind the panel.
    const PANEL_W = 380
    const panelOpen = !!(selectedId || activeId)
    const availW = width - (panelOpen ? PANEL_W : 0)

    const fit = Math.min((availW - pad * 2) / graphW, (height - pad * 2) / graphH, 1.2)
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, fit))
    setViewport({
      scale: newScale,
      x: (availW - graphW * newScale) / 2 - minX * newScale,
      y: (height - graphH * newScale) / 2 - minY * newScale,
    })
    if (!streaming) fittedRun.current = trace.runId
  }, [trace, nodes, width, height, streaming, selectedId, activeId, setViewport])

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = e.target.getStage()
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return

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
    <div ref={wrapRef} style={{ width: '100%', height: '100%' }}>
      <Stage
        width={width}
        height={height}
        x={x}
        y={y}
        scaleX={scale}
        scaleY={scale}
        draggable
        onWheel={handleWheel}
        onDragEnd={(e) => setViewport({ x: e.target.x(), y: e.target.y() })}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) select(null)
        }}
        style={{ background: '#0d0f14' }}
      >
        <Layer listening={false}>
          <BackgroundDots width={width} height={height} scale={scale} pos={{ x, y }} />
        </Layer>
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

function BackgroundDots({
  width,
  height,
  scale,
  pos,
}: {
  width: number
  height: number
  scale: number
  pos: { x: number; y: number }
}) {
  const gap = 28
  const x0 = -pos.x / scale
  const y0 = -pos.y / scale
  const x1 = (width - pos.x) / scale
  const y1 = (height - pos.y) / scale
  const startX = Math.floor(x0 / gap) * gap
  const startY = Math.floor(y0 / gap) * gap

  const dots = []
  for (let xx = startX; xx < x1; xx += gap) {
    for (let yy = startY; yy < y1; yy += gap) {
      dots.push(<Rect key={`${xx}:${yy}`} x={xx} y={yy} width={2} height={2} fill="#222733" />)
    }
  }
  return <>{dots}</>
}
