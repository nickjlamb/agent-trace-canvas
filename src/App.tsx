import { useEffect } from 'react'
import { CanvasStage } from './canvas/CanvasStage'
import { DetailPanel } from './panel/DetailPanel'
import { Overlay } from './panel/Overlay'
import { useStore } from './store'
import type { Trace } from './types'

function App() {
  const loadTrace = useStore((s) => s.loadTrace)
  const select = useStore((s) => s.select)
  const trace = useStore((s) => s.trace)

  useEffect(() => {
    fetch('/sample-trace.json')
      .then((r) => r.json())
      .then((t: Trace) => {
        loadTrace(t)
        // Deep-link: ?node=<id> opens that step's inspector (shareable links).
        const wanted = new URLSearchParams(window.location.search).get('node')
        if (wanted && t.nodes.some((n) => n.id === wanted)) select(wanted)
      })
      .catch((err) => console.error('Failed to load trace', err))
  }, [loadTrace, select])

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Agent Trace Canvas</h1>
        <p>{trace ? trace.task : 'Loading trace…'}</p>
      </header>
      <main className="app-main">
        <CanvasStage />
        <Overlay />
        <DetailPanel />
      </main>
    </div>
  )
}

export default App
