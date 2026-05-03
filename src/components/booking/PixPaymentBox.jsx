// Caixa de pagamento Pix — QR code + copia-e-cola + timer + "Já paguei".
// Faz polling a cada 4s no getBookingPaymentStatus.

import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Copy, Check, Clock, Loader2, AlertCircle } from 'lucide-react';

export default function PixPaymentBox({ appointmentId, pixData, expiresAt, primaryColor, onPaid, onExpired }) {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000)));
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState('');

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(interval);
        onExpired?.();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  // Polling automático a cada 4s
  useEffect(() => {
    const poll = setInterval(() => checkStatus(false), 4000);
    return () => clearInterval(poll);
  }, [appointmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkStatus = async (manual) => {
    if (checking) return;
    setChecking(true);
    if (manual) setFeedback('Aguardando confirmação do banco…');
    try {
      const res = await base44.functions.invoke('getBookingPaymentStatus', {
        appointment_id: appointmentId,
        force_check: !!manual,
      });
      const data = res?.data;
      if (data?.payment_status === 'succeeded') {
        setFeedback('Pagamento confirmado!');
        onPaid?.();
      } else if (data?.payment_status === 'expired') {
        onExpired?.();
      } else if (manual) {
        setFeedback('Ainda não recebemos a confirmação. Aguarde mais alguns segundos…');
      }
    } catch (err) {
      if (manual) setFeedback('Erro ao verificar. Tente de novo em instantes.');
    } finally {
      setChecking(false);
    }
  };

  const copyCode = () => {
    if (!pixData?.copy_paste) return;
    navigator.clipboard.writeText(pixData.copy_paste);
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
      <div className={`flex items-center justify-center gap-2 mb-4 px-4 py-2.5 rounded-xl ${lowTime ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
        <Clock className="w-4 h-4" />
        <span className="text-sm font-semibold">Pague em até</span>
        <span className="text-lg font-black tabular-nums">{timeStr}</span>
      </div>

      {/* QR code */}
      {pixData?.qr_code_url ? (
        <div className="flex justify-center mb-4">
          <img src={pixData.qr_code_url} alt="QR Code Pix" className="w-56 h-56 border border-black/10 rounded-xl bg-white p-2" />
        </div>
      ) : (
        <div className="flex justify-center mb-4 w-56 h-56 mx-auto items-center bg-gray-50 rounded-xl">
          <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
        </div>
      )}

      {/* Copia e cola */}
      {pixData?.copy_paste && (
        <div className="mb-3">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Pix copia e cola</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={pixData.copy_paste}
              className="flex-1 px-3 py-2 border border-black/10 rounded-lg text-xs bg-gray-50 font-mono text-gray-600 truncate"
            />
            <button
              onClick={copyCode}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-[#2563EB] text-white hover:bg-[#1d4ed8]'}`}
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

      {/* Já paguei */}
      <button
        onClick={() => checkStatus(true)}
        disabled={checking || timeLeft === 0}
        className="w-full text-white font-bold py-3 rounded-xl text-sm transition-all hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: primaryColor }}
      >
        {checking ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Verificando…
          </span>
        ) : 'Já paguei'}
      </button>

      {feedback && (
        <div className="mt-3 flex items-start gap-2 text-xs text-gray-600">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-gray-400" />
          <span>{feedback}</span>
        </div>
      )}

      <p className="text-[11px] text-gray-400 text-center mt-3">
        Confirmamos automaticamente assim que o banco notificar.
      </p>
    </div>
  );
}