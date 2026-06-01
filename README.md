# Agent Trace Canvas

**See your AI agent think.** An infinite, Miro-style canvas that renders an agent's run as a
node-edge graph — every model call, tool call, and retrieval laid out spatially, each scored by
an eval (pass / fail, latency, tokens). Click any step to inspect what went in, what came out,
and whether it was any good.

Think *LangSmith traces meet an infinite canvas* — agent observability you can actually see.

> 🚧 In active development. See [`BUILD_PLAN.md`](./BUILD_PLAN.md) for scope and milestones.

## Why

Reading a giant JSON trace log to debug an agent is painful. Spatial beats linear: branches,
retries, and dead-ends are obvious when you *see* the graph. This makes agent evals legible.

## Stack

React + TypeScript · Vite · Konva (`<canvas>`) · Zustand · dagre auto-layout

## Run locally

```bash
npm install
npm run dev
```

## Status

| Milestone | What | Done |
|-----------|------|------|
| M0 | Scaffold | ☐ |
| M1 | Pan/zoom infinite canvas | ☐ |
| M2 | Render agent trace | ☐ |
| M3 | Node detail panel | ☐ |
| M4 | Polish + deploy | ☐ |

---
Built by [Nick Lamb](https://github.com/nickjlamb).
