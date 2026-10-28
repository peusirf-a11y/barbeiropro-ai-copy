import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { initCSP, installCSPViolationListener } from '@/lib/security/csp'
import { captureReferralFromUrl } from '@/lib/referralTracking'

// Partner MVP: captura ?ref=CODE da URL inicial e persiste por 90 dias
try {
  captureReferralFromUrl()
} catch (e) {
  console.warn('[captureReferralFromUrl error]', e)
}

// CSP em Report-Only Mode para garantir estabilidade e evitar tela branca em produção
try {
  initCSP({ reportOnly: true, reportUri: '/api/cspReport' })
} catch (e) {
  console.warn('[CSP init error]', e)
}

// Log de violações no console (dev/staging)
try {
  installCSPViolationListener((report) => {
    if (import.meta.env.DEV) {
      console.warn('[CSP Violation]', report)
    }
  })
} catch (e) {
  console.warn('[installCSPViolationListener error]', e)
}

// ErrorBoundary no topo da aplicação para diagnosticar qualquer crash e exibir caixa vermelha
class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[RootErrorBoundary Erro Fatal Capturado]:', error, errorInfo)
  }

  render() {
    const initError = typeof window !== 'undefined' ? window.__SUPABASE_INIT_ERROR__ : null
    const displayError = this.state.error || initError

    if (displayError) {
      const errorText = typeof displayError === 'object'
        ? (displayError.message + '\n' + (displayError.stack || ''))
        : String(displayError)

      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#050816',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
        }}>
          <div style={{
            maxWidth: '850px',
            width: '100%',
            backgroundColor: '#0f172a',
            border: '2px solid #ef4444',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span style={{ fontSize: '28px' }}>⚠️</span>
              <div>
                <h1 style={{ color: '#ef4444', fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
                  Erro de Inicialização / Runtime Detectado
                </h1>
                <p style={{ color: '#94a3b8', fontSize: '12px', margin: '4px 0 0 0' }}>
                  A aplicação interceptou o erro fatal abaixo impedindo a tela preta no navegador:
                </p>
              </div>
            </div>

            <pre style={{
              backgroundColor: '#020617',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              padding: '16px',
              color: '#fca5a5',
              fontSize: '12px',
              lineHeight: '1.6',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              maxHeight: '400px',
              overflowY: 'auto'
            }}>
              {errorText}
            </pre>

            <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '10px 18px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Recarregar Página
              </button>
              <button
                onClick={() => {
                  try {
                    localStorage.clear();
                    sessionStorage.clear();
                  } catch (_) {}
                  window.location.href = '/login';
                }}
                style={{
                  padding: '10px 18px',
                  backgroundColor: '#334155',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Limpar Cache e Ir para Login
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

const rootElement = document.getElementById('root')
if (rootElement) {
  // Se window.__SUPABASE_INIT_ERROR__ já existir antes de montar
  if (typeof window !== 'undefined' && window.__SUPABASE_INIT_ERROR__) {
    console.error('[main.jsx] window.__SUPABASE_INIT_ERROR__ detectado antes da montagem:', window.__SUPABASE_INIT_ERROR__)
  }

  ReactDOM.createRoot(rootElement).render(
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  )
}

// Registro do Service Worker para habilitar instalação PWA (WebAPK / Standalone no Android e iOS)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err) => {
        if (import.meta.env.DEV) {
          console.warn('[PWA ServiceWorker registration error]:', err)
        }
      })
  })
}