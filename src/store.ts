import { create } from 'zustand'
import type { Trace, TraceNode, TraceEdge, PositionedNode } from './types'
import { layoutTrace } from './layout'

export const MIN_SCALE = 0.25
export const MAX_SCALE = 4

interface Viewport {
  scale: number
  x: number
  y: number
  width: number
  height: number
}

interface AppState {
  trace: Trace | null
  nodes: PositionedNode[]
  selectedId: string | null
  streaming: boolean
  activeId: string | null
  viewport: Viewport
  loadTrace: (trace: Trace) => void
  select: (id: string | null) => void
  setViewport: (v: Partial<Viewport>) => void
  focusNode: (id: string) => void
  // Streaming (WebSocket replay)
  startStream: (meta: { runId: string; task: string; source?: string }) => void
  addNode: (node: TraceNode) => void
  addEdge: (edge: TraceEdge) => void
  endStream: () => void
}

export const useStore = create<AppState>((set) => ({
  trace: null,
  nodes: [],
  selectedId: null,
  streaming: false,
  activeId: null,
  viewport: { scale: 1, x: 0, y: 0, width: 0, height: 0 },

  loadTrace: (trace) =>
    set({ trace, nodes: layoutTrace(trace), selectedId: null, streaming: false, activeId: null }),

  select: (id) => set({ selectedId: id }),

  setViewport: (v) => set((s) => ({ viewport: { ...s.viewport, ...v } })),

  focusNode: (id) =>
    set((s) => {
      const n = s.nodes.find((nn) => nn.id === id)
      if (!n) return s
      const vp = s.viewport
      const targetScale = Math.min(MAX_SCALE, Math.max(vp.scale, 1))
      const cx = n.x + n.width / 2
      const cy = n.y + n.height / 2
      return {
        selectedId: id,
        viewport: {
          ...vp,
          scale: targetScale,
          x: vp.width / 2 - cx * targetScale,
          y: vp.height / 2 - cy * targetScale,
        },
      }
    }),

  startStream: (meta) =>
    set({
      trace: { runId: meta.runId, task: meta.task, source: meta.source, nodes: [], edges: [] },
      nodes: [],
      selectedId: null,
      streaming: true,
      activeId: null,
    }),

  addNode: (node) =>
    set((s) => {
      if (!s.trace) return s
      const trace = { ...s.trace, nodes: [...s.trace.nodes, node] }
      return { trace, nodes: layoutTrace(trace), activeId: node.id }
    }),

  addEdge: (edge) =>
    set((s) => {
      if (!s.trace) return s
      const trace = { ...s.trace, edges: [...s.trace.edges, edge] }
      return { trace, nodes: layoutTrace(trace) }
    }),

  // Leave the final step's card open so the answer is readable when the run ends.
  endStream: () =>
    set((s) => ({
      streaming: false,
      activeId: null,
      selectedId: s.nodes.length ? s.nodes[s.nodes.length - 1].id : s.selectedId,
    })),
}))
