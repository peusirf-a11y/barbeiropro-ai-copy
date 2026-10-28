// Caixa de pagamento Pix — QR code + copia-e-cola + timer + verificação real no Asaas.
// O cliente permanece estritamente nesta página até que o pagamento seja confirmado no Asaas (RECEIVED / CONFIRMED).

import { useState, useEffect, useCallback, useRef } from 'react';
import { Copy, Check, Clock, Loader2, AlertCircle } from 'lucide-react';
import { getThemeAccent } from '@/lib/colorUtils';

export default function PixPaymentBox({
  appointmentId,
  paymentId: propPaymentId,
  pixData,
  bookingPayload,
  expiresAt,
  primaryColor = '#2563EB',
  companyId,
  onPaid,
}) {
  const accent = getThemeAccent(primaryColor, false);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt || Date.now() + 15 * 60 * 1000) - Date.now()) / 1000))
  );
  const [manualChecking, setManualChecking] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('error'); // 'error' | 'success'
  const isPollingRef = useRef(false);
  const hasConfirmedRef = useRef(false);
  const onPaidRef = useRef(onPaid);

  useEffect(() => {
    onPaidRef.current = onPaid;
  }, [onPaid]);

  const targetPaymentId = propPaymentId || pixData?.paymentId || pixData?.payment_id || '';
  const targetApptId = appointmentId || pixData?.appointmentId || pixData?.appointment_id || '';
  const payload = pixData?.payload || pixData?.copy_paste || '';

  const hasRealPaymentId = Boolean(
    targetPaymentId &&
    targetPaymentId.startsWith('pay_') &&
    !targetPaymentId.startsWith('pay_mock_') &&
    !targetPaymentId.startsWith('pay_test_')
  );

  const rawImage = pixData?.encodedImage || pixData?.qr_code_base64 || '';
  const encodedImage = String(rawImage).replace(/^data:image\/png;base64,/, '');

  // Timer visual de contagem regressiva (mantém o cliente na página do Pix)
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt || Date.now() + 15 * 60 * 1000) - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  // Verifica no Asaas se o pagamento foi confirmado:
  // - Se SIM (RECEIVED, CONFIRMED ou RECEIVED_IN_CASH): confirma o agendamento no sistema e avança para "Agendado!".
  // - Se NÃO: mantém o cliente nesta página e informa que o pagamento não foi confirmado.
  const checkStatus = useCallback(async (isManualClick = false) => {
    if (!hasRealPaymentId || hasConfirmedRef.current) return;
    // Se for polling em background e já houver uma checagem em andamento, aguarda a próxima.
    // Porém, se for clique manual em "Já paguei", SEMPRE executa imediatamente!
    if (!isManualClick && isPollingRef.current) return;

    isPollingRef.current = true;

    if (isManualClick) {
      setManualChecking(true);
      setFeedback('');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const queryParams = new URLSearchParams();
      queryParams.set('paymentId', targetPaymentId);
      if (companyId) queryParams.set('companyId', companyId);
      if (targetApptId) queryParams.set('appointmentId', targetApptId);
      queryParams.set('_t', String(Date.now()));

      const res = await fetch(`/api/payments/status?${queryParams.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        signal: controller.signal,
        body: JSON.stringify({
          paymentId: targetPaymentId,
          companyId,
          appointmentId: targetApptId,
          booking: bookingPayload || null,
        }),
      });
      clearTimeout(timeoutId);

      const data = await res.json().catch(() => null);

      const isPaid =
        res.status === 200 &&
        data?.confirmed === true &&
        ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(String(data?.status || '').toUpperCase());

      if (isPaid) {
        hasConfirmedRef.current = true;
        const finalApptId = data?.appointmentId || targetApptId;
        if (finalApptId && companyId) {
          try {
            const rawSaved = localStorage.getItem(`bt_my_appointments_${companyId}`) || '[]';
            const list = JSON.parse(rawSaved);
            if (!list.includes(finalApptId)) {
              list.unshift(finalApptId);
              localStorage.setItem(`bt_my_appointments_${companyId}`, JSON.stringify(list));
            }
          } catch (_) {}
        }

        setFeedbackType('success');
        setFeedback('Pagamento confirmado com sucesso! Agendamento registrado no sistema.');
        onPaidRef.current?.({
          appointmentId: finalApptId,
          appointment: data?.appointment || null,
        });
      } else if (isManualClick) {
        setFeedbackType('error');
        setFeedback(
          'Pagamento ainda não confirmado pelo banco. O sistema permanecerá nesta página até que o pagamento do Pix seja compensado.'
        );
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('[PixPaymentBox] Erro ao consultar status:', err);
      if (isManualClick) {
        setFeedbackType('error');
        setFeedback(
          'Pagamento ainda não confirmado pelo banco. O sistema permanecerá nesta página até que o pagamento do Pix seja compensado.'
        );
      }
    } finally {
      isPollingRef.current = false;
      if (isManualClick) {
        setManualChecking(false);
      }
    }
  }, [hasRealPaymentId, targetPaymentId, targetApptId, companyId, bookingPayload]);

  // Polling a cada 3 segundos + verificação imediata ao voltar do aplicativo do banco (visibilitychange / focus)
  useEffect(() => {
    if (!hasRealPaymentId) return;
    const poll = setInterval(() => {
      checkStatus(false);
    }, 3000);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkStatus(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [hasRealPaymentId, checkStatus]);

  const copyCode = () => {
    if (!payload) return;
    navigator.clipboard.writeText(payload);
    setCopied(true);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const lowTime = timeLeft < 120;

  return (
    <div className="bg-white rounded-2xl border border-black/8 p-5">
      {/* Timer */}
      <div
        className={`flex items-center justify-center gap-2 mb-4 px-4 py-2.5 rounded-xl ${
          lowTime ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
        }`}
      >
        <Clock className="w-4 h-4" />
        <span className="text-sm font-semibold">Pague em até</span>
        <span className="text-lg font-black tabular-nums">{timeStr}</span>
      </div>

      {/* Renderização da Imagem do QR Code */}
      {encodedImage && (
        <div className="flex justify-center mb-4">
          <img
            src={`data:image/png;base64,${encodedImage}`}
            alt="QR Code Pix"
            className="w-56 h-56 mx-auto object-contain"
          />
        </div>
      )}

      {/* Renderização do Copia e Cola */}
      {payload && (
        <div className="mb-3">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
            Pix copia e cola
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={payload}
              className="flex-1 px-3 py-2 border border-black/10 rounded-lg text-xs bg-gray-50 font-mono text-gray-600 truncate select-all"
              onClick={(e) => e.target.select()}
            />
            <button
              type="button"
              onClick={copyCode}
              className={`flex items-center gap-1 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm ${
                copied ? 'bg-emerald-600 text-white' : 'bg-[#2563EB] text-white hover:bg-[#1d4ed8]'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Instruções */}
      <ol className="text-xs text-gray-600 space-y-1 mb-4 pl-4 list-decimal">
        <li>Abra o aplicativo do seu banco</li>
        <li>Escolha pagar com Pix → escaneie o QR Code ou cole o código</li>
        <li>Confira o valor e confirme a transferência</li>
      </ol>

      {/* Botão de verificação de pagamento */}
      <button
        type="button"
        onClick={() => checkStatus(true)}
        disabled={!hasRealPaymentId || manualChecking}
        className="w-full font-bold py-3.5 rounded-xl text-sm transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md"
        style={{ backgroundColor: accent.bg, color: accent.fg }}
      >
        {manualChecking ? (
          <span className="inline-flex items-center justify-center gap-2" style={{ color: accent.fg }}>
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: accent.fg }} /> A verificar com o banco...
          </span>
        ) : (
          <span style={{ color: accent.fg }}>Já paguei</span>
        )}
      </button>

      {feedback && (
        <div
          className={`mt-3 flex items-start gap-2 text-xs p-3.5 rounded-xl border ${
            feedbackType === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-300 text-red-700'
          }`}
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="font-semibold">{feedback}</span>
        </div>
      )}

      <p className="text-[11px] text-gray-400 text-center mt-3">
        Esta página permanece ativa aguardando a confirmação bancária do Pix.
      </p>
    </div>
  );
}