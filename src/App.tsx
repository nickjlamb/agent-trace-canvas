import { CanvasStage } from './canvas/CanvasStage'

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Agent Trace Canvas</h1>
        <p>Drag to pan · scroll to zoom · M2 wires in a real agent trace</p>
      </header>
      <main className="app-main">
        <CanvasStage />
      </main>
    </div>
  )
}

export default App
