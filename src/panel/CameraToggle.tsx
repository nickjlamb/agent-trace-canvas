import { useStore } from '../store'

export function CameraToggle() {
  const nodes = useStore((s) => s.nodes)
  const cameraMode = useStore((s) => s.cameraMode)
  const setCameraMode = useStore((s) => s.setCameraMode)

  if (nodes.length === 0) return null

  return (
    <div className="cam-toggle" role="group" aria-label="Camera mode">
      <button
        className={cameraMode === 'follow' ? 'active' : ''}
        onClick={() => setCameraMode('follow')}
        title="Camera follows the active step at a readable zoom"
      >
        ◎ Follow
      </button>
      <button
        className={cameraMode === 'fit' ? 'active' : ''}
        onClick={() => setCameraMode('fit')}
        title="Fit the whole graph in view"
      >
        ⤢ Fit
      </button>
    </div>
  )
}
