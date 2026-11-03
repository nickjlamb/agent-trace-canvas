import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CompareView } from './CompareView.tsx'

// ?compare=<idA>,<idB> shows two saved runs side by side with a deterministic diff.
const compareParam = new URLSearchParams(window.location.search).get('compare')
const compareIds = compareParam && compareParam.split(',').length === 2
  ? (compareParam.split(',') as [string, string])
  : null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {compareIds ? <CompareView ids={compareIds} /> : <App />}
  </StrictMode>,
)
