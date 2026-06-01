import { useEffect } from 'react'
import { CanvasStage } from './canvas/CanvasStage'
import { useStore } from './store'
import type { Trace } from './types'

function App() {
  const loadTrace = useStore((s) => s.loadTrace)
  const trace = useStore((s) => s.trace)

  useEffect(() => {
    fetch('/sample-trace.json')
      .then((r) => r.json())
      .then((t: Trace) => loadTrace(t))
      .catch((err) => console.error('Failed to load trace', err))
  }, [loadTrace])

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Agent Trace Canvas</h1>
        <p>{trace ? trace.task : 'Loading trace…'}</p>
      </header>
      <main className="app-main">
        <CanvasStage />
      </main>
    </div>
  )
}

export default App
