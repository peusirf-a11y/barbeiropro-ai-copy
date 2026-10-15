import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { initCSP, installCSPViolationListener } from '@/lib/security/csp'
import { captureReferralFromUrl } from '@/lib/referralTracking'

// Partner MVP: captura ?ref=CODE da URL inicial e persiste por 90 dias.
// Idempotente — chamadas repetidas em navegacão interna apenas sobrescrevem se houver nova ref.
captureReferralFromUrl()

// CSP em Report-Only Mode para garantir estabilidade e evitar tela branca em produção
try {
  initCSP({ reportOnly: true, reportUri: '/api/cspReport' })
} catch (e) {
  console.warn('[CSP init error]', e)
}

// Log de violações no console (dev/staging)
installCSPViolationListener((report) => {
  if (import.meta.env.DEV) {
    console.warn('[CSP Violation]', report)
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)