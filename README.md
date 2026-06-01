# Agent Trace Canvas

**See your AI agent think.** An infinite, Miro-style canvas that renders an agent's run as a
node-edge graph — every model call, tool call, and retrieval laid out spatially, each scored by
an eval (pass / warn / fail, latency, tokens). Click any step to inspect what went in, what came
out, and whether it was any good.

Think *LangSmith traces meet an infinite canvas* — agent observability you can actually see.

![Agent Trace Canvas](docs/screenshot.png)

## Why

Reading a giant JSON trace log to debug an agent is painful. Spatial beats linear: branches,
retries, and dead-ends are obvious when you *see* the graph. This makes agent **evals legible** —
in the demo run, the agent hallucinates a citation, the eval scores that step `fail`, and a
downstream citation-check catches it and routes to a revise. The whole story reads off the canvas.

![Step inspector](docs/inspector.png)

## Features

- **Infinite canvas** — pan (drag) and zoom-to-cursor (scroll), rendered to a real `<canvas>` via Konva
- **Auto-layout** — any trace lays itself out left-to-right (dagre), including branches/fan-in
- **Eval-aware nodes** — colour-coded by `pass` / `warn` / `fail`, with per-step score
- **Step inspector** — input, output, eval note, latency, tokens
- **Run stats** — pass rate, failed count, total tokens, total latency
- **Deep links** — `?node=<id>` opens a specific step (shareable)

## Stack

React 19 + TypeScript · Vite · **Konva** (`<canvas>`) · Zustand · dagre auto-layout

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
```

## Production build

```bash
npm run build    # -> dist/
npm start        # serve dist/ statically (honours $PORT)
```

## Trace format

The canvas renders any JSON matching [`src/types.ts`](src/types.ts) — see
[`public/sample-trace.json`](public/sample-trace.json) for a complete example. Drop in a trace
exported from a real agent run and it renders as-is.

## Deploy (Railway)

This is a static SPA; [`railway.json`](railway.json) builds with Nixpacks and serves `dist/`.

```bash
npm i -g @railway/cli
railway login
railway init        # or: railway link  (to an existing project)
railway up
```

## Roadmap

- [x] Pan/zoom infinite canvas
- [x] Render agent traces with auto-layout
- [x] Step inspector + run stats + deep links
- [ ] **Live mode** — stream a running agent's steps over WebSocket (always-on Railway service)
- [ ] Mini-map + node search
- [ ] PixiJS/WebGL renderer for very large traces

---
Built by [Nick Lamb](https://github.com/nickjlamb).
