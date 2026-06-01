import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import handler from 'serve-handler'
import { WebSocketServer } from 'ws'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DIST = path.join(ROOT, 'dist')
const PORT = process.env.PORT || 3000

// --- Static file serving (SPA fallback to index.html) ---
const server = http.createServer((req, res) =>
  handler(req, res, {
    public: DIST,
    rewrites: [{ source: '**', destination: '/index.html' }],
  }),
)

// --- WebSocket replay endpoint ---
const wss = new WebSocketServer({ server, path: '/ws' })

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

/** Pacing per step: roughly the real latency, clamped so the replay stays watchable. */
const pace = (node) => Math.min(1400, Math.max(450, node.latencyMs ?? 700))

async function loadTrace() {
  // Prefer the built asset; fall back to /public for local dev before a build.
  for (const p of [path.join(DIST, 'sample-trace.json'), path.join(ROOT, 'public', 'sample-trace.json')]) {
    try {
      return JSON.parse(await readFile(p, 'utf8'))
    } catch {
      /* try next */
    }
  }
  return null
}

wss.on('connection', async (ws) => {
  const trace = await loadTrace()
  const send = (m) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(m))

  if (!trace) {
    send({ type: 'error', message: 'trace not found' })
    ws.close()
    return
  }

  send({ type: 'run_start', runId: trace.runId, task: trace.task, source: trace.source })

  for (const node of trace.nodes) {
    if (ws.readyState !== ws.OPEN) return
    send({ type: 'node', node })
    // Edges arriving into this node connect from already-streamed earlier nodes.
    for (const edge of trace.edges.filter((e) => e.to === node.id)) {
      send({ type: 'edge', edge })
    }
    await delay(pace(node))
  }

  send({ type: 'run_complete' })
})

server.listen(PORT, () => {
  console.log(`Agent Trace Canvas listening on :${PORT} (static + /ws)`)
})
