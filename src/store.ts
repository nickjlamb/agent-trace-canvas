import { create } from 'zustand'
import type { Trace, PositionedNode } from './types'
import { layoutTrace } from './layout'

interface AppState {
  trace: Trace | null
  nodes: PositionedNode[]
  selectedId: string | null
  loadTrace: (trace: Trace) => void
  select: (id: string | null) => void
}

export const useStore = create<AppState>((set) => ({
  trace: null,
  nodes: [],
  selectedId: null,
  loadTrace: (trace) => set({ trace, nodes: layoutTrace(trace), selectedId: null }),
  select: (id) => set({ selectedId: id }),
}))
