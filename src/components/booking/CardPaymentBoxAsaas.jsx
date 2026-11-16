// Cartão via Asaas hosted invoice. NUNCA tocamos em PAN/CVV — o cliente preenche
// no ambiente hospedado do Asaas (PCI compliance fica com eles).
//
// UX: card explica o fluxo, botão "Pagar com cartão" abre invoiceUrl em nova aba,
// polling de status confirma quando o webhook do Asaas marca o Appointment como pago.

import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { CreditCard, ExternalLink, Loader2, AlertCircle, CheckCircle2, Shield } from 'lucide-react';
import { usePublicTheme } from '@/hooks/usePublicTheme';

const POLL_INTERVAL_MS = 4000;

export default function CardPaymentBoxAsaas({
  appointmentId,
  invoiceUrl,
  expiresAt,
  primaryColor,
  onPaid,
  onExpired,
}) {
  const { isDark, tw } = usePublicTheme();
  const [opened, setOpened] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | pending | succeeded
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(() => calcRemaining(expiresAt));
  const pollRef = useRef(null);
  const popupRef = useRef(null);

  // Countdown
  useEffect(() => {
    const t = setInterval(() => {
      const r = calcRemaining(expiresAt);
      setRemaining(r);
      if (r <= 0) {
        clearInterval(t);
        if (pollRef.current) clearInterval(pollRef.current);
        onExpired?.();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [expiresAt, onExpired]);

  // Polling após abrir checkout
  useEffect(() => {
    if (!opened || status === 'succeeded') return;
    const poll = async () => {
      try {
        const res = await base44.functions.invoke('getAsaasBookingStatus', {
          appointment_id: appointmentId,
          force_check: true,
        });
        const data = res?.data;
        if (data?.payment_status === 'succeeded' || data?.paid_online) {
          setStatus('succeeded');
          if (pollRef.current) clearInterval(pollRef.current);
          onPaid?.();
        }
      } catch (_e) { /* silencioso — webhook é fonte da verdade */ }
    };
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    poll();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [opened, status, appointmentId, onPaid]);

  // Detecta retorno do popup (fechado pelo cliente)
  useEffect(() => {
    if (!opened) return;
    const t = setInterval(() => {
      if (popupRef.current && popupRef.current.closed) {
        clearInterval(t);
        // Mantém polling rodando — webhook ainda pode chegar
      }
    }, 500);
    return () => clearInterval(t);
  }, [opened]);

  const handleOpen = () => {
    setError('');
    if (!invoiceUrl) {
      setError('Link de pagamento indisponível. Tente novamente.');
      return;
    }
    const popup = window.open(invoiceUrl, '_blank', 'noopener,noreferrer');
    popupRef.current = popup;
    setOpened(true);
    setStatus('pending');
  };

  const handleCheckNow = async () => {
    setChecking(true);
    try {
      const res = await base44.functions.invoke('getAsaasBookingStatus', {
        appointment_id: appointmentId,
        force_check: true,
      });
      const data = res?.data;
      if (data?.payment_status === 'succeeded' || data?.paid_online) {
        setStatus('succeeded');
        onPaid?.();
      } else {
        setError('Ainda não recebemos a confirmação. Conclua o pagamento na aba aberta e volte aqui.');
      }
    } catch (_e) {
      setError('Não foi possível verificar agora. Aguarde alguns segundos e tente de novo.');
    } finally {
      setChecking(false);
    }
  };

  // ─── UI ─────────────────────────────────────────────────────────────
  if (status === 'succeeded') {
    return (
      <div className={`border rounded-2xl p-6 text-center ${
        isDark ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'
      }`}>
        <CheckCircle2 className={`w-10 h-10 mx-auto mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
        <h3 className={`font-bold mb-1 ${isDark ? 'text-emerald-200' : 'text-emerald-900'}`}>Pagamento confirmado!</h3>
        <p className={`text-sm ${isDark ? 'text-emerald-100/80' : 'text-emerald-800'}`}>Seu agendamento está garantido.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className={`${tw.card} rounded-2xl p-5`}>
        <div className="flex items-center gap-2 mb-3">
          <CreditCard className={`w-4 h-4 ${tw.textFaint}`} />
          <span className={`text-[11px] uppercase font-bold ${tw.textMuted} tracking-wide`}>Pagamento com cartão</span>
        </div>

        {!opened && (
          <>
            <p className={`text-sm ${tw.text} leading-relaxed mb-4`}>
              Você será direcionado para o ambiente seguro do <strong>Asaas</strong> para informar os dados do cartão. Nada do cartão passa pelos nossos servidores.
            </p>
            <div className={`flex items-start gap-2 border rounded-xl p-3 mb-4 ${
              isDark ? 'bg-blue-500/10 border-blue-500/25' : 'bg-blue-50 border-blue-100'
            }`}>
              <Shield className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
              <p className={`text-[12px] leading-relaxed ${isDark ? 'text-blue-100' : 'text-blue-900'}`}>
                Conexão criptografada, autenticação 3D Secure e PCI compliance garantidos pelo Asaas.
              </p>
            </div>
            <button
              onClick={handleOpen}
              className="w-full text-white font-bold py-4 rounded-2xl text-sm transition-all hover:opacity-90 shadow-md inline-flex items-center justify-center gap-2"
              style={{ backgroundColor: primaryColor }}
            >
              <ExternalLink className="w-4 h-4" />
              Pagar com cartão
            </button>
          </>
        )}

        {opened && (
          <>
            <div className={`flex items-start gap-2 border rounded-xl p-3 mb-3 ${
              isDark ? 'bg-amber-500/15 border-amber-500/25' : 'bg-amber-50 border-amber-100'
            }`}>
              <Loader2 className={`w-4 h-4 animate-spin flex-shrink-0 mt-0.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
              <div>
                <p className={`text-[13px] font-bold ${isDark ? 'text-amber-200' : 'text-amber-900'}`}>Aguardando confirmação…</p>
                <p className={`text-[12px] mt-0.5 leading-relaxed ${isDark ? 'text-amber-100/80' : 'text-amber-800'}`}>
                  Conclua o pagamento na aba do Asaas. Esta página atualiza automaticamente quando o pagamento for aprovado.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleOpen}
                className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${tw.secondaryBtn}`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Reabrir checkout
              </button>
              <button
                onClick={handleCheckNow}
                disabled={checking}
                className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${tw.secondaryBtn}`}
              >
                {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Já paguei, verificar
              </button>
            </div>
          </>
        )}

        {error && (
          <div className={`mt-3 flex items-start gap-2 text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <p className={`text-[11px] ${tw.textFaint} text-center`}>
        Você tem <strong>{formatRemaining(remaining)}</strong> para concluir o pagamento. Após esse prazo, o horário é liberado.
      </p>
    </div>
  );
}

function calcRemaining(iso) {
  if (!iso) return 0;
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}
function formatRemaining(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}