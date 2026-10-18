// Step de pagamento online no fluxo público (/agendar/:slug).
// Orquestra: criação imediata da cobrança real no Asaas (/api/appointments/create-pix) + gravação em appointments (pending_payment) → QR Code Pix + Polling real → confirmação.

import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, AlertCircle, RefreshCw, QrCode, CreditCard, Loader2 } from 'lucide-react';
import PixPaymentBox from './PixPaymentBox';
import CardPaymentFormAsaas from './CardPaymentFormAsaas';

const ASAAS_PIX_ERROR_MSG = 'Não foi possível gerar a cobrança Pix no Asaas. Verifique a chave de API da barbearia.';

export default function BookingPaymentStep({ payload, primaryColor = '#2563EB', onBack, onSucceeded }) {
  const [stage, setStage] = useState('creating');
  const [method, setMethod] = useState('pix');
  const [errorMsg, setErrorMsg] = useState('');
  const [intentData, setIntentData] = useState(null);
  const startedRef = useRef(false);

  const createPixPayment = useCallback(async () => {
    setErrorMsg('');
    setStage('creating');

    try {
      const companyId = payload?.companyId || payload?.company_id;
      const serviceId = payload?.serviceId || payload?.service_id;
      const professionalId =
        payload?.is_flexible_assignment
          ? 'any'
          : (payload?.professionalId || payload?.professional_id || 'any');
      const clientName = payload?.clientName || payload?.customer_name || payload?.client_name || 'Cliente';
      const clientPhone = payload?.clientPhone || payload?.customer_phone || payload?.client_phone || '';
      const clientEmail = payload?.clientEmail || payload?.customer_email || payload?.client_email || '';
      const startTime = payload?.startTime || payload?.scheduled_at || payload?.start_time || new Date().toISOString();
      const endTime =
        payload?.endTime ||
        payload?.end_time ||
        (() => {
          const parsed = new Date(startTime);
          const dur = Number(payload?.duration_minutes) || 30;
          if (!Number.isNaN(parsed.getTime())) {
            return new Date(parsed.getTime() + dur * 60 * 1000).toISOString();
          }
          return startTime;
        })();
      const price = Number(payload?.price || 0);

      const requestBody = {
        companyId,
        serviceId,
        professionalId,
        clientName,
        clientPhone,
        clientEmail,
        startTime,
        endTime,
        price,
        date: payload?.date,
        time: payload?.time,
        serviceName: payload?.service_name,
        professionalName: payload?.professional_name,
        customer_id: payload?.customer_id,
        notes: payload?.notes || '',
      };

      const fetchRes = await fetch('/api/appointments/create-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const jsonRes = await fetchRes.json().catch(() => null);
      const realPaymentId = jsonRes?.paymentId || jsonRes?.payment_id || '';
      const isValidAsaasPayment =
        fetchRes.ok &&
        jsonRes &&
        jsonRes.success === true &&
        !jsonRes.error &&
        Boolean(
          realPaymentId &&
            realPaymentId.startsWith('pay_') &&
            !realPaymentId.startsWith('pay_mock_') &&
            !realPaymentId.startsWith('pay_test_')
        ) &&
        Boolean(jsonRes.encodedImage) &&
        Boolean(jsonRes.payload);

      if (!isValidAsaasPayment) {
        setErrorMsg(jsonRes?.error || jsonRes?.message || ASAAS_PIX_ERROR_MSG);
        setStage('error');
        return;
      }

      const normalizedIntent = {
        appointmentId: jsonRes.appointmentId,
        appointment_id: jsonRes.appointmentId,
        paymentId: realPaymentId,
        payment_id: realPaymentId,
        encodedImage: jsonRes.encodedImage,
        payload: jsonRes.payload,
        pix: {
          appointmentId: jsonRes.appointmentId,
          paymentId: realPaymentId,
          encodedImage: jsonRes.encodedImage,
          payload: jsonRes.payload,
        },
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      };

      setIntentData(normalizedIntent);
      setStage('pix');
    } catch (err) {
      setErrorMsg(ASAAS_PIX_ERROR_MSG);
      setStage('error');
    }
  }, [payload]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    createPixPayment();
  }, [createPixPayment]);

  const handleSwitchMethod = (newMethod) => {
    setMethod(newMethod);
    if (newMethod === 'card') {
      setStage('card');
    } else if (intentData) {
      setStage('pix');
    } else {
      createPixPayment();
    }
  };

  const handleRetry = () => {
    setIntentData(null);
    setErrorMsg('');
    createPixPayment();
  };

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 mb-4 hover:text-[#1B1C1E]">
        <ChevronLeft className="w-4 h-4" />Voltar
      </button>

      <h2 className="text-xl font-black text-[#1B1C1E] mb-4">Pagamento</h2>

      {/* Seletor rápido Pix / Cartão */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <MethodOption
          active={method === 'pix'}
          primaryColor={primaryColor}
          onClick={() => handleSwitchMethod('pix')}
          icon={QrCode}
          title="Pix"
          subtitle="QR Code instantâneo"
        />
        <MethodOption
          active={method === 'card'}
          primaryColor={primaryColor}
          onClick={() => handleSwitchMethod('card')}
          icon={CreditCard}
          title="Cartão"
          subtitle="Crédito via Asaas"
        />
      </div>

      {/* ─── CRIANDO COBRANÇA PIX NO ASAAS ─── */}
      {stage === 'creating' && (
        <div className="bg-white rounded-2xl border border-black/8 p-10 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#2563EB] mb-3" />
          <p className="text-sm text-gray-500">Preparando seu pagamento…</p>
        </div>
      )}

      {/* ─── PIX ─── */}
      {stage === 'pix' && intentData && (
        <PixPaymentBox
          appointmentId={intentData.appointment_id}
          paymentId={intentData.payment_id}
          pixData={intentData.pix}
          expiresAt={intentData.expires_at}
          primaryColor={primaryColor}
          companyId={payload?.companyId || payload?.company_id}
          onPaid={() => onSucceeded?.(intentData)}
          onExpired={() => setStage('expired')}
        />
      )}

      {/* ─── CARTÃO ─── */}
      {stage === 'card' && (
        <div className="bg-white rounded-2xl border border-black/8 p-5">
          <CardPaymentFormAsaas
            primaryColor={primaryColor}
            amountLabel={payload.price ? `Pagar R$ ${Number(payload.price).toFixed(2).replace('.', ',')}` : 'Pagar agora'}
            defaultName={payload.customer_name}
            defaultEmail={payload.customer_email}
            defaultPhone={payload.customer_phone}
            onSubmit={async (card) => {
              const requestPayload = { booking: payload, card };
              const res = await base44.functions.invoke('chargeBookingWithCard', requestPayload);
              const data = res?.data;
              if (!data?.success || (data?.status !== 'CONFIRMED' && data?.status !== 'RECEIVED')) {
                throw new Error(data?.message || data?.error || 'Falha no pagamento.');
              }
              onSucceeded?.({ appointment_id: data.appointment_id || payload.appointment_id });
            }}
          />
        </div>
      )}

      {/* ─── EXPIROU ─── */}
      {stage === 'expired' && (
        <div className="bg-white rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <h3 className="font-bold text-amber-900 mb-1">Tempo esgotado</h3>
          <p className="text-sm text-amber-800 mb-4">O pagamento expirou e seu horário foi liberado. Você pode tentar de novo.</p>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 bg-white text-amber-700 border border-amber-300 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-amber-100"
          >
            <RefreshCw className="w-4 h-4" /> Escolher outro horário
          </button>
        </div>
      )}

      {/* ─── ERRO EM VERMELHO ─── */}
      {stage === 'error' && (
        <div className="bg-red-50 rounded-2xl border border-red-300 p-5 text-center">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
          <h3 className="font-bold text-red-900 mb-1">Erro ao gerar cobrança Pix</h3>
          <p className="text-sm font-medium text-red-700 mb-4">{errorMsg || ASAAS_PIX_ERROR_MSG}</p>
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 bg-white text-red-700 border border-red-300 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-red-100"
          >
            <RefreshCw className="w-4 h-4" /> Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}

function MethodOption({ active, primaryColor, onClick, icon: Icon, title, subtitle }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left px-4 py-3 rounded-xl border transition-all ${active ? 'border-2 shadow-sm' : 'border-black/10 hover:border-gray-300'}`}
      style={active ? { borderColor: primaryColor, backgroundColor: `${primaryColor}08` } : {}}
    >
      <Icon className="w-5 h-5 mb-1" style={{ color: active ? primaryColor : '#6B7280' }} />
      <div className="font-bold text-sm text-[#1B1C1E]">{title}</div>
      <div className="text-[11px] text-gray-500">{subtitle}</div>
    </button>
  );
}