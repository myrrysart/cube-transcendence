import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { LegalPage } from './LegalPage'

const path = window.location.pathname
const page = path === '/privacy' ? 'privacy' : path === '/terms' ? 'terms' : undefined

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {page ? <LegalPage page={page} /> : <App />}
    <footer className="legal-footer" aria-label="Legal information">
      <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>
      <a href="/terms" target="_blank" rel="noopener">Terms of Service</a>
    </footer>
  </StrictMode>,
)
