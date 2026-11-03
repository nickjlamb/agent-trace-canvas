import type { Trace, TraceNode, EvalResult } from './types'

/** Deterministic summary of one run, for side-by-side comparison. No model involved. */
export interface Paper {
  pmid: string
  title: string | null
}
export interface RunSummary {
  model: string
  steps: number
  tokens: number
  passed: number
  searches: string[]
  papers: Paper[]
  finalEval: (EvalResult & { label: string }) | null
}

const isFetch = (n: TraceNode) => n.kind === 'retrieval' || n.kind === 'tool_call'

function parseInput(n: TraceNode): Record<string, unknown> | null {
  try {
    const o = JSON.parse(n.input || '')
    return o && typeof o === 'object' ? (o as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function pmidOf(n: TraceNode): string | null {
  const o = parseInput(n)
  if (o && typeof o.pmid === 'string') return o.pmid
  const m = /pmid=(\d{6,9})/i.exec(n.input || '')
  return m ? m[1] : null
}

function titleOf(n: TraceNode): string | null {
  const m = /"title":\s*"([^"]+)"/.exec(n.output || '')
  return m ? m[1] : null
}

export function modelOf(trace: Trace): string {
  const m = /Claude [A-Z][a-z]+ \d+(?:\.\d+)?/.exec(trace.source || '')
  return m ? m[0] : 'Unknown model'
}

export function summarise(trace: Trace): RunSummary {
  const searches: string[] = []
  const papers: Paper[] = []
  for (const n of trace.nodes) {
    if (!isFetch(n)) continue
    const o = parseInput(n)
    if (n.label.startsWith('search_') && o && typeof o.query === 'string') searches.push(o.query)
    const pmid = pmidOf(n)
    if (pmid && !papers.some((p) => p.pmid === pmid)) papers.push({ pmid, title: titleOf(n) })
  }
  const decisions = trace.nodes.filter((n) => n.kind === 'decision' && n.eval)
  const last = decisions[decisions.length - 1]
  return {
    model: modelOf(trace),
    steps: trace.nodes.length,
    tokens: trace.nodes.reduce((s, n) => s + (n.tokens ? n.tokens.in + n.tokens.out : 0), 0),
    passed: trace.nodes.filter((n) => n.eval?.status === 'pass').length,
    searches,
    papers,
    finalEval: last?.eval ? { ...last.eval, label: last.label } : null,
  }
}

export type PaperSide = 'both' | 'a' | 'b'

/** Which side(s) fetched each paper, in first-seen order. */
export function comparePapers(a: RunSummary, b: RunSummary): (Paper & { side: PaperSide })[] {
  const out: (Paper & { side: PaperSide })[] = []
  for (const p of a.papers) out.push({ ...p, side: b.papers.some((q) => q.pmid === p.pmid) ? 'both' : 'a' })
  for (const p of b.papers) if (!a.papers.some((q) => q.pmid === p.pmid)) out.push({ ...p, side: 'b' })
  return out
}
