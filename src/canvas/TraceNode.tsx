import { Group, Rect, Text } from 'react-konva'
import type { PositionedNode, NodeKind, EvalStatus } from '../types'

const STATUS_COLOR: Record<EvalStatus, string> = {
  pass: '#3ecf8e',
  warn: '#e7b85c',
  fail: '#f06d6d',
}

const KIND_LABEL: Record<NodeKind, string> = {
  model_call: 'model',
  tool_call: 'tool',
  retrieval: 'retrieval',
  decision: 'decision',
}

const KIND_ACCENT: Record<NodeKind, string> = {
  model_call: '#6ea8fe',
  tool_call: '#b692f6',
  retrieval: '#5ed3d3',
  decision: '#e7b85c',
}

export function TraceNode({
  node,
  selected,
  active,
  onSelect,
}: {
  node: PositionedNode
  selected: boolean
  active?: boolean
  onSelect: (id: string) => void
}) {
  const status = node.eval?.status
  const border = status ? STATUS_COLOR[status] : '#3a3f4b'
  const accent = KIND_ACCENT[node.kind]

  return (
    <Group
      x={node.x}
      y={node.y}
      onClick={() => onSelect(node.id)}
      onTap={() => onSelect(node.id)}
      onMouseEnter={(e) => {
        const c = e.target.getStage()?.container()
        if (c) c.style.cursor = 'pointer'
      }}
      onMouseLeave={(e) => {
        const c = e.target.getStage()?.container()
        if (c) c.style.cursor = 'default'
      }}
    >
      <Rect
        width={node.width}
        height={node.height}
        cornerRadius={10}
        fill="#161a22"
        stroke={selected ? '#f4f6fa' : active ? accent : border}
        strokeWidth={selected || active ? 3 : 2}
        shadowColor={active ? accent : '#000'}
        shadowBlur={active ? 22 : selected ? 14 : 8}
        shadowOpacity={active ? 0.9 : 0.45}
      />
      {/* kind accent stripe */}
      <Rect width={5} height={node.height} cornerRadius={[10, 0, 0, 10]} fill={KIND_ACCENT[node.kind]} />
      <Text text={node.label} x={16} y={14} width={node.width - 28} fontSize={15} fontStyle="600" fill="#f4f6fa" ellipsis wrap="none" />
      <Text text={KIND_LABEL[node.kind]} x={16} y={38} fontSize={12} fill="#8a90a0" />
      {node.eval && (
        <Text
          text={node.eval.score.toFixed(2)}
          x={node.width - 52}
          y={38}
          width={36}
          align="right"
          fontSize={12}
          fontStyle="600"
          fill={border}
        />
      )}
    </Group>
  )
}
