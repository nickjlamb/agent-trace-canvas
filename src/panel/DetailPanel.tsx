import { useStore } from '../store'
import type { EvalStatus } from '../types'

const STATUS_COLOR: Record<EvalStatus, string> = {
  pass: 'var(--pass)',
  warn: 'var(--warn)',
  fail: 'var(--fail)',
}

export function DetailPanel() {
  const selectedId = useStore((s) => s.selectedId)
  const activeId = useStore((s) => s.activeId)
  const streaming = useStore((s) => s.streaming)
  const nodes = useStore((s) => s.nodes)
  const select = useStore((s) => s.select)

  // While running, follow the active step; otherwise show the user's selection.
  const shownId = selectedId ?? activeId
  const node = nodes.find((n) => n.id === shownId)
  if (!node) return null

  const status = node.eval?.status

  return (
    <aside className="detail-panel">
      <div className="detail-head">
        <div>
          <div className="detail-kind">
            {streaming && <span className="detail-live">● live</span>}
            {node.kind.replace('_', ' ')}
          </div>
          <h2 className="detail-title">{node.label}</h2>
        </div>
        {!streaming && (
          <button className="detail-close" onClick={() => select(null)} aria-label="Close">
            ✕
          </button>
        )}
      </div>

      {node.eval && (
        <div className="eval-row" style={{ borderColor: STATUS_COLOR[status!] }}>
          <span className="eval-badge" style={{ background: STATUS_COLOR[status!] }}>
            {status}
          </span>
          <span className="eval-score">{node.eval.score.toFixed(2)}</span>
          {node.eval.note && <span className="eval-note">{node.eval.note}</span>}
        </div>
      )}

      <div className="metrics">
        {node.latencyMs != null && (
          <div className="metric">
            <span className="metric-label">latency</span>
            <span className="metric-value">{node.latencyMs} ms</span>
          </div>
        )}
        {node.tokens && (
          <div className="metric">
            <span className="metric-label">tokens</span>
            <span className="metric-value">
              {node.tokens.in} in · {node.tokens.out} out
            </span>
          </div>
        )}
      </div>

      {node.input && (
        <section className="field">
          <h3>Input</h3>
          <pre>{node.input}</pre>
        </section>
      )}
      {node.output && (
        <section className="field">
          <h3>Output</h3>
          <pre>{node.output}</pre>
        </section>
      )}
    </aside>
  )
}
