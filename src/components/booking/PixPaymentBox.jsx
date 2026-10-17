// Caixa de pagamento Pix — QR code + copia-e-cola + timer + "Já paguei".
// Faz polling a cada 5s no status real do Asaas e validação estrita no "Já paguei".

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Copy, Check, Clock, Loader2, AlertCircle } from 'lucide-react';

export default function PixPaymentBox({
  appointmentId,
  paymentId: propPaymentId,
  pixData,
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
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState('');

  const targetPaymentId = propPaymentId || pixData?.paymentId || pixData?.payment_id || '';
  const targetApptId = appointmentId || pixData?.appointmentId || pixData?.appointment_id || '';
  const payload = pixData?.payload || pixData?.copy_paste || '';

  const rawImage = pixData?.encodedImage || pixData?.qr_code_base64 || '';
  const encodedImage = String(rawImage).replace(/^data:image\/png;base64,/, '');

  // Timer de contagem regressiva da janela de pagamento
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

  // Consulta de status real do pagamento no Asaas (GET /v3/payments/{id} via /api/payments/status)
  const checkStatus = useCallback(async (isManualClick = false) => {
    if (checking) return;
    setChecking(true);

    if (isManualClick) {
      setFeedback('Verificando pagamento no banco...');
    }

    try {
      const queryParams = new URLSearchParams();
      if (targetPaymentId) queryParams.set('paymentId', targetPaymentId);
      if (targetApptId) queryParams.set('appointmentId', targetApptId);
      if (companyId) queryParams.set('companyId', companyId);

      const res = await fetch(`/api/payments/status?${queryParams.toString()}`);
      const data = await res.json().catch(() => null);

      // NUNCA avança para "Agendado!" a menos que retorne explicitamente { status: 'RECEIVED' } ou { status: 'CONFIRMED' }
      const isPaid = data?.status === 'RECEIVED' || data?.status === 'CONFIRMED';

      if (isPaid) {
        setFeedback('Pagamento confirmado com sucesso!');

        try {
          if (supabase && (targetPaymentId || targetApptId)) {
            let updateQuery = supabase.from('appointments').update({
              status: 'confirmed',
              payment_status: 'confirmed',
              updated_at: new Date().toISOString(),
            });

            if (targetPaymentId) {
              updateQuery = updateQuery.eq('payment_id', targetPaymentId);
            } else if (targetApptId) {
              updateQuery = updateQuery.eq('id', targetApptId);
            }

            await updateQuery;
          }
        } catch (dbErr) {
          console.warn('[PixPaymentBox] Aviso ao atualizar status no banco:', dbErr);
        }

        onPaid?.();
      } else {
        if (isManualClick) {
          setFeedback('Pagamento ainda não detectado pelo banco. Aguarde alguns instantes.');
        }
      }
    } catch (err) {
      console.warn('[PixPaymentBox] Erro ao consultar status:', err);
      if (isManualClick) {
        setFeedback('Pagamento ainda não detectado pelo banco. Aguarde alguns instantes.');
      }
    } finally {
      setChecking(false);
    }
  }, [checking, targetPaymentId, targetApptId, companyId, onPaid]);

  // Polling periódico a cada 5 segundos chamando o endpoint de verificação real no Asaas
  useEffect(() => {
    if (!targetPaymentId && !targetApptId) return;
    const poll = setInterval(() => checkStatus(false), 5000);
    return () => clearInterval(poll);
  }, [targetPaymentId, targetApptId, checkStatus]);

  const copyCode = () => {
    if (!payload) return;
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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

      {/* QR Code Pix real retornado pelo Asaas */}
      {encodedImage ? (
        <div className="flex justify-center mb-4">
          <img
            src={`data:image/png;base64,${encodedImage}`}
            alt="QR Code Pix"
            className="w-56 h-56 border border-black/10 rounded-xl bg-white p-2 object-contain shadow-sm"
          />
        </div>
      ) : (
        <div className="flex justify-center mb-4 w-56 h-56 mx-auto items-center bg-gray-50 rounded-xl border border-black/5">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      )}

      {/* Pix Copia e Cola com payload real */}
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

      {/* Botão "Já paguei" com consulta imediata e validação estrita */}
      <button
        type="button"
        onClick={() => checkStatus(true)}
        disabled={checking || timeLeft === 0}
        className="w-full text-white font-bold py-3.5 rounded-xl text-sm transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-md"
        style={{ backgroundColor: primaryColor }}
      >
        {checking ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Verificando pagamento no banco...
          </span>
        ) : (
          'Já paguei'
        )}
      </button>

      {feedback && (
        <div
          className={`mt-3 flex items-start gap-2 text-xs p-3 rounded-xl border animate-fade-in ${
            feedback.includes('confirmado')
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="font-medium">{feedback}</span>
        </div>
      )}

      <p className="text-[11px] text-gray-400 text-center mt-3">
        Confirmamos automaticamente assim que o Pix for identificado.
      </p>
    </div>
  );
}