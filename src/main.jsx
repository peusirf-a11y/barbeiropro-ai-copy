import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { initCSP, installCSPViolationListener } from '@/lib/security/csp'
import { captureReferralFromUrl } from '@/lib/referralTracking'

// Partner MVP: captura ?ref=CODE da URL inicial e persiste por 90 dias.
// Idempotente — chamadas repetidas em navegacão interna apenas sobrescrevem se houver nova ref.
captureReferralFromUrl()

// VULN-019: CSP em Enforcement Mode
// Ativa CSP com bloqueio de recursos não-autorizados (CSP v3)
// Violações reportadas para /api/cspReport
initCSP({ reportOnly: false, reportUri: '/api/cspReport' })

// Log de violações no console (dev/staging)
installCSPViolationListener((report) => {
  if (import.meta.env.DEV) {
    console.warn('[CSP Violation]', report)
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)