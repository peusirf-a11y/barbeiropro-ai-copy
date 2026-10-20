// Caixa de pagamento Pix — QR code + copia-e-cola + timer + verificação real no Asaas.
// Se o pagamento for confirmado (RECEIVED / CONFIRMED): realiza o agendamento no sistema e avança.
// Se o pagamento NÃO for confirmado: informa que o pagamento não foi bem-sucedido e não deixa o cliente prosseguir.

import { useState, useEffect, useCallback, useRef } from 'react';
import { Copy, Check, Clock, Loader2, AlertCircle } from 'lucide-react';

export default function PixPaymentBox({
  appointmentId,
  paymentId: propPaymentId,
  pixData,
  bookingPayload,
  expiresAt,
  primaryColor = '#2563EB',
  companyId,
  onPaid,
  onExpired,
}) {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt || Date.now() + 15 * 60 * 1000) - Date.now()) / 1000))
  );
  const [manualChecking, setManualChecking] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('error'); // 'error' | 'success'
  const isCheckingRef = useRef(false);
  const hasConfirmedRef = useRef(false);

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

  // Timer de contagem regressiva da janela de pagamento (15 min)
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt || Date.now() + 15 * 60 * 1000) - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(interval);
        onExpired?.();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  // Verifica no Asaas se o pagamento foi confirmado:
  // - Se SIM (RECEIVED ou CONFIRMED): cria o agendamento no sistema e avança para "Agendado!".
  // - Se NÃO: exibe que o pagamento não foi bem-sucedido e bloqueia o avanço do cliente.
  const checkStatus = useCallback(async (isManualClick = false) => {
    if (!hasRealPaymentId || isCheckingRef.current || hasConfirmedRef.current) return;
    isCheckingRef.current = true;

    if (isManualClick) {
      setManualChecking(true);
      setFeedback('');
    }

    try {
      const queryParams = new URLSearchParams();
      queryParams.set('paymentId', targetPaymentId);
      if (companyId) queryParams.set('companyId', companyId);
      if (targetApptId) queryParams.set('appointmentId', targetApptId);

      const res = await fetch(`/api/payments/status?${queryParams.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: targetPaymentId,
          companyId,
          appointmentId: targetApptId,
          booking: bookingPayload || null,
        }),
      });
      const data = await res.json().catch(() => null);

      const isPaid =
        res.status === 200 &&
        (data?.status === 'RECEIVED' || data?.status === 'CONFIRMED');

      if (isPaid) {
        hasConfirmedRef.current = true;
        setFeedbackType('success');
        setFeedback('Pagamento confirmado com sucesso! Realizando seu agendamento...');
        onPaid?.({ appointmentId: data?.appointmentId || targetApptId });
      } else if (isManualClick) {
        setFeedbackType('error');
        setFeedback(
          'O pagamento não foi bem-sucedido ou ainda não foi confirmado pelo banco. Conclua o pagamento Pix acima para prosseguir com o agendamento.'
        );
      }
    } catch (err) {
      console.warn('[PixPaymentBox] Erro ao consultar status:', err);
      if (isManualClick) {
        setFeedbackType('error');
        setFeedback(
          'O pagamento não foi bem-sucedido ou ainda não foi confirmado pelo banco. Conclua o pagamento Pix acima para prosseguir com o agendamento.'
        );
      }
    } finally {
      isCheckingRef.current = false;
      if (isManualClick) {
        setManualChecking(false);
      }
    }
  }, [hasRealPaymentId, targetPaymentId, targetApptId, companyId, bookingPayload, onPaid]);

  // Polling a cada 4 segundos no frontend verificando se o pagamento foi confirmado no Asaas
  useEffect(() => {
    if (!hasRealPaymentId) return;
    const poll = setInterval(() => {
      checkStatus(false);
    }, 4000);
    return () => clearInterval(poll);
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
        disabled={!hasRealPaymentId || manualChecking || timeLeft === 0}
        className="w-full text-white font-bold py-3.5 rounded-xl text-sm transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md"
        style={{ backgroundColor: primaryColor }}
      >
        {manualChecking ? (
          <span className="inline-flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> A verificar com o banco...
          </span>
        ) : (
          'Já paguei / Verificar pagamento'
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
        O agendamento só é realizado após a confirmação do pagamento.
      </p>
    </div>
  );
}