// Aba de conexão WhatsApp via QR Code (Z-API).
// Exibe o status atual e o QR para escanear quando desconectado.
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Wifi, WifiOff, RefreshCw, CheckCircle2, Smartphone } from 'lucide-react';

const POLL_INTERVAL = 15_000; // polling a cada 15s

export default function CRMWhatsAppTab() {
  const [state, setState] = useState('loading'); // loading | connected | qr | error
  const [qrCode, setQrCode] = useState(null);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchQR = useCallback(async () => {
    setState(s => s === 'loading' ? 'loading' : 'loading');
    setError('');
    try {
      const res = await base44.functions.invoke('getWhatsAppQRCode', {});
      const data = res?.data;
      if (data?.connected) {
        setState('connected');
        setQrCode(null);
      } else if (data?.qrCode) {
        setState('qr');
        setQrCode(data.qrCode);
      } else if (data?.error) {
        setState('error');
        setError(data.error);
      } else {
        setState('error');
        setError('Resposta inesperada da Z-API.');
      }
    } catch (e) {
      setState('error');
      setError(e?.response?.data?.error || e.message || 'Erro ao consultar Z-API.');
    }
    setLastRefresh(new Date());
  }, []);

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
      <div className="bg-white rounded-2xl border border-black/5 shadow-[var(--shadow-md)] overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-black/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 ring-1 ring-emerald-200 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-bold text-[#111827] text-base">Conexão WhatsApp</h2>
              <p className="text-sm text-[#6B7280]">Escaneie o QR Code para conectar</p>
            </div>
          </div>
        </div>

        {/* Corpo */}
        <div className="p-6 flex flex-col items-center gap-5">

          {/* Loading */}
          {state === 'loading' && (
            <div className="py-12 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
              <p className="text-sm text-[#6B7280]">Consultando status…</p>
            </div>
          )}

          {/* Conectado */}
          {state === 'connected' && (
            <div className="py-10 flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-emerald-50 ring-2 ring-emerald-200 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <div className="text-center">
                <p className="font-bold text-[#111827] text-lg">WhatsApp Conectado</p>
                <p className="text-sm text-[#6B7280] mt-1">As mensagens automáticas estão ativas.</p>
              </div>
              <StatusPill connected />
            </div>
          )}

          {/* QR Code */}
          {state === 'qr' && qrCode && (
            <>
              <StatusPill connected={false} />
              <div className="relative">
                <img
                  src={qrCode}
                  alt="QR Code WhatsApp"
                  className="w-56 h-56 rounded-xl border border-black/10 shadow-sm"
                />
                {/* badge de recarregamento automático */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white border border-black/10 rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-[#6B7280] whitespace-nowrap shadow-sm">
                  Atualiza em 15s
                </div>
              </div>

              <ol className="text-left text-sm text-[#374151] space-y-1.5 w-full max-w-xs">
                <li className="flex items-start gap-2"><Step n={1} />Abra o <b>WhatsApp</b> no celular</li>
                <li className="flex items-start gap-2"><Step n={2} />Toque em <b>Menu → Aparelhos conectados</b></li>
                <li className="flex items-start gap-2"><Step n={3} />Toque em <b>Conectar um aparelho</b></li>
                <li className="flex items-start gap-2"><Step n={4} />Aponte a câmera para o QR Code acima</li>
              </ol>
            </>
          )}

          {/* Erro */}
          {state === 'error' && (
            <div className="py-8 flex flex-col items-center gap-4 text-center">
              <WifiOff className="w-10 h-10 text-red-400" />
              <div>
                <p className="font-semibold text-[#111827]">Não foi possível obter o QR Code</p>
                <p className="text-sm text-[#6B7280] mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Rodapé com botão atualizar + timestamp */}
          {state !== 'loading' && (
            <div className="flex flex-col items-center gap-1.5 mt-1">
              <button
                onClick={fetchQR}
                className="flex items-center gap-2 text-sm font-semibold text-[#2563EB] hover:text-[#1d4ed8] transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Atualizar
              </button>
              {lastRefresh && (
                <span className="text-[11px] text-[#9CA3AF]">
                  Atualizado às {lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dica */}
      <p className="text-xs text-center text-[#9CA3AF] mt-4">
        A conexão é mantida pelo dispositivo físico. Mantenha o celular com internet.
      </p>
    </div>
  );
}

function StatusPill({ connected }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${
      connected
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-amber-50 text-amber-700 border-amber-200'
    }`}>
      {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
      {connected ? 'Conectado' : 'Desconectado'}
    </span>
  );
}

function Step({ n }) {
  return (
    <span className="w-5 h-5 rounded-full bg-[#2563EB] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
      {n}
    </span>
  );
}