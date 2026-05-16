import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { initCSP, installCSPViolationListener } from '@/lib/security/csp'

// Ativa CSP em Report-Only mode (não bloqueia, apenas monitora)
// Para enforcement total: mudar para { reportOnly: false }
initCSP({ reportOnly: true, reportUri: null })

// Log de violações no console (dev/staging)
installCSPViolationListener((report) => {
  if (import.meta.env.DEV) {
    console.warn('[CSP Violation]', report)
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)