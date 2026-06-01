import { create } from 'zustand'
import type { Trace, TraceNode, TraceEdge, PositionedNode } from './types'
import { layoutTrace } from './layout'

interface AppState {
  trace: Trace | null
  nodes: PositionedNode[]
  selectedId: string | null
  streaming: boolean
  activeId: string | null
  loadTrace: (trace: Trace) => void
  select: (id: string | null) => void
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

  loadTrace: (trace) =>
    set({ trace, nodes: layoutTrace(trace), selectedId: null, streaming: false, activeId: null }),

  select: (id) => set({ selectedId: id }),

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

  endStream: () => set({ streaming: false, activeId: null }),
}))
