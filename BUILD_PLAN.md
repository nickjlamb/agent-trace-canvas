# Agent Trace Canvas — Build Plan

An infinite, pan/zoom canvas that visualizes an AI agent's run as a node-edge graph.
Each node is a step (model call / tool call / retrieval / decision); edges show flow.
Click a node to inspect input, output, and its **eval verdict** (pass/fail, latency, tokens).

> **Why this project:** closes the React + Canvas/WebGL (+ WebSocket stretch) gap with an
> artifact that *is* the Miro surface in miniature, while showcasing the evals + agents wedge.

---

## Tech stack

| Concern        | Choice                          | Why |
|----------------|---------------------------------|-----|
| Framework      | React 18 + TypeScript           | The gap skill |
| Bundler        | Vite                            | Fast, modern default |
| Canvas         | `konva` + `react-konva`         | Real `<canvas>` 2D rendering — genuinely closes the gap |
| State          | `zustand`                       | Lightweight, idiomatic |
| Layout         | `dagre` (or `elkjs`)            | Auto-layout of the trace DAG |
| Deploy         | Vercel                          | One-command static deploy |
| Stretch: live  | `ws` + a tiny Node relay        | Stream a running agent → WebSocket gap |

---

## Trace JSON schema (the contract)

The canvas renders any trace matching this shape. Generate it from a real Claude agent run.

```jsonc
{
  "runId": "run_abc123",
  "task": "Answer the user's question using web search",
  "nodes": [
    {
      "id": "n1",
      "type": "model_call",        // model_call | tool_call | retrieval | decision
      "label": "Plan steps",
      "input": "User asked: ...",
      "output": "I'll search then summarize",
      "eval": { "status": "pass", "score": 0.95, "note": "on-task" },
      "latencyMs": 820,
      "tokens": { "in": 412, "out": 88 }
    }
  ],
  "edges": [
    { "from": "n1", "to": "n2" }
  ]
}
```

Node `type` drives colour/icon. `eval.status` (`pass` | `fail` | `warn`) drives the border.

---

## Milestones

### M0 — Scaffold (0.5 day)
- [ ] `npm create vite@latest . -- --template react-ts`
- [ ] Add deps: `konva react-konva zustand dagre`
- [ ] Strip boilerplate, confirm dev server runs
- [ ] Commit: `chore: scaffold vite + react-ts`

### M1 — Canvas primitive (1 day)  ← **the core gap-closer**
- [ ] Full-viewport `<Stage>` with a background layer
- [ ] **Pan** (drag empty space) + **zoom** (wheel, zoom-to-cursor)
- [ ] Draw a few hard-coded rectangles to prove the renderer
- [ ] Commit: `feat: pan/zoom infinite canvas`

### M2 — Render a trace (1 day)
- [ ] Load `public/sample-trace.json`
- [ ] `dagre` auto-layout → x/y per node
- [ ] Node component: rounded rect, type colour, eval border, label
- [ ] Edges as arrows between nodes
- [ ] Commit: `feat: render agent trace as node-edge graph`

### M3 — Inspect (0.5 day)
- [ ] Click node → select in zustand store
- [ ] Side panel: input, output, eval score, latency, tokens
- [ ] Hover highlight; click empty space to deselect
- [ ] Commit: `feat: node detail panel`

### M4 — Polish + ship (0.5 day)
- [ ] Legend (node types + eval colours)
- [ ] Aggregate bar: pass-rate, total tokens, total latency
- [ ] README with GIF; deploy to Vercel
- [ ] Commit: `docs: readme + demo gif`

**MVP done here → the gap is closed.**

### Stretch (each = one more JD checkbox)
- [ ] **Live mode (WebSocket):** tiny Node relay streams a running agent's steps;
      nodes animate in as they arrive. Closes the WebSocket gap.
- [ ] Mini-map + node search (very Miro)
- [ ] Run a real eval suite; show aggregate pass-rate live
- [ ] PixiJS/WebGL renderer swap to also claim WebGL

---

## Proposed file structure

```
agent-trace-canvas/
├── public/
│   └── sample-trace.json
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── store.ts                 # zustand: trace, selection, viewport
│   ├── types.ts                 # Trace / Node / Edge types
│   ├── layout.ts                # dagre wrapper -> positioned nodes
│   ├── canvas/
│   │   ├── CanvasStage.tsx      # Stage + pan/zoom
│   │   ├── TraceNode.tsx        # one node
│   │   └── TraceEdge.tsx        # one edge/arrow
│   └── panel/
│       ├── DetailPanel.tsx      # selected-node inspector
│       └── Legend.tsx
├── BUILD_PLAN.md
└── README.md
```

---

## Definition of done (MVP)
1. Deployed URL anyone can open.
2. Loads a real Claude agent trace and lays it out automatically.
3. Pan, zoom, click-to-inspect all work smoothly.
4. README explains the "evals on a canvas" idea with a GIF.
5. Code is clean, typed, and readable — it's a portfolio piece.
