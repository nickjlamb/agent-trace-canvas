import { Arrow, Text } from 'react-konva'
import type { PositionedNode } from '../types'
import { nodeCenter } from '../layout'

/**
 * Draw an arrow from the right edge of `from` to the left edge of `to`
 * (matches the left-to-right dagre layout), with a gentle horizontal bias.
 */
export function TraceEdge({
  from,
  to,
  label,
}: {
  from: PositionedNode
  to: PositionedNode
  label?: string
}) {
  const start = { x: from.x + from.width, y: nodeCenter(from).y }
  const end = { x: to.x, y: nodeCenter(to).y }
  const midX = (start.x + end.x) / 2

  // Cubic-ish elbow: out the right, across, into the left.
  const points = [start.x, start.y, midX, start.y, midX, end.y, end.x, end.y]

  return (
    <>
      <Arrow
        points={points}
        stroke="#3a3f4b"
        fill="#3a3f4b"
        strokeWidth={2}
        pointerLength={8}
        pointerWidth={8}
        tension={0.2}
        lineJoin="round"
      />
      {label && (
        <Text
          text={label}
          x={midX - 24}
          y={(start.y + end.y) / 2 - 16}
          width={48}
          align="center"
          fontSize={11}
          fill="#8a90a0"
        />
      )}
    </>
  )
}
