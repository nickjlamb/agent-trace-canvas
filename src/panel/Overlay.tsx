import { useStore } from '../store'
import type { NodeKind } from '../types'

const KIND_ACCENT: Record<NodeKind, string> = {
  model_call: '#6ea8fe',
  tool_call: '#b692f6',
  retrieval: '#5ed3d3',
  decision: '#e7b85c',
}

const KIND_LABEL: Record<NodeKind, string> = {
  model_call: 'model call',
  tool_call: 'tool call',
  retrieval: 'retrieval',
  decision: 'decision',
}

/** Aggregate run stats (top-left) + legend (bottom-left), overlaid on the canvas. */
export function Overlay() {
  const nodes = useStore((s) => s.nodes)
  if (nodes.length === 0) return null

  const total = nodes.length
  const passes = nodes.filter((n) => n.eval?.status === 'pass').length
  const fails = nodes.filter((n) => n.eval?.status === 'fail').length
  const passRate = Math.round((passes / total) * 100)
  const totalTokens = nodes.reduce(
    (s, n) => s + (n.tokens ? n.tokens.in + n.tokens.out : 0),
    0,
  )
  const totalLatency = nodes.reduce((s, n) => s + (n.latencyMs ?? 0), 0)

  return (
    <>
      <div className="stats-bar">
        <Stat label="steps" value={String(total)} />
        <Stat label="pass rate" value={`${passRate}%`} accent={fails ? 'var(--warn)' : 'var(--pass)'} />
        <Stat label="failed" value={String(fails)} accent={fails ? 'var(--fail)' : undefined} />
        <Stat label="tokens" value={totalTokens.toLocaleString()} />
        <Stat label="latency" value={`${(totalLatency / 1000).toFixed(1)}s`} />
      </div>

      <div className="legend">
        <div className="legend-group">
          {(Object.keys(KIND_LABEL) as NodeKind[]).map((k) => (
            <span key={k} className="legend-item">
              <span className="legend-swatch" style={{ background: KIND_ACCENT[k] }} />
              {KIND_LABEL[k]}
            </span>
          ))}
        </div>
        <div className="legend-group">
          <span className="legend-item">
            <span className="legend-ring" style={{ borderColor: 'var(--pass)' }} />
            pass
          </span>
          <span className="legend-item">
            <span className="legend-ring" style={{ borderColor: 'var(--warn)' }} />
            warn
          </span>
          <span className="legend-item">
            <span className="legend-ring" style={{ borderColor: 'var(--fail)' }} />
            fail
          </span>
        </div>
      </div>
    </>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="stat">
      <span className="stat-value" style={accent ? { color: accent } : undefined}>
        {value}
      </span>
      <span className="stat-label">{label}</span>
    </div>
  )
}
