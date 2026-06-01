import { useMemo, useState } from 'react'
import { useStore } from '../store'
import type { NodeKind } from '../types'

const KIND_ACCENT: Record<NodeKind, string> = {
  model_call: '#6ea8fe',
  tool_call: '#b692f6',
  retrieval: '#5ed3d3',
  decision: '#e7b85c',
}

export function SearchBox() {
  const nodes = useStore((s) => s.nodes)
  const focusNode = useStore((s) => s.focusNode)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return []
    return nodes.filter((n) => n.label.toLowerCase().includes(t) || n.kind.includes(t)).slice(0, 6)
  }, [q, nodes])

  if (nodes.length === 0) return null

  const pick = (id: string) => {
    focusNode(id)
    setOpen(false)
    setQ('')
  }

  return (
    <div className="search">
      <input
        className="search-input"
        value={q}
        placeholder="Search steps…"
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && matches[0]) pick(matches[0].id)
          if (e.key === 'Escape') {
            setOpen(false)
            setQ('')
          }
        }}
      />
      {open && matches.length > 0 && (
        <ul className="search-results">
          {matches.map((n) => (
            <li key={n.id} onMouseDown={() => pick(n.id)}>
              <span className="search-dot" style={{ background: KIND_ACCENT[n.kind] }} />
              <span className="search-label">{n.label}</span>
              <span className="search-kind">{n.kind.replace('_', ' ')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
