import { useRef } from 'react'
import { useStore } from '../store'
import type { EvalStatus } from '../types'

const STATUS_COLOR: Record<EvalStatus, string> = {
  pass: '#3ecf8e',
  warn: '#e7b85c',
  fail: '#f06d6d',
}

const MM_W = 190
const MM_H = 130
const PAD = 10

export function MiniMap() {
  const nodes = useStore((s) => s.nodes)
  const setViewport = useStore((s) => s.setViewport)
  const scale = useStore((s) => s.viewport.scale)
  const vx = useStore((s) => s.viewport.x)
  const vy = useStore((s) => s.viewport.y)
  const vw = useStore((s) => s.viewport.width)
  const vh = useStore((s) => s.viewport.height)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)

  if (nodes.length === 0 || vw === 0) return null

  // World bounds of the graph.
  const minX = Math.min(...nodes.map((n) => n.x))
  const minY = Math.min(...nodes.map((n) => n.y))
  const maxX = Math.max(...nodes.map((n) => n.x + n.width))
  const maxY = Math.max(...nodes.map((n) => n.y + n.height))
  const graphW = maxX - minX || 1
  const graphH = maxY - minY || 1

  const m = Math.min((MM_W - PAD * 2) / graphW, (MM_H - PAD * 2) / graphH)
  // Centering offset inside the minimap.
  const offX = (MM_W - graphW * m) / 2
  const offY = (MM_H - graphH * m) / 2
  const toMM = (wx: number, wy: number) => ({ x: offX + (wx - minX) * m, y: offY + (wy - minY) * m })

  // Current visible world-rect → minimap coords.
  const viewWorld = { x: -vx / scale, y: -vy / scale, w: vw / scale, h: vh / scale }
  const vTL = toMM(viewWorld.x, viewWorld.y)
  const boxW = viewWorld.w * m
  const boxH = viewWorld.h * m

  const recenterFromEvent = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const mmX = clientX - rect.left
    const mmY = clientY - rect.top
    // Minimap → world.
    const worldX = (mmX - offX) / m + minX
    const worldY = (mmY - offY) / m + minY
    // Center the view on that world point.
    setViewport({ x: vw / 2 - worldX * scale, y: vh / 2 - worldY * scale })
  }

  return (
    <div className="minimap">
      <svg
        ref={svgRef}
        width={MM_W}
        height={MM_H}
        onMouseDown={(e) => {
          dragging.current = true
          recenterFromEvent(e.clientX, e.clientY)
        }}
        onMouseMove={(e) => dragging.current && recenterFromEvent(e.clientX, e.clientY)}
        onMouseUp={() => (dragging.current = false)}
        onMouseLeave={() => (dragging.current = false)}
        style={{ cursor: 'pointer', display: 'block' }}
      >
        {nodes.map((n) => {
          const p = toMM(n.x, n.y)
          const color = n.eval ? STATUS_COLOR[n.eval.status] : '#5b6472'
          return (
            <rect
              key={n.id}
              x={p.x}
              y={p.y}
              width={Math.max(2, n.width * m)}
              height={Math.max(2, n.height * m)}
              rx={1.5}
              fill={color}
              opacity={0.85}
            />
          )
        })}
        <rect
          x={vTL.x}
          y={vTL.y}
          width={boxW}
          height={boxH}
          fill="rgba(110,168,254,0.12)"
          stroke="#6ea8fe"
          strokeWidth={1.5}
          rx={2}
        />
      </svg>
    </div>
  )
}
