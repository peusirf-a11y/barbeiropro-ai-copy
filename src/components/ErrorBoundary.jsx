// ErrorBoundary global — captura erros de render dos filhos e mostra fallback amigável.
// Sem reload forçado: tenta resetar o estado primeiro. Estrutura preparada para
// integração futura com Sentry/Logflare/etc via window.__errorReporter.

import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, retryKey: 0 };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info?.componentStack);
    this.setState({ errorInfo: info });
    // Hook futuro para serviço externo (Sentry, etc.)
    try {
      if (typeof window !== 'undefined' && typeof window.__errorReporter === 'function') {
        window.__errorReporter(error, { componentStack: info?.componentStack });
      }
    } catch { /* nunca quebrar o boundary por causa do reporter */ }
  }

  // Reset state — tenta re-renderizar SEM reload da página inteira.
  // Usa retryKey para forçar remount dos filhos (evita errors persistentes).
  handleRetry = () => {
    this.setState((s) => ({ hasError: false, error: null, errorInfo: null, retryKey: s.retryKey + 1 }));
  };

  handleHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, retryKey: this.state.retryKey + 1 });
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.location.href = '/';
    }
  };

  render() {
    if (!this.state.hasError) {
      // Renderizamos os children diretamente — sem wrapper.
      // Para forçar remount após retry, mudamos a key da árvore via clone.
      return this.state.retryKey === 0
        ? this.props.children
        : React.Children.map(this.props.children, (child) =>
            React.isValidElement(child) ? React.cloneElement(child, { key: this.state.retryKey }) : child
          );
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#F7F8FB] font-inter">
        <div className="bg-white rounded-3xl border border-black/8 shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-5">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-black text-[#0F172A] mb-2">Algo deu errado</h1>
          <p className="text-sm text-gray-500 mb-6">
            Encontramos um problema inesperado. Tente novamente — se persistir, entre em contato com o suporte.
          </p>
          {this.state.error?.message && (
            <details className="text-left mb-5">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">Detalhes técnicos</summary>
              <pre className="text-[11px] bg-gray-50 border border-black/5 rounded-lg p-3 mt-2 overflow-auto max-h-32 text-red-600 whitespace-pre-wrap">
{String(this.state.error?.message || this.state.error)}
              </pre>
            </details>
          )}
          <div className="flex gap-2">
            <button
              onClick={this.handleHome}
              className="flex-1 px-4 py-2.5 border border-black/10 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" /> Início
            </button>
            <button
              onClick={this.handleRetry}
              className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-bold hover:bg-[#1d4ed8] inline-flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }
}