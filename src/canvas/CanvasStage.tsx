import { useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Rect } from 'react-konva'
import type Konva from 'konva'
import { useStore } from '../store'
import { TraceNode } from './TraceNode'
import { TraceEdge } from './TraceEdge'

const MIN_SCALE = 0.25
const MAX_SCALE = 4

export function CanvasStage() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  const nodes = useStore((s) => s.nodes)
  const trace = useStore((s) => s.trace)
  const selectedId = useStore((s) => s.selectedId)
  const select = useStore((s) => s.select)

  const nodeById = useMemo(() => {
    const m = new Map(nodes.map((n) => [n.id, n]))
    return m
  }, [nodes])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight })
    })
    ro.observe(el)
    setSize({ width: el.clientWidth, height: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = e.target.getStage()
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return

    const oldScale = scale
    const mousePoint = {
      x: (pointer.x - pos.x) / oldScale,
      y: (pointer.y - pos.y) / oldScale,
    }
    const factor = 1.08
    let newScale = e.evt.deltaY > 0 ? oldScale / factor : oldScale * factor
    newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale))

    setScale(newScale)
    setPos({
      x: pointer.x - mousePoint.x * newScale,
      y: pointer.y - mousePoint.y * newScale,
    })
  }

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%' }}>
      <Stage
        width={size.width}
        height={size.height}
        x={pos.x}
        y={pos.y}
        scaleX={scale}
        scaleY={scale}
        draggable
        onWheel={handleWheel}
        onDragEnd={(e) => setPos({ x: e.target.x(), y: e.target.y() })}
        onMouseDown={(e) => {
          // click on empty canvas (the Stage itself) deselects
          if (e.target === e.target.getStage()) select(null)
        }}
        style={{ background: '#0d0f14' }}
      >
        <Layer listening={false}>
          <BackgroundDots width={size.width} height={size.height} scale={scale} pos={pos} />
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
            <TraceNode key={n.id} node={n} selected={n.id === selectedId} onSelect={select} />
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
  for (let x = startX; x < x1; x += gap) {
    for (let y = startY; y < y1; y += gap) {
      dots.push(<Rect key={`${x}:${y}`} x={x} y={y} width={2} height={2} fill="#222733" />)
    }
  }
  return <>{dots}</>
}
