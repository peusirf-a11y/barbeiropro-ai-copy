// Caixa de pagamento Pix — QR code + copia-e-cola + timer + "Já paguei".
// Faz polling a cada 5s no status Asaas e validação estrita no "Já paguei".

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Copy, Check, Clock, Loader2, AlertCircle } from 'lucide-react';

export default function PixPaymentBox({
  appointmentId,
  paymentId: propPaymentId,
  pixData,
  expiresAt,
  primaryColor = '#2563EB',
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
  const copyPasteCode = pixData?.payload || pixData?.copy_paste || '';

  // Resolve a imagem do QR Code em Base64 para exibição instantânea sem travamento no loading
  const rawImage = pixData?.encodedImage || pixData?.qr_code_base64 || '';
  const qrImageSrc = rawImage
    ? (rawImage.startsWith('data:') || rawImage.startsWith('http') ? rawImage : `data:image/png;base64,${rawImage}`)
    : pixData?.qr_code_url;

  // Timer de contagem regressiva
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

  // Consulta de status do pagamento
  const checkStatus = useCallback(async (isManualClick = false) => {
    if (checking) return;
    setChecking(true);

    if (isManualClick) {
      setFeedback('Consultando compensação junto ao Asaas...');
    }

    try {
      const queryParams = new URLSearchParams();
      if (targetPaymentId) queryParams.set('paymentId', targetPaymentId);
      if (targetApptId) queryParams.set('appointmentId', targetApptId);

      const res = await fetch(`/api/payments/status?${queryParams.toString()}`);
      const data = await res.json();

      const isPaid =
        data?.status === 'RECEIVED' ||
        data?.status === 'CONFIRMED' ||
        data?.received === true ||
        data?.confirmed === true;

      if (isPaid) {
        setFeedback('Pagamento confirmado com sucesso!');

        // Atualiza o agendamento no Supabase para status: 'confirmed'
        try {
          if (supabase && (targetPaymentId || targetApptId)) {
            let updateQuery = supabase.from('appointments').update({
              status: 'confirmed',
              payment_status: 'confirmed',
              updated_at: new Date().toISOString(),
            });

            if (targetPaymentId) {
              updateQuery = updateQuery.or(`asaas_payment_id.eq.${targetPaymentId},payment_id.eq.${targetPaymentId}`);
            } else if (targetApptId) {
              updateQuery = updateQuery.eq('id', targetApptId);
            }

            await updateQuery;
          }
        } catch (dbErr) {
          console.warn('[PixPaymentBox] Aviso ao atualizar status no banco:', dbErr);
        }

        // Avança apenas agora para a tela de confirmação
        onPaid?.();
      } else {
        // Se o pagamento ainda não foi recebido (ex: 'PENDING'):
        // Exiba um aviso e NUNCA avance para a tela de confirmação
        if (isManualClick) {
          setFeedback('Aguardando confirmação do banco. Se você já transferiu, aguarde alguns instantes.');
        }
      }
    } catch (err) {
      console.warn('[PixPaymentBox] Erro ao consultar status:', err);
      if (isManualClick) {
        setFeedback('Aguardando confirmação do banco. Se você já transferiu, aguarde alguns instantes.');
      }
    } finally {
      setChecking(false);
    }
  }, [checking, targetPaymentId, targetApptId, onPaid]);

  // Polling periódico a cada 5 segundos
  useEffect(() => {
    if (!targetPaymentId && !targetApptId) return;
    const poll = setInterval(() => checkStatus(false), 5000);
    return () => clearInterval(poll);
  }, [targetPaymentId, targetApptId, checkStatus]);

  const copyCode = () => {
    if (!copyPasteCode) return;
    navigator.clipboard.writeText(copyPasteCode);
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

      {/* QR code com renderização garantida via Base64 */}
      {qrImageSrc ? (
        <div className="flex justify-center mb-4">
          <img
            src={qrImageSrc}
            alt="QR Code Pix"
            className="w-56 h-56 border border-black/10 rounded-xl bg-white p-2 object-contain shadow-sm"
          />
        </div>
      ) : (
        <div className="flex justify-center mb-4 w-56 h-56 mx-auto items-center bg-gray-50 rounded-xl border border-black/5">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      )}

      {/* Copia e cola */}
      {copyPasteCode && (
        <div className="mb-3">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
            Pix copia e cola
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={copyPasteCode}
              className="flex-1 px-3 py-2 border border-black/10 rounded-lg text-xs bg-gray-50 font-mono text-gray-600 truncate"
            />
            <button
              onClick={copyCode}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                copied ? 'bg-emerald-500 text-white' : 'bg-[#2563EB] text-white hover:bg-[#1d4ed8]'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
      )}

      {/* Instruções */}
      <ol className="text-xs text-gray-600 space-y-1 mb-4 pl-4 list-decimal">
        <li>Abra o app do seu banco</li>
        <li>Escolha pagar com Pix → escaneie o QR ou cole o código</li>
        <li>Confirme o valor e finalize</li>
      </ol>

      {/* Botão "Já paguei" com consulta imediata e validação rígida */}
      <button
        onClick={() => checkStatus(true)}
        disabled={checking || timeLeft === 0}
        className="w-full text-white font-bold py-3.5 rounded-xl text-sm transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-md"
        style={{ backgroundColor: primaryColor }}
      >
        {checking ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Verificando compensação…
          </span>
        ) : (
          'Já paguei'
        )}
      </button>

      {feedback && (
        <div
          className={`mt-3 flex items-start gap-2 text-xs p-3 rounded-xl border ${
            feedback.includes('confirmado')
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{feedback}</span>
        </div>
      )}

      <p className="text-[11px] text-gray-400 text-center mt-3">
        Confirmamos automaticamente assim que o banco notificar.
      </p>
    </div>
  );
}