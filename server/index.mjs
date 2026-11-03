import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import handler from 'serve-handler'
import { WebSocketServer } from 'ws'
import Anthropic from '@anthropic-ai/sdk'
import { runLiveAgent } from './live-agent.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DIST = path.join(ROOT, 'dist')
const PORT = process.env.PORT || 3000

// --- Live-mode config (all env-tunable). Live mode is OFF unless a key is set. ---
// Pinned model for live runs; override with LIVE_MODEL without a code change.
const LIVE_MODEL = process.env.LIVE_MODEL || 'claude-sonnet-5-5'
// 'claude-sonnet-5-5' -> 'Claude Sonnet 5.5' for the run's provenance line.
const LIVE_MODEL_NAME = LIVE_MODEL.replace(/^claude-/, '')
  .replace(/-(\d+)-(\d+)(-\d{8})?$/, ' $1.$2')
  .replace(/(^|-)(\w)/g, (_, sep, c) => (sep ? ' ' : '') + c.toUpperCase())
  .replace(/^/, 'Claude ')
const HAS_KEY = !!process.env.ANTHROPIC_API_KEY
const DAILY_CAP = Number(process.env.LIVE_DAILY_CAP || 60)
const IP_HOURLY = Number(process.env.LIVE_IP_HOURLY || 3)
const CONCURRENCY = Number(process.env.LIVE_CONCURRENCY || 2)
const MAX_STEPS = Number(process.env.LIVE_MAX_STEPS || 8)
const anthropic = HAS_KEY ? new Anthropic() : null

// --- Static file serving (SPA fallback to index.html) ---
const server = http.createServer((req, res) => {
  const runMatch = /^\/api\/run\/(live_[a-z0-9]{16})$/.exec((req.url || '').split('?')[0])
  if (runMatch) {
    const saved = getSavedRun(runMatch[1])
    res.writeHead(saved ? 200 : 404, { 'content-type': 'application/json', 'cache-control': 'no-store' })
    res.end(JSON.stringify(saved || { error: 'This live run has expired or never existed.' }))
    return
  }
  if (req.url === '/api/live-status') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ enabled: HAS_KEY, model: LIVE_MODEL, dailyCap: DAILY_CAP }))
    return
  }
  // Caching: hashed build assets never change, so cache them for a year; everything else
  // (index.html and the SPA fallback) must be revalidated, or a browser that cached an old
  // index.html keeps requesting asset hashes that no longer exist after a deploy.
  const pathname = (req.url || '/').split('?')[0]
  if (pathname.startsWith('/assets/')) {
    // A missing hashed asset is a real 404, never the SPA's index.html served as JavaScript.
    if (!existsSync(path.join(DIST, decodeURIComponent(pathname)))) {
      res.writeHead(404, { 'content-type': 'text/plain', 'cache-control': 'no-store' })
      res.end('Not found')
      return
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  } else {
    res.setHeader('Cache-Control', 'no-cache')
  }
  handler(req, res, {
    public: DIST,
    rewrites: [{ source: '**', destination: '/index.html' }],
  })
})

// --- WebSocket endpoints: /ws (replay) and /ws/live (real agent) ---
const wssReplay = new WebSocketServer({ noServer: true })
const wssLive = new WebSocketServer({ noServer: true })

server.on('upgrade', (req, socket, head) => {
  let pathname = '/'
  try {
    pathname = new URL(req.url, 'http://localhost').pathname
  } catch {
    /* keep default */
  }
  if (pathname === '/ws') {
    wssReplay.handleUpgrade(req, socket, head, (ws) => wssReplay.emit('connection', ws, req))
  } else if (pathname === '/ws/live') {
    wssLive.handleUpgrade(req, socket, head, (ws) => wssLive.emit('connection', ws, req))
  } else {
    socket.destroy()
  }
})

const send = (ws, m) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(m))
const delay = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------------- Replay (canned trace) ----------------
const pace = (node) => Math.min(1400, Math.max(450, node.latencyMs ?? 700))

// Saved runs available for replay. Lecanemab is the default (and the app's static fallback).
const TRACES = {
  lecanemab: 'sample-trace.json',
  semaglutide: 'traces/semaglutide.json',
  'tranexamic-acid': 'traces/tranexamic-acid.json',
}

async function loadTrace(id = 'lecanemab') {
  const file = TRACES[id] || TRACES.lecanemab
  for (const p of [path.join(DIST, file), path.join(ROOT, 'public', file)]) {
    try {
      return JSON.parse(await readFile(p, 'utf8'))
    } catch {
      /* try next */
    }
  }
  return null
}

