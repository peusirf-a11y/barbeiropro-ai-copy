// Aba de conexão WhatsApp via QR Code e Pareamento (Evolution API v2 na VPS).
// Exibe o status em tempo real, QR Code dinâmico, código de pareamento e opção de desconectar.
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Wifi, WifiOff, RefreshCw, CheckCircle2, Smartphone, Key, LogOut, AlertTriangle } from 'lucide-react';

const POLL_INTERVAL = 15_000; // polling a cada 15s quando em fase de pareamento/QR

export default function CRMWhatsAppTab() {
  const [state, setState] = useState('loading'); // loading | connected | qr | error
  const [qrCode, setQrCode] = useState(null);
  const [pairingCode, setPairingCode] = useState(null);
  const [activeTab, setActiveTab] = useState('qr'); // 'qr' | 'pairing'
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const fetchQR = useCallback(async () => {
    setError('');
    try {
      const res = await base44.functions.invoke('getWhatsAppQRCode', {});
      const data = res?.data;

      if (data?.connected) {
        setState('connected');
        setQrCode(null);
        setPairingCode(null);
      } else if (data?.qrCode || data?.pairingCode) {
        setState('qr');
        setQrCode(data.qrCode || null);
        setPairingCode(data.pairingCode || null);
      } else if (data?.error) {
        setState('error');
        setError(data.error);
      } else {
        setState('error');
        setError('Aguardando resposta da Evolution API na VPS. Tente atualizar em instantes.');
      }
    } catch (e) {
      setState('error');
      const errorMsg = e?.response?.data?.error || e.message || '';
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
        setError('Não foi possível conectar à VPS da Evolution API. Verifique se o servidor está ativo.');
      } else {
        setError(errorMsg || 'Erro de comunicação com a Evolution API na VPS.');
      }
    }
    setLastRefresh(new Date());
  }, []);

  const handleLogout = async () => {
    if (!confirm('Deseja realmente desconectar esta sessão do WhatsApp?')) return;
    setIsLoggingOut(true);
    try {
      await base44.functions.invoke('logoutWhatsApp', {});
      setState('loading');
      await fetchQR();
    } catch (err) {
      setError(`Erro ao desconectar: ${err.message}`);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Carrega ao montar
  useEffect(() => {
    fetchQR();
  }, [fetchQR]);

  // Polling automático quando QR está sendo exibido
  useEffect(() => {
    if (state !== 'qr') return;
    const timer = setInterval(() => fetchQR(), POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [state, fetchQR]);

  return (
    <div className="max-w-lg mx-auto">
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.35)] overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl bg-emerald-400/[0.12] ring-1 ring-emerald-400/30 flex items-center justify-center">
                <span className="absolute inset-0 rounded-xl bg-emerald-400/20 blur-md opacity-60" aria-hidden="true" />
                <Smartphone className="relative w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <h2 className="font-bold text-white text-base">Conexão WhatsApp (Evolution API)</h2>
                <p className="text-sm text-white/55">Conecte o número da barbearia para automações</p>
              </div>
            </div>

            {state === 'connected' && (
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-semibold transition-all disabled:opacity-50"
                title="Desconectar este WhatsApp"
              >
                {isLoggingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                Desconectar
              </button>
            )}
          </div>
        </div>

        {/* Corpo */}
        <div className="p-6 flex flex-col items-center gap-5">

          {/* Loading */}
          {state === 'loading' && (
            <div className="py-12 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#60A5FA]" />
              <p className="text-sm text-white/55">Consultando status na Evolution API…</p>
            </div>
          )}

          {/* Conectado */}
          {state === 'connected' && (
            <div className="py-10 flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-emerald-400/[0.12] ring-2 ring-emerald-400/30 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-300" />
              </div>
              <div className="text-center">
                <p className="font-bold text-white text-lg">WhatsApp Conectado</p>
                <p className="text-sm text-white/55 mt-1">
                  Disparos transacionais e lembretes automáticos estão operacionais.
                </p>
              </div>
              <StatusPill connected />
            </div>
          )}

          {/* QR Code / Pareamento */}
          {state === 'qr' && (
            <>
              <StatusPill connected={false} />

              {/* Seletor QR vs Código de Pareamento */}
              {pairingCode && (
                <div className="flex rounded-lg border border-white/10 bg-white/[0.04] p-1 gap-1 w-full max-w-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab('qr')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      activeTab === 'qr' ? 'bg-[#2563EB] text-white shadow-sm' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Escanear QR
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('pairing')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      activeTab === 'pairing' ? 'bg-[#2563EB] text-white shadow-sm' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Código de Pareamento
                  </button>
                </div>
              )}

              {/* Aba QR Code */}
              {activeTab === 'qr' && qrCode && (
                <div className="relative">
                  <img
                    src={qrCode}
                    alt="QR Code WhatsApp Evolution API"
                    className="w-56 h-56 rounded-xl border border-white/15 shadow-[0_8px_24px_rgba(0,0,0,0.5)] bg-white p-2"
                  />
                  <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-[#0A1124] border border-white/15 rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white/70 whitespace-nowrap shadow-sm">
                    Atualiza automaticamente em 15s
                  </div>
                </div>
              )}

              {/* Aba Código de Pareamento (alternativa sem câmera) */}
              {activeTab === 'pairing' && pairingCode && (
                <div className="w-full max-w-xs p-5 rounded-xl border border-white/15 bg-white/[0.04] text-center space-y-2">
                  <Key className="w-6 h-6 text-amber-300 mx-auto" />
                  <p className="text-xs text-white/60">Insira este código de 8 dígitos no seu WhatsApp:</p>
                  <div className="font-mono text-2xl font-bold tracking-widest text-[#93C5FD] py-2 bg-black/40 rounded-lg border border-white/10">
                    {pairingCode}
                  </div>
                </div>
              )}

              <ol className="text-left text-sm text-white/80 space-y-1.5 w-full max-w-xs pt-1">
                <li className="flex items-start gap-2"><Step n={1} />Abra o <b className="text-white">WhatsApp</b> no seu celular</li>
                <li className="flex items-start gap-2"><Step n={2} />Acesse <b className="text-white">Aparelhos conectados</b></li>
                <li className="flex items-start gap-2"><Step n={3} />Toque em <b className="text-white">Conectar um aparelho</b></li>
                <li className="flex items-start gap-2"><Step n={4} />{activeTab === 'pairing' ? 'Selecione "Conectar com número de telefone" e digite o código' : 'Aponte a câmera para o QR Code'}</li>
              </ol>
            </>
          )}

          {/* Erro */}
          {state === 'error' && (
            <div className="py-8 flex flex-col items-center gap-4 text-center max-w-sm">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <WifiOff className="w-7 h-7 text-rose-400" />
              </div>
              <div>
                <p className="font-semibold text-white">Falha ao obter QR Code da Evolution API</p>
                <p className="text-xs text-white/60 mt-1 leading-relaxed">{error}</p>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-left flex items-start gap-2.5 text-xs text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>
                  Certifique-se de que a instância da Evolution API está em execução na VPS e as variáveis <b>EVOLUTION_API_URL</b> e <b>EVOLUTION_API_KEY</b> estão configuradas.
                </span>
              </div>
            </div>
          )}

          {/* Rodapé com botão atualizar + timestamp */}
          {state !== 'loading' && (
            <div className="flex flex-col items-center gap-1.5 mt-2">
              <button
                type="button"
                onClick={fetchQR}
                className="flex items-center gap-2 text-sm font-semibold text-[#93C5FD] hover:text-white transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Atualizar Status
              </button>
              {lastRefresh && (
                <span className="text-[11px] text-white/40">
                  Última checagem: {lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dica */}
      <p className="text-xs text-center text-white/40 mt-4 leading-relaxed">
        A comunicação é mantida através da Evolution API v2 hospedada em VPS própria.
      </p>
    </div>
  );
}

function StatusPill({ connected }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${
      connected
        ? 'bg-emerald-400/[0.12] text-emerald-200 border-emerald-400/30'
        : 'bg-amber-400/[0.12] text-amber-200 border-amber-400/30'
    }`}>
      {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
      {connected ? 'Conectado' : 'Desconectado'}
    </span>
  );
}

function Step({ n }) {
  return (
    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5 shadow-[0_4px_12px_rgba(37,99,235,0.4)] ring-1 ring-white/15">
      {n}
    </span>
  );
}