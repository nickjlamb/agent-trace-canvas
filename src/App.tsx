import { useEffect, useRef, useState } from 'react'
import { CanvasStage } from './canvas/CanvasStage'
import { DetailPanel } from './panel/DetailPanel'
import { Overlay } from './panel/Overlay'
import { useStore } from './store'
import { startReplay } from './live'
import type { Trace } from './types'

function App() {
  const loadTrace = useStore((s) => s.loadTrace)
  const select = useStore((s) => s.select)
  const startStream = useStore((s) => s.startStream)
  const addNode = useStore((s) => s.addNode)
  const addEdge = useStore((s) => s.addEdge)
  const endStream = useStore((s) => s.endStream)
  const streaming = useStore((s) => s.streaming)
  const trace = useStore((s) => s.trace)

  const [fullTrace, setFullTrace] = useState<Trace | null>(null)
  const closerRef = useRef<(() => void) | null>(null)

  // Load the full trace up front (instant first paint; also our replay fallback).
  useEffect(() => {
    fetch('/sample-trace.json')
      .then((r) => r.json())
      .then((t: Trace) => {
        setFullTrace(t)
        loadTrace(t)
        const wanted = new URLSearchParams(window.location.search).get('node')
        if (wanted && t.nodes.some((n) => n.id === wanted)) select(wanted)
      })
      .catch((err) => console.error('Failed to load trace', err))
  }, [loadTrace, select])

  useEffect(() => () => closerRef.current?.(), [])

  // Optional ?replay=1 deep-link auto-starts the live replay on load.
  const didAutoReplay = useRef(false)
  useEffect(() => {
    if (!fullTrace || didAutoReplay.current) return
    if (new URLSearchParams(window.location.search).get('replay') === '1') {
      didAutoReplay.current = true
      replay()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullTrace])

  const replay = () => {
    if (streaming) return
    closerRef.current?.()
    closerRef.current = startReplay({
      onStart: (meta) => startStream(meta),
      onNode: (node) => addNode(node),
      onEdge: (edge) => addEdge(edge),
      onComplete: () => endStream(),
      onError: (msg) => {
        console.warn('Replay failed:', msg)
        endStream()
        if (fullTrace) loadTrace(fullTrace) // fall back to the static view
      },
    })
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Agent Trace Canvas</h1>
          <p>{trace ? trace.task : 'Loading trace…'}</p>
        </div>
        <button className="replay-btn" onClick={replay} disabled={streaming}>
          {streaming ? '● streaming…' : '▶ Replay live'}
        </button>
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