wssReplay.on('connection', async (ws, req) => {
  let id = 'lecanemab'
  try {
    id = new URL(req.url, 'http://localhost').searchParams.get('trace') || id
  } catch {
    /* keep default */
  }
  const trace = await loadTrace(id)
  if (!trace) {
    send(ws, { type: 'error', message: 'trace not found' })
    return ws.close()
  }
  send(ws, { type: 'run_start', runId: trace.runId, task: trace.task, source: trace.source })
  for (const node of trace.nodes) {
    if (ws.readyState !== ws.OPEN) return
    send(ws, { type: 'node', node })
    for (const edge of trace.edges.filter((e) => e.to === node.id)) send(ws, { type: 'edge', edge })
    await delay(pace(node))
  }
  send(ws, { type: 'run_complete' })
})

// ---------------- Saved live runs (so "full screen" can reopen one) ----------------
// Completed live runs are kept in memory for a while under an unguessable id; they are lost on
// redeploy, which is fine for a demo.
const SAVED_RUN_TTL_MS = Number(process.env.LIVE_SAVED_RUN_TTL_MS || 2 * 60 * 60 * 1000)
const MAX_SAVED_RUNS = Number(process.env.LIVE_MAX_SAVED_RUNS || 200)
const savedRuns = new Map() // runId -> { trace, at }

function pruneSavedRuns() {
  const now = Date.now()
  for (const [id, r] of savedRuns) if (now - r.at > SAVED_RUN_TTL_MS) savedRuns.delete(id)
  while (savedRuns.size > MAX_SAVED_RUNS) savedRuns.delete(savedRuns.keys().next().value)
}
function saveRun(trace) {
  savedRuns.set(trace.runId, { trace, at: Date.now() })
  pruneSavedRuns()
}
function getSavedRun(id) {
  pruneSavedRuns()
  return savedRuns.get(id)?.trace || null
}

// ---------------- Live (real agent, rate-limited) ----------------
let dayKey = new Date().toISOString().slice(0, 10)
let dayCount = 0
let active = 0
const ipHits = new Map() // ip -> [timestamps]

function checkLimits(ip) {
  const today = new Date().toISOString().slice(0, 10)
  if (today !== dayKey) {
    dayKey = today
    dayCount = 0
  }
  if (!HAS_KEY) return { ok: false, reason: 'Live mode is not enabled on this deployment.' }
  if (active >= CONCURRENCY) return { ok: false, reason: 'Live demo is busy right now — try again in a moment.' }
  if (dayCount >= DAILY_CAP)
    return { ok: false, reason: "Live demo has hit today's limit — back tomorrow, or press Replay." }
  const now = Date.now()
  const hits = (ipHits.get(ip) || []).filter((t) => now - t < 3_600_000)
  if (hits.length >= IP_HOURLY)
    return { ok: false, reason: "You've reached the hourly limit — press Replay, or come back later." }
  return { ok: true }
}

wssLive.on('connection', (ws, req) => {
  const ip = (req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown').trim()
  ws.once('message', async (data) => {
    let question = ''
    try {
      question = String(JSON.parse(data.toString()).question || '').slice(0, 200).trim()
    } catch {
      question = ''
    }
    if (!question) {
      send(ws, { type: 'denied', reason: 'Please enter a question.' })
      return ws.close()
    }
    const lim = checkLimits(ip)
    if (!lim.ok) {
      send(ws, { type: 'denied', reason: lim.reason })
      return ws.close()
    }

    active++
    dayCount++
    const hits = ipHits.get(ip) || []
    hits.push(Date.now())
    ipHits.set(ip, hits)

    const runId = 'live_' + randomUUID().replace(/-/g, '').slice(0, 16)
    const source = `Live run — ${LIVE_MODEL_NAME} + PubCrawl MCP (real tools, real tokens).`
    const trace = { runId, task: question, source, nodes: [], edges: [] }
    try {
      send(ws, { type: 'run_start', runId, task: question, source })
      await runLiveAgent({
        question,
        model: LIVE_MODEL,
        maxSteps: MAX_STEPS,
        anthropic,
        onEvent: (evt) => {
          if (evt.type === 'node') trace.nodes.push(evt.node)
          else if (evt.type === 'edge') trace.edges.push(evt.edge)
          send(ws, evt)
        },
      })
      if (trace.nodes.length) saveRun(trace)
    } catch (e) {
      send(ws, { type: 'error', message: 'Live run failed: ' + (e?.message || 'unknown error') })
    } finally {
      active--
      try {
        ws.close()
      } catch {
        /* already closed */
      }
    }
  })
})

server.listen(PORT, () => {
  console.log(
    `Agent Trace Canvas on :${PORT} (static + /ws replay${HAS_KEY ? ` + /ws/live [${LIVE_MODEL}, cap ${DAILY_CAP}/day]` : ' + /ws/live DISABLED — set ANTHROPIC_API_KEY'})`,
  )
})
