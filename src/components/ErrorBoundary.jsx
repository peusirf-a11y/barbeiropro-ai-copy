// ErrorBoundary global — captura erros de render dos filhos e mostra fallback amigável.
// Em produção evita "tela branca". Em dev mostra a mensagem do erro.

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#F7F8FB] font-inter">
        <div className="bg-white rounded-3xl border border-black/8 shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-5">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-black text-[#0F172A] mb-2">Algo deu errado</h1>
          <p className="text-sm text-gray-500 mb-6">
            Encontramos um problema inesperado. Tente recarregar a página — se persistir, entre em contato com o suporte.
          </p>
          {this.state.error?.message && (
            <details className="text-left mb-5">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">Detalhes técnicos</summary>
              <pre className="text-[11px] bg-gray-50 border border-black/5 rounded-lg p-3 mt-2 overflow-auto max-h-32 text-red-600">
{String(this.state.error?.message || this.state.error)}
              </pre>
            </details>
          )}
          <div className="flex gap-2">
            <button
              onClick={this.handleHome}
              className="flex-1 px-4 py-2.5 border border-black/10 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Início
            </button>
            <button
              onClick={this.handleReload}
              className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-bold hover:bg-[#1d4ed8] inline-flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Recarregar
            </button>
          </div>
        </div>
      </div>
    );
  }
}