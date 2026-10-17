// Step de pagamento online no fluxo público (/agendar/:slug).
// Orquestra: criação da cobrança real no Asaas (/api/appointments/create-pix) → QR Code Pix + Polling real → confirmação.

import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, AlertCircle, RefreshCw, QrCode, CreditCard, Loader2 } from 'lucide-react';
import PixPaymentBox from './PixPaymentBox';
import CardPaymentFormAsaas from './CardPaymentFormAsaas';
import { generateStableIdempotencyKey } from '@/lib/system/idempotency';

const ASAAS_PIX_ERROR_MSG = 'Não foi possível gerar a cobrança Pix no Asaas. Verifique a chave de API da barbearia.';

function maskCpf(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export default function BookingPaymentStep({ payload, primaryColor, onBack, onSucceeded }) {
  const [stage, setStage] = useState('choose');
  const [method, setMethod] = useState('pix');
  const [cpf, setCpf] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [intentData, setIntentData] = useState(null);
  const idemKeyRef = useRef(null);

  const cpfDigits = cpf.replace(/\D/g, '');

  const handleStart = async () => {
    setErrorMsg('');
    if (method === 'card') {
      setStage('card');
      return;
    }
    if (cpfDigits.length !== 11) {
      setErrorMsg('Informe um CPF válido (11 dígitos).');
      return;
    }

    setStage('creating');
    try {
      if (!idemKeyRef.current) {
        idemKeyRef.current = generateStableIdempotencyKey('booking_pi', {
          company_id: payload.company_id,
          professional_id: payload.professional_id,
          service_id: payload.service_id,
          scheduled_at: payload.scheduled_at,
          customer_phone: payload.customer_phone,
          payment_method: method,
        });
      }

      const clientName = payload.customer_name || payload.client_name || 'Cliente';
      const clientPhone = payload.customer_phone || payload.client_phone || '';
      const clientEmail = payload.customer_email || payload.client_email || '';
      const startTime = payload.scheduled_at || payload.start_time || new Date().toISOString();
      const endTime = payload.end_time || startTime;

      const requestBody = {
        companyId: payload.company_id,
        company_id: payload.company_id,
        serviceId: payload.service_id,
        service_id: payload.service_id,
        professionalId: payload.professional_id,
        professional_id: payload.professional_id,
        customer_id: payload.customer_id,
        clientName,
        client_name: clientName,
        customer_name: clientName,
        clientPhone,
        client_phone: clientPhone,
        customer_phone: clientPhone,
        clientEmail,
        client_email: clientEmail,
        customer_email: clientEmail,
        clientCpf: cpfDigits,
        client_cpf: cpfDigits,
        customer_cpf: cpfDigits,
        price: payload.price,
        startTime,
        start_time: startTime,
        scheduled_at: startTime,
        endTime,
        end_time: endTime,
        date: payload.date,
        time: payload.time,
        notes: payload.notes,
        serviceName: payload.service_name,
        professionalName: payload.professional_name,
        idempotency_key: idemKeyRef.current,
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
        !jsonRes.error &&
        Boolean(realPaymentId && realPaymentId.startsWith('pay_') && !realPaymentId.startsWith('pay_mock_') && !realPaymentId.startsWith('pay_test_')) &&
        Boolean(jsonRes.encodedImage) &&
        Boolean(jsonRes.payload);

      if (!isValidAsaasPayment) {
        setErrorMsg(ASAAS_PIX_ERROR_MSG);
        setStage('error');
        return;
      }

      const normalizedIntent = {
        appointment_id: jsonRes.appointmentId || jsonRes.appointment_id,
        payment_id: realPaymentId,
        paymentId: realPaymentId,
        encodedImage: jsonRes.encodedImage,
        payload: jsonRes.payload,
        pix: {
          paymentId: realPaymentId,
          encodedImage: jsonRes.encodedImage,
          payload: jsonRes.payload,
          copy_paste: jsonRes.payload,
          qr_code_base64: jsonRes.encodedImage,
        },
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      };

      setIntentData(normalizedIntent);
      setStage('pix');
    } catch (_) {
      setErrorMsg(ASAAS_PIX_ERROR_MSG);
      setStage('error');
    }
  };

  const restart = () => {
    setIntentData(null);
    setStage('choose');
    setErrorMsg('');
    idemKeyRef.current = null;
  };

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 mb-5 hover:text-[#1B1C1E]">
        <ChevronLeft className="w-4 h-4" />Voltar
      </button>

      <h2 className="text-xl font-black text-[#1B1C1E] mb-5">Pagamento</h2>

      {/* ─── ESCOLHA DE MÉTODO ─── */}
      {stage === 'choose' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-black/8 p-4">
            <div className="text-[11px] uppercase font-bold text-gray-500 tracking-wide mb-3">Como pagar</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <MethodOption
                active={method === 'pix'}
                primaryColor={primaryColor}
                onClick={() => setMethod('pix')}
                icon={QrCode}
                title="Pix"
                subtitle="Aprovação na hora — pague pelo banco"
              />
              <MethodOption
                active={method === 'card'}
                primaryColor={primaryColor}
                onClick={() => setMethod('card')}
                icon={CreditCard}
                title="Cartão"
                subtitle="Ambiente seguro hospedado pelo Asaas"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-black/8 p-4">
            <label className="text-[11px] uppercase font-bold text-gray-500 tracking-wide block mb-2">CPF do pagador</label>
            <input
              type="text"
              inputMode="numeric"
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              placeholder="000.000.000-00"
              maxLength={14}
              className="w-full px-4 py-3 border border-black/10 rounded-xl text-sm bg-white"
            />
            <p className="text-[11px] text-gray-400 mt-1.5">Necessário para emitir o comprovante de pagamento.</p>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-xl">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{errorMsg}
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={method === 'pix' && cpfDigits.length !== 11}
            className="w-full font-bold py-4 rounded-2xl text-sm transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            style={{ backgroundColor: primaryColor, color: '#FFFFFF' }}
          >
            <span style={{ color: '#FFFFFF' }}>Continuar para pagamento</span>
          </button>
          <p className="text-[11px] text-gray-400 text-center">
            Seu agendamento só é confirmado após o pagamento ser aprovado.
          </p>
        </div>
      )}

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
          companyId={payload?.company_id}
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
            onClick={restart}
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
      <Icon className="w-5 h-5 mb-1.5" style={{ color: active ? primaryColor : '#6B7280' }} />
      <div className="font-bold text-sm text-[#1B1C1E]">{title}</div>
      <div className="text-[11px] text-gray-500 mt-0.5">{subtitle}</div>
    </button>
  );
}