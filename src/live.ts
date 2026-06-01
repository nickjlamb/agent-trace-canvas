import type { TraceNode, TraceEdge } from './types'

interface ReplayHandlers {
  onStart: (meta: { runId: string; task: string; source?: string }) => void
  onNode: (node: TraceNode) => void
  onEdge: (edge: TraceEdge) => void
  onComplete: () => void
  onError?: (message: string) => void
  onDenied?: (reason: string) => void
}

function wsUrl(pathName: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}${pathName}`
}

/** Connect to the live-agent endpoint, send the question, and dispatch streamed steps. */
export function startLiveRun(question: string, handlers: ReplayHandlers): () => void {
  let ws: WebSocket
  try {
    ws = new WebSocket(wsUrl('/ws/live'))
  } catch {
    handlers.onError?.('Could not open WebSocket')
    return () => {}
  }

  ws.onopen = () => ws.send(JSON.stringify({ question }))
  ws.onmessage = (ev) => dispatch(ev, ws, handlers)
  ws.onerror = () => handlers.onError?.('WebSocket connection failed')

  return () => ws.close()
}

function dispatch(ev: MessageEvent, ws: WebSocket, handlers: ReplayHandlers) {
  let msg: { type: string; [k: string]: unknown }
  try {
    msg = JSON.parse(ev.data)
  } catch {
    return
  }
  switch (msg.type) {
    case 'run_start':
      handlers.onStart(msg as unknown as { runId: string; task: string; source?: string })
      break
    case 'node':
      handlers.onNode(msg.node as TraceNode)
      break
    case 'edge':
      handlers.onEdge(msg.edge as TraceEdge)
      break
    case 'run_complete':
      handlers.onComplete()
      ws.close()
      break
    case 'denied':
      handlers.onDenied?.(String(msg.reason ?? 'Live mode unavailable'))
      ws.close()
      break
    case 'error':
      handlers.onError?.(String(msg.message ?? 'stream error'))
      ws.close()
      break
  }
}

/** Open a WebSocket to the replay endpoint and dispatch streamed steps. Returns a closer. */
export function startReplay(handlers: ReplayHandlers): () => void {
  let ws: WebSocket
  try {
    ws = new WebSocket(wsUrl('/ws'))
  } catch {
    handlers.onError?.('Could not open WebSocket')
    return () => {}
  }
  ws.onmessage = (ev) => dispatch(ev, ws, handlers)
  ws.onerror = () => handlers.onError?.('WebSocket connection failed')
  return () => ws.close()
}
