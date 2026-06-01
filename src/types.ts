export type NodeKind = 'model_call' | 'tool_call' | 'retrieval' | 'decision'
export type EvalStatus = 'pass' | 'warn' | 'fail'

export interface EvalResult {
  status: EvalStatus
  score: number // 0..1
  note?: string
}

export interface TraceNode {
  id: string
  kind: NodeKind
  label: string
  input?: string
  output?: string
  eval?: EvalResult
  latencyMs?: number
  tokens?: { in: number; out: number }
}

export interface TraceEdge {
  from: string
  to: string
  /** Optional label, e.g. a branch condition. */
  label?: string
}

export interface Trace {
  runId: string
  task: string
  /** Provenance of the trace data (e.g. which tools produced it). */
  source?: string
  nodes: TraceNode[]
  edges: TraceEdge[]
}

/** Positioned node after layout. */
export interface PositionedNode extends TraceNode {
  x: number
  y: number
  width: number
  height: number
}
