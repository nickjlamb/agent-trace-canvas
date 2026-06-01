import { useState } from 'react'

const EXAMPLES = [
  'Semaglutide & CV events?',
  'Donanemab in early Alzheimer’s?',
  'SGLT2 inhibitors & heart failure?',
]

export function LiveBar({
  streaming,
  notice,
  onRun,
}: {
  streaming: boolean
  notice: string | null
  onRun: (question: string) => void
}) {
  const [q, setQ] = useState('')

  const run = () => {
    const question = q.trim()
    if (question && !streaming) onRun(question)
  }

  return (
    <div className="livebar">
      <div className="livebar-row">
        <input
          className="livebar-input"
          value={q}
          maxLength={200}
          placeholder="Ask a biomedical question — runs a real agent…"
          disabled={streaming}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <button className="livebar-run" onClick={run} disabled={streaming || !q.trim()}>
          {streaming ? '● running…' : '⚡ Run live'}
        </button>
      </div>
      <div className="livebar-chips">
        {EXAMPLES.map((ex) => (
          <button key={ex} className="livebar-chip" disabled={streaming} onClick={() => onRun(ex)}>
            {ex}
          </button>
        ))}
      </div>
      {notice && <div className="livebar-notice">{notice}</div>}
    </div>
  )
}
