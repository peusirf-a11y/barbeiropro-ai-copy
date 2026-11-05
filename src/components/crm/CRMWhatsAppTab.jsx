// src/components/crm/CRMWhatsAppTab.jsx
// Aba de conexão WhatsApp via QR Code e Código de Pareamento (Pairing Code) da Evolution API v2.
// Comunica com a rota consolidada /api/whatsapp/[action] para economizar funções Serverless na Vercel.

import { useState, useEffect, useCallback } from 'react';
import { useCompany } from '@/hooks/useCompany';
import { base44 } from '@/api/base44Client';
import {
  Loader2,
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  Smartphone,
  Key,
  LogOut,
  AlertTriangle,
  QrCode as QrIcon,
  Copy,
  Check,
  Send,
} from 'lucide-react';

const POLL_INTERVAL = 12_000; // polling a cada 12s durante tentativa de conexão

export default function CRMWhatsAppTab({ company: propCompany }) {
  const { company: hookCompany } = useCompany();
  const company = propCompany || hookCompany;
  const companyId = company?.id;

  const [state, setState] = useState('loading'); // loading | connected | qr | pairing | error
  const [activeMode, setActiveMode] = useState('qr'); // 'qr' | 'pairing'
  const [qrCode, setQrCode] = useState(null);
  const [pairingCode, setPairingCode] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState(company?.whatsapp || company?.phone || '');
  const [isGeneratingPairing, setIsGeneratingPairing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // 1. Consulta status da instância
  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/whatsapp/status?company_id=${encodeURIComponent(companyId || '')}`);
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (_) {}

    // Fallback para base44 sdk se estiver em ambiente isolado
    try {
      const res = await base44.functions.invoke('getWhatsAppQRCode', { company_id: companyId });
      return res?.data;
    } catch (_) {
      return null;
    }
  }, [companyId]);

  // 2. Conecta via QR Code ou Pairing Code
  const fetchConnection = useCallback(async (mode = activeMode, targetPhone = phoneNumber) => {
    setError('');
    try {
      // Primeiro verifica se já está conectado
      const statusData = await checkStatus();
      if (statusData?.connected) {
        setState('connected');
        setQrCode(null);
        setPairingCode(null);
        setLastRefresh(new Date());
        return;
      }

      const isPairing = mode === 'pairing';
      const cleanPhone = targetPhone ? String(targetPhone).replace(/\D/g, '') : '';

      if (isPairing && cleanPhone.length < 10) {
        setError('Por favor, informe um número de WhatsApp válido com DDD (ex: 11999998888).');
        setState('pairing');
        return;
      }

      if (isPairing) setIsGeneratingPairing(true);

      const payload = {
        company_id: companyId,
        method: isPairing ? 'pairing' : 'qr',
        phone: cleanPhone || undefined,
      };

      let data = null;
      try {
        const res = await fetch('/api/whatsapp/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          data = await res.json();
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error || `HTTP ${res.status}`);
        }
      } catch (fetchErr) {
        // Fallback para base44 functions
        const res = await base44.functions.invoke('getWhatsAppQRCode', payload);
        data = res?.data;
        if (!data && fetchErr) throw fetchErr;
      }

      if (data?.connected) {
        setState('connected');
        setQrCode(null);
        setPairingCode(null);
      } else if (data?.pairingCode) {
        setState('pairing');
        setPairingCode(data.pairingCode);
        setQrCode(null);
      } else if (data?.qrCode) {
        setState('qr');
        setQrCode(data.qrCode);
        setPairingCode(null);
      } else if (data?.error) {
        setState('error');
        setError(data.error);
      } else {
        setState('qr');
      }
    } catch (e) {
      setState('error');
      const errorMsg = e.message || '';
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
        setError('Não foi possível conectar à VPS da Evolution API. Verifique se o servidor está ativo.');
      } else {
        setError(errorMsg || 'Erro de comunicação com a Evolution API na VPS.');
      }
    } finally {
      setIsGeneratingPairing(false);
      setLastRefresh(new Date());
    }
  }, [activeMode, phoneNumber, companyId, checkStatus]);

  // 3. Desconectar instância
  const handleLogout = async () => {
    if (!confirm('Deseja realmente desconectar esta sessão do WhatsApp da barbearia?')) return;
    setIsLoggingOut(true);
    try {
      await fetch(`/api/whatsapp/logout?company_id=${encodeURIComponent(companyId || '')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId }),
      });
      setState('loading');
      await fetchConnection('qr');
    } catch (err) {
      setError(`Erro ao desconectar: ${err.message}`);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Copiar código de pareamento
  const handleCopyCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode.replace(/[^a-zA-Z0-9]/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Carrega ao montar
  useEffect(() => {
    fetchConnection('qr');
  }, [fetchConnection]);

  // Polling automático apenas quando aguardando QR Code ou Pairing
  useEffect(() => {
    if (state !== 'qr' && state !== 'pairing') return;
    const timer = setInterval(() => {
      checkStatus().then((res) => {
        if (res?.connected) {
          setState('connected');
          setQrCode(null);
          setPairingCode(null);
        }
      });
    }, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [state, checkStatus]);

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
                <h2 className="font-bold text-white text-base">WhatsApp Barbearia (Evolution API)</h2>
                <p className="text-xs text-white/55">Conexão oficial da barbearia para automações e lembretes</p>
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
              <p className="text-sm text-white/55">Verificando status na Evolution API...</p>
            </div>
          )}

          {/* Conectado */}
          {state === 'connected' && (
            <div className="py-8 flex flex-col items-center gap-4 text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-400/[0.12] ring-2 ring-emerald-400/30 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-300" />
              </div>
              <div>
                <p className="font-bold text-white text-lg">WhatsApp Ativo & Conectado</p>
                <p className="text-sm text-white/55 mt-1 max-w-xs">
                  A sua barbearia está pronta para enviar lembretes de agendamento e campanhas de retorno automáticas.
                </p>
              </div>
              <StatusPill connected />
            </div>
          )}

          {/* Estado de Desconectado / Opções de Conexão */}
          {(state === 'qr' || state === 'pairing') && (
            <>
              <StatusPill connected={false} />

              {/* Seletor de Modo: QR Code vs Código de Pareamento */}
              <div className="grid grid-cols-2 p-1 rounded-xl border border-white/10 bg-white/[0.04] w-full max-w-sm">
                <button
                  type="button"
                  onClick={() => {
                    setActiveMode('qr');
                    fetchConnection('qr');
                  }}
                  className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                    activeMode === 'qr'
                      ? 'bg-[#2563EB] text-white shadow-md'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <QrIcon className="w-3.5 h-3.5" />
                  Escanear QR Code
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMode('pairing');
                    setState('pairing');
                  }}
                  className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                    activeMode === 'pairing'
                      ? 'bg-[#2563EB] text-white shadow-md'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Key className="w-3.5 h-3.5" />
                  Código no Celular
                </button>
              </div>

              {/* MODO 1: QR Code Tradicional */}
              {activeMode === 'qr' && (
                <div className="flex flex-col items-center gap-4 w-full">
                  {qrCode ? (
                    <div className="relative">
                      <img
                        src={qrCode}
                        alt="QR Code Evolution API"
                        className="w-56 h-56 rounded-2xl border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.6)] bg-white p-2.5"
                      />
                      <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-[#0A1124] border border-white/15 rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white/70 whitespace-nowrap shadow-sm">
                        Atualiza a cada 15s
                      </div>
                    </div>
                  ) : (
                    <div className="w-56 h-56 rounded-2xl border border-dashed border-white/20 bg-white/[0.02] flex flex-col items-center justify-center gap-2 text-center p-4">
                      <Loader2 className="w-6 h-6 animate-spin text-[#60A5FA]" />
                      <p className="text-xs text-white/50">Gerando QR Code na Evolution API...</p>
                    </div>
                  )}

                  <ol className="text-left text-xs text-white/80 space-y-1.5 w-full max-w-sm pt-2 bg-white/[0.02] p-3 rounded-xl border border-white/5">
                    <li className="flex items-start gap-2"><Step n={1} />Abra o <b>WhatsApp</b> no celular da barbearia</li>
                    <li className="flex items-start gap-2"><Step n={2} />Vá em <b>Aparelhos Conectados</b></li>
                    <li className="flex items-start gap-2"><Step n={3} />Toque em <b>Conectar um aparelho</b></li>
                    <li className="flex items-start gap-2"><Step n={4} />Aponte a câmera para o QR Code acima</li>
                  </ol>
                </div>
              )}

              {/* MODO 2: Código de Pareamento (Pairing Code) */}
              {activeMode === 'pairing' && (
                <div className="flex flex-col items-center gap-4 w-full max-w-sm">
                  {/* Formulário de número de telefone */}
                  <div className="w-full space-y-2">
                    <label className="block text-xs font-medium text-white/70 text-left">
                      Número do WhatsApp da barbearia (com DDD):
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="Ex: 11999998888"
                        className="flex-1 px-3 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      />
                      <button
                        type="button"
                        onClick={() => fetchConnection('pairing', phoneNumber)}
                        disabled={isGeneratingPairing || !phoneNumber}
                        className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        {isGeneratingPairing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Gerar Código
                      </button>
                    </div>
                  </div>

                  {/* Exibição do código de 8 dígitos gerado */}
                  {pairingCode ? (
                    <div className="w-full p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 text-center space-y-2">
                      <p className="text-xs text-blue-200">Digite este código de 8 dígitos no seu celular:</p>
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-mono text-3xl font-extrabold tracking-widest text-[#93C5FD] py-1 px-4 bg-black/50 rounded-xl border border-white/15">
                          {pairingCode}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-colors"
                          title="Copiar código"
                        >
                          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-white/70" />}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-white/45 text-center">
                      Informe o número e clique em &ldquo;Gerar Código&rdquo; para conectar sem precisar de câmera.
                    </p>
                  )}

                  <ol className="text-left text-xs text-white/80 space-y-1.5 w-full pt-2 bg-white/[0.02] p-3 rounded-xl border border-white/5">
                    <li className="flex items-start gap-2"><Step n={1} />No WhatsApp, vá em <b>Aparelhos Conectados</b></li>
                    <li className="flex items-start gap-2"><Step n={2} />Toque em <b>Conectar um aparelho</b></li>
                    <li className="flex items-start gap-2"><Step n={3} />Toque na opção <b>Conectar com número de telefone</b></li>
                    <li className="flex items-start gap-2"><Step n={4} />Insira o código de 8 dígitos mostrado na tela</li>
                  </ol>
                </div>
              )}
            </>
          )}

          {/* Erro */}
          {state === 'error' && (
            <div className="py-6 flex flex-col items-center gap-3 text-center max-w-sm">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <WifiOff className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <p className="font-semibold text-white text-sm">Falha ao conectar com a Evolution API</p>
                <p className="text-xs text-white/60 mt-1">{error}</p>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-left flex items-start gap-2.5 text-xs text-amber-200 mt-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>
                  Verifique se a Evolution API está em execução no Easypanel e as variáveis <b>EVOLUTION_API_URL</b> e <b>EVOLUTION_API_KEY</b> estão preenchidas.
                </span>
              </div>
            </div>
          )}

          {/* Rodapé com botão Atualizar */}
          {state !== 'loading' && (
            <div className="flex flex-col items-center gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => fetchConnection(activeMode, phoneNumber)}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#93C5FD] hover:text-white transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Atualizar Conexão
              </button>
              {lastRefresh && (
                <span className="text-[10px] text-white/40">
                  Última sincronização: {lastRefresh.toLocaleTimeString('pt-BR')}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ connected }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${
        connected
          ? 'bg-emerald-400/[0.12] text-emerald-200 border-emerald-400/30'
          : 'bg-amber-400/[0.12] text-amber-200 border-amber-400/30'
      }`}
    >
      {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
      {connected ? 'Conectado' : 'Aguardando Conexão'}
    </span>
  );
}

function Step({ n }) {
  return (
    <span className="w-4 h-4 rounded-full bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
      {n}
    </span>
  );
}