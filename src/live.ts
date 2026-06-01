import type { TraceNode, TraceEdge } from './types'

interface ReplayHandlers {
  onStart: (meta: { runId: string; task: string; source?: string }) => void
  onNode: (node: TraceNode) => void
  onEdge: (edge: TraceEdge) => void
  onComplete: () => void
  onError?: (message: string) => void
}

/** Open a WebSocket to the replay endpoint and dispatch streamed steps. Returns a closer. */
export function startReplay(handlers: ReplayHandlers): () => void {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const url = `${proto}://${window.location.host}/ws`

  let ws: WebSocket
  try {
    ws = new WebSocket(url)
  } catch {
    handlers.onError?.('Could not open WebSocket')
    return () => {}
  }

  ws.onmessage = (ev) => {
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
      case 'error':
        handlers.onError?.(String(msg.message ?? 'stream error'))
        ws.close()
        break
    }
  }

  ws.onerror = () => handlers.onError?.('WebSocket connection failed')

  return () => ws.close()
}
