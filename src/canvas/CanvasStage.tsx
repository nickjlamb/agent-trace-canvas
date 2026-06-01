import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Rect, Text, Group } from 'react-konva'
import type Konva from 'konva'

/** Proof-of-render placeholder nodes; M2 replaces these with a real trace. */
const DEMO_NODES = [
  { id: 'n1', x: 80, y: 120, label: 'Plan steps', kind: 'model_call', status: 'pass' },
  { id: 'n2', x: 340, y: 60, label: 'Web search', kind: 'tool_call', status: 'pass' },
  { id: 'n3', x: 340, y: 200, label: 'Retrieve docs', kind: 'retrieval', status: 'warn' },
  { id: 'n4', x: 620, y: 130, label: 'Summarize', kind: 'model_call', status: 'fail' },
] as const

const STATUS_COLOR: Record<string, string> = {
  pass: '#3ecf8e',
  warn: '#e7b85c',
  fail: '#f06d6d',
}

const NODE_W = 180
const NODE_H = 64
const MIN_SCALE = 0.25
const MAX_SCALE = 4

export function CanvasStage() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  // Track container size so the stage fills the available area responsively.
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

  // Zoom toward the cursor on wheel.
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
    const direction = e.evt.deltaY > 0 ? -1 : 1
    const factor = 1.08
    let newScale = direction > 0 ? oldScale * factor : oldScale / factor
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
        style={{ background: '#0d0f14' }}
      >
        <Layer>
          <BackgroundDots width={size.width} height={size.height} scale={scale} pos={pos} />
        </Layer>
        <Layer>
          {DEMO_NODES.map((n) => (
            <Group key={n.id} x={n.x} y={n.y}>
              <Rect
                width={NODE_W}
                height={NODE_H}
                cornerRadius={10}
                fill="#161a22"
                stroke={STATUS_COLOR[n.status]}
                strokeWidth={2}
                shadowColor="#000"
                shadowBlur={8}
                shadowOpacity={0.4}
              />
              <Text
                text={n.label}
                x={14}
                y={14}
                fontSize={15}
                fontStyle="600"
                fill="#f4f6fa"
              />
              <Text text={n.kind} x={14} y={38} fontSize={12} fill="#8a90a0" />
            </Group>
          ))}
        </Layer>
      </Stage>
    </div>
  )
}

/** A dotted grid that covers the visible region regardless of pan/zoom. */
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
  // World-space bounds currently visible.
  const x0 = -pos.x / scale
  const y0 = -pos.y / scale
  const x1 = (width - pos.x) / scale
  const y1 = (height - pos.y) / scale

  const startX = Math.floor(x0 / gap) * gap
  const startY = Math.floor(y0 / gap) * gap

  const dots = []
  for (let x = startX; x < x1; x += gap) {
    for (let y = startY; y < y1; y += gap) {
      dots.push(
        <Rect key={`${x}:${y}`} x={x} y={y} width={2} height={2} fill="#222733" />,
      )
    }
  }
  return <>{dots}</>
}
