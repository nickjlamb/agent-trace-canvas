import { useEffect, useRef, useState } from 'react'
import { CanvasStage } from './canvas/CanvasStage'
import { DetailPanel } from './panel/DetailPanel'
import { Overlay } from './panel/Overlay'
import { MiniMap } from './panel/MiniMap'
import { CameraToggle } from './panel/CameraToggle'
import { LiveBar } from './panel/LiveBar'
import { useStore } from './store'
import { startReplay, startLiveRun } from './live'
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
  const [liveNotice, setLiveNotice] = useState<string | null>(null)
  const [liveEnabled, setLiveEnabled] = useState(false)
  const closerRef = useRef<(() => void) | null>(null)
  // Latest action handlers, so the postMessage listener never goes stale.
  const actionsRef = useRef<{ liveRun: (q: string) => void; replay: () => void }>({
    liveRun: () => {},
    replay: () => {},
  })

  // Embed mode (?embed=1): hide the title bar so the app sits cleanly in an iframe.
  const embed = new URLSearchParams(window.location.search).get('embed') === '1'

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

  // Only show the live UI when the server reports live mode is enabled (API key set).
  useEffect(() => {
    fetch('/api/live-status')
      .then((r) => r.json())
      .then((s) => setLiveEnabled(!!s.enabled))
      .catch(() => setLiveEnabled(false))
  }, [])

  // In embed mode the host page owns the controls and drives the canvas via postMessage.
  useEffect(() => {
    if (!embed) return
    const onMessage = (e: MessageEvent) => {
      const d = e.data
      if (!d || d.source !== 'atc') return
      if (d.type === 'run' && typeof d.question === 'string') actionsRef.current.liveRun(d.question)
      else if (d.type === 'replay') actionsRef.current.replay()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [embed])

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

  const liveRun = (question: string) => {
    if (streaming) return
    setLiveNotice(null)
    closerRef.current?.()
    closerRef.current = startLiveRun(question, {
      onStart: (meta) => startStream(meta),
      onNode: (node) => addNode(node),
      onEdge: (edge) => addEdge(edge),
      onComplete: () => endStream(),
      onDenied: (reason) => {
        setLiveNotice(reason)
        endStream()
        if (fullTrace) loadTrace(fullTrace)
      },
      onError: (msg) => {
        setLiveNotice('Live run failed — showing the saved trace instead.')
        console.warn('Live run failed:', msg)
        endStream()
        if (fullTrace) loadTrace(fullTrace)
      },
    })
  }

  // Keep the postMessage handlers pointing at the current closures.
  actionsRef.current = { liveRun, replay }

  const replayLabel = streaming ? '● streaming…' : '▶ Replay live'

  return (
    <div className={embed ? 'app-shell embed' : 'app-shell'}>
      {!embed && (
        <header className="app-header">
          <div>
            <h1>Agent Trace Canvas</h1>
            <p>{trace ? trace.task : 'Loading trace…'}</p>
          </div>
          <button className="replay-btn" onClick={replay} disabled={streaming}>
            {replayLabel}
          </button>
        </header>
      )}
      <main className="app-main">
        <CanvasStage />
        <Overlay />
        <CameraToggle />
        <MiniMap />
        {/* Standalone app keeps in-canvas controls; embed is driven by the host page. */}
        {!embed && liveEnabled && <LiveBar streaming={streaming} notice={liveNotice} onRun={liveRun} />}
        <DetailPanel />
      </main>
    </div>
  )
}

export default App
