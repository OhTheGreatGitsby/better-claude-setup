import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './design/tokens.css'
import './design/base.css'
import './design/components.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root element is missing.')
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)
