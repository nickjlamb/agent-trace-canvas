import dagre from 'dagre'
import type { Trace, PositionedNode } from './types'

export const NODE_W = 190
export const NODE_H = 70

/** Run a left-to-right dagre layout over the trace, returning positioned nodes. */
export function layoutTrace(trace: Trace): PositionedNode[] {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 90, marginx: 40, marginy: 40 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const n of trace.nodes) {
    g.setNode(n.id, { width: NODE_W, height: NODE_H })
  }
  for (const e of trace.edges) {
    g.setEdge(e.from, e.to)
  }

  dagre.layout(g)

  return trace.nodes.map((n) => {
    const { x, y } = g.node(n.id)
    // dagre gives center coords; convert to top-left for Konva.
    return {
      ...n,
      x: x - NODE_W / 2,
      y: y - NODE_H / 2,
      width: NODE_W,
      height: NODE_H,
    }
  })
}

/** Center point of a positioned node (for drawing edges). */
export function nodeCenter(n: PositionedNode) {
  return { x: n.x + n.width / 2, y: n.y + n.height / 2 }
}
