import { useEffect, useState } from 'react'
import type { Trace } from './types'
import { SAVED_TRACES } from './traces'
import { summarise, comparePapers, type RunSummary } from './diff'

const STATUS_LABEL = { pass: 'PASS', warn: 'WARN', fail: 'FAIL' } as const

function EvalBadge({ s }: { s: RunSummary }) {
  if (!s.finalEval) return <span className="cmp-badge">no eval</span>
  return (
    <span className={`cmp-badge ${s.finalEval.status}`}>
      {STATUS_LABEL[s.finalEval.status]} {s.finalEval.score.toFixed(2)}
    </span>
  )
}

function Column({ tag, s }: { tag: 'A' | 'B'; s: RunSummary }) {
  return (
    <div className="cmp-col">
      <div className="cmp-col-head">
        <span className="cmp-tag">{tag}</span>
        <strong>{s.model}</strong>
        <EvalBadge s={s} />
      </div>
      <div className="cmp-stats">
        {s.steps} steps · {s.passed}/{s.steps} passed{s.tokens ? ` · ${s.tokens.toLocaleString()} tokens` : ''}
      </div>
      {s.searches.map((q) => (
        <div className="cmp-search" key={q}>
          PubMed search: {q}
        </div>
      ))}
      {s.finalEval?.note && <p className={`cmp-note ${s.finalEval.status}`}>{s.finalEval.note}</p>}
    </div>
  )
}

export function CompareView({ ids }: { ids: [string, string] }) {
  const embed = new URLSearchParams(window.location.search).get('embed') === '1'
  const [traces, setTraces] = useState<[Trace, Trace] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const unknown = ids.some((id) => !SAVED_TRACES[id])

  useEffect(() => {
    if (unknown) return
    const paths = ids.map((id) => SAVED_TRACES[id])
    Promise.all(paths.map((p) => fetch(p).then((r) => r.json())))
      .then(([a, b]) => setTraces([a, b]))
      .catch(() => setError('Could not load the runs to compare.'))
  }, [ids, unknown])

  if (unknown) return <div className="cmp-shell cmp-msg">Unknown run in the comparison link.</div>
  if (error) return <div className="cmp-shell cmp-msg">{error}</div>
  if (!traces) return <div className="cmp-shell cmp-msg">Loading the comparison…</div>

  const [a, b] = traces.map(summarise) as [RunSummary, RunSummary]
  const papers = comparePapers(a, b)
  const onlyB = papers.filter((p) => p.side === 'b')
  const onlyA = papers.filter((p) => p.side === 'a')

  return (
    <div className={embed ? 'cmp-shell embed' : 'cmp-shell'}>
      {!embed && (
        <header className="app-header">
          <div>
            <h1>Agent Trace Canvas · compare two runs</h1>
            <p>{traces[0].task}</p>
          </div>
        </header>
      )}
      <section className="cmp-strip">
        <div className="cmp-cols">
          <Column tag="A" s={a} />
          <Column tag="B" s={b} />
        </div>
        <div className="cmp-papers">
          <span className="cmp-label">Papers fetched</span>
          {papers.map((p) => (
            <a
              key={p.pmid}
              className={`cmp-paper ${p.side}`}
              href={`https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`}
              target="_blank"
              rel="noopener"
              title={p.title || undefined}
            >
              <span className="cmp-side">{p.side === 'both' ? 'A + B' : `only ${p.side.toUpperCase()}`}</span>
              PMID {p.pmid}
              {p.title ? ` · ${p.title.length > 70 ? p.title.slice(0, 69) + '…' : p.title}` : ''}
            </a>
          ))}
        </div>
        <p className="cmp-caveat">
          {onlyA.length + onlyB.length === 0
            ? 'Both runs fetched the same papers. '
            : `${onlyB.length ? `B fetched ${onlyB.length} paper${onlyB.length > 1 ? 's' : ''} A did not` : ''}${
                onlyA.length && onlyB.length ? '; ' : ''
              }${onlyA.length ? `A fetched ${onlyA.length} B did not` : ''}. `}
          One run each, so this shows a difference, not a measured effect. Each run was graded by the same
          faithfulness check, using that run&rsquo;s own model.
        </p>
      </section>
      <section className="cmp-panes">
        {ids.map((id, i) => (
          <div className="cmp-pane" key={id}>
            <span className="cmp-pane-tag">{i === 0 ? 'A' : 'B'}</span>
            <iframe src={`/?embed=1&view=${encodeURIComponent(id)}`} title={`Run ${i === 0 ? 'A' : 'B'}`} />
          </div>
        ))}
      </section>
    </div>
  )
}
