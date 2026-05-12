// Aba de conexão WhatsApp via QR Code ou Código de Pareamento por número (Evolution API).
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Wifi, WifiOff, RefreshCw, CheckCircle2, Smartphone, Hash, QrCode } from 'lucide-react';

const POLL_INTERVAL = 15_000;

export default function CRMWhatsAppTab() {
  const [state, setState] = useState('loading'); // loading | connected | qr | pairing | error
  const [qrCode, setQrCode] = useState(null);
  const [pairingCode, setPairingCode] = useState(null);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);
  const [mode, setMode] = useState('qr'); // 'qr' | 'phone'
  const [phone, setPhone] = useState('');
  const [loadingPhone, setLoadingPhone] = useState(false);

  const fetchQR = useCallback(async (phoneNumber = null) => {
    setState('loading');
    setError('');
    setPairingCode(null);
    try {
      const payload = phoneNumber ? { phone: phoneNumber } : {};
      const res = await base44.functions.invoke('getWhatsAppQRCode', payload);
      const data = res?.data;
      console.log('[CRMWhatsAppTab] fetchQR data:', JSON.stringify(data));
      if (data?.connected) {
        setState('connected');
        setQrCode(null);
      } else if (data?.pairingCode && phoneNumber) {
        // Pairing code solicitado por número de telefone
        setState('pairing');
        setPairingCode(data.pairingCode);
        setQrCode(null);
      } else if (data?.qrCode) {
        setState('qr');
        setQrCode(data.qrCode);
        // Se a API também retornou pairingCode junto com QR, guarda para uso no modo phone
        if (data.pairingCode) setPairingCode(data.pairingCode);
      } else if (data?.error) {
        setState('error');
        setError(data.error);
      } else {
        setState('error');
        setError('Resposta inesperada da Evolution API.');
      }
    } catch (e) {
      setState('error');
      setError(e?.response?.data?.error || e.message || 'Erro ao consultar a Evolution API.');
    }
    setLastRefresh(new Date());
    setLoadingPhone(false);
  }, []);

  useEffect(() => { fetchQR(); }, [fetchQR]);

  // Polling quando exibindo QR ou pairing code
  useEffect(() => {
    if (state !== 'qr' && state !== 'pairing') return;
    const timer = setInterval(() => fetchQR(), POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [state, fetchQR]);

  const handlePhoneConnect = () => {
    const cleaned = phone.replace(/\D/g, '');
    if (!cleaned || cleaned.length < 10) {
      setError('Digite um número válido com DDD e código do país (ex: 5511999999999)');
      return;
    }
    setError('');
    setLoadingPhone(true);
    fetchQR(cleaned);
  };

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
              <p className="text-sm text-[#6B7280]">Conecte via QR Code ou número de telefone</p>
            </div>
          </div>
        </div>

        {/* Seletor de modo (só quando desconectado) */}
        {state !== 'connected' && state !== 'loading' && (
          <div className="flex border-b border-black/5">
            <button
              onClick={() => { setMode('qr'); setError(''); fetchQR(); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${mode === 'qr' ? 'text-[#2563EB] border-b-2 border-[#2563EB]' : 'text-[#6B7280] hover:text-[#374151]'}`}
            >
              <QrCode className="w-4 h-4" /> QR Code
            </button>
            <button
              onClick={() => { setMode('phone'); setQrCode(null); setState('idle'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${mode === 'phone' ? 'text-[#2563EB] border-b-2 border-[#2563EB]' : 'text-[#6B7280] hover:text-[#374151]'}`}
            >
              <Hash className="w-4 h-4" /> Número de telefone
            </button>
          </div>
        )}

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
          {state === 'qr' && qrCode && mode === 'qr' && (
            <>
              <StatusPill connected={false} />
              <div className="relative">
                <img
                  src={qrCode}
                  alt="QR Code WhatsApp"
                  className="w-56 h-56 rounded-xl border border-black/10 shadow-sm"
                />
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

          {/* Pairing Code (por número) */}
          {state === 'pairing' && pairingCode && (
            <>
              <StatusPill connected={false} />
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-[#374151] text-center">Digite este código no WhatsApp para conectar:</p>
                <div className="bg-[#F0FDF4] border border-emerald-200 rounded-2xl px-8 py-5 text-center">
                  <span className="text-4xl font-black tracking-[0.25em] text-emerald-700 font-mono">
                    {pairingCode}
                  </span>
                </div>
                <div className="text-[10px] text-[#6B7280] bg-white border border-black/10 rounded-full px-2.5 py-0.5 shadow-sm">
                  Atualiza em 15s
                </div>
              </div>
              <ol className="text-left text-sm text-[#374151] space-y-1.5 w-full max-w-xs">
                <li className="flex items-start gap-2"><Step n={1} />Abra o <b>WhatsApp</b> no celular</li>
                <li className="flex items-start gap-2"><Step n={2} />Toque em <b>Menu → Aparelhos conectados</b></li>
                <li className="flex items-start gap-2"><Step n={3} />Toque em <b>Conectar com número de telefone</b></li>
                <li className="flex items-start gap-2"><Step n={4} />Digite o código acima</li>
              </ol>
            </>
          )}

          {/* Formulário de número (modo phone, ainda não solicitou pairing) */}
          {mode === 'phone' && (state === 'idle' || state === 'error') && (
            <div className="w-full flex flex-col gap-3">
              <StatusPill connected={false} />
              <div>
                <label className="text-xs font-semibold text-[#374151] block mb-1.5">
                  Número com código do país e DDD
                </label>
                <input
                  type="tel"
                  placeholder="5511999999999"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full px-3 py-2.5 border border-black/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                />
                <p className="text-[11px] text-[#9CA3AF] mt-1">Ex: 5511999999999 (55 = Brasil)</p>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button
                onClick={handlePhoneConnect}
                disabled={loadingPhone}
                className="w-full py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loadingPhone ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hash className="w-4 h-4" />}
                Gerar código de pareamento
              </button>
            </div>
          )}

          {/* Erro genérico */}
          {state === 'error' && mode === 'qr' && (
            <div className="py-8 flex flex-col items-center gap-4 text-center">
              <WifiOff className="w-10 h-10 text-red-400" />
              <div>
                <p className="font-semibold text-[#111827]">Não foi possível obter o QR Code</p>
                <p className="text-sm text-[#6B7280] mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Rodapé */}
          {state !== 'loading' && state !== 'idle' && !(mode === 'phone' && (state === 'idle' || state === 'error')) && (
            <div className="flex flex-col items-center gap-1.5 mt-1">
              <button
                onClick={() => mode === 'qr' ? fetchQR() : fetchQR(phone.replace(/\D/g, ''))}
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