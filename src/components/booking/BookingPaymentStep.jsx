// Step de pagamento online no fluxo público (/agendar/:slug).
// 1. Tela "Como pagar" (Pix / Cartão + CPF do pagador + botão "Continuar para pagamento").
// 2. Ao apertar "Continuar para pagamento", gera o código Pix no Asaas (/api/appointments/create-pix).
// 3. Verifica se o pagamento foi confirmado no Asaas: se sim, confirma o agendamento no sistema; se não, informa que o pagamento não foi bem-sucedido e bloqueia o avanço.

import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, AlertCircle, RefreshCw, QrCode, CreditCard, Loader2 } from 'lucide-react';
import PixPaymentBox from './PixPaymentBox';
import CardPaymentFormAsaas from './CardPaymentFormAsaas';
import { usePublicTheme } from '@/hooks/usePublicTheme';
import { sanitizeHexColor, getThemeAccent } from '@/lib/colorUtils';

const ASAAS_PIX_ERROR_MSG = 'Não foi possível gerar a cobrança Pix no Asaas. Verifique a chave de API da barbearia.';

function maskCpf(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export default function BookingPaymentStep({ payload, primaryColor = '#2563EB', onBack, onSucceeded }) {
  const { isDark, tw } = usePublicTheme();
  const safeColor = sanitizeHexColor(primaryColor, '#2563EB');
  const accent = getThemeAccent(safeColor, isDark);
  const [stage, setStage] = useState('choose'); // 'choose' | 'creating' | 'pix' | 'card' | 'expired' | 'error'
  const [method, setMethod] = useState('pix');
  const [cpf, setCpf] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [intentData, setIntentData] = useState(null);

  const cpfDigits = cpf.replace(/\D/g, '');

  const buildRequestBody = () => {
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

    return {
      companyId,
      company_id: companyId,
      serviceId,
      service_id: serviceId,
      professionalId,
      professional_id: professionalId,
      customer_id: payload?.customer_id,
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
      price,
      startTime,
      start_time: startTime,
      scheduled_at: startTime,
      endTime,
      end_time: endTime,
      date: payload?.date,
      time: payload?.time,
      duration_minutes: payload?.duration_minutes || 30,
      notes: payload?.notes || '',
      serviceName: payload?.service_name,
      service_name: payload?.service_name,
      professionalName: payload?.professional_name,
      professional_name: payload?.professional_name,
    };
  };

  // Executado quando o cliente aperta "Continuar para pagamento"
  const handleStart = async () => {
    setErrorMsg('');
    if (method === 'card') {
      setStage('card');
      return;
    }

    if (cpfDigits.length !== 11) {
      setErrorMsg('Informe um CPF válido (11 dígitos) para gerar o código Pix.');
      return;
    }

    setStage('creating');
    try {
      const requestBody = buildRequestBody();

      const fetchRes = await fetch('/api/appointments/create-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const jsonRes = await fetchRes.json().catch(() => null);
      const realPaymentId = jsonRes?.paymentId || jsonRes?.payment_id || '';
      const realApptId = jsonRes?.appointmentId || jsonRes?.appointment_id || null;
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
        appointmentId: realApptId,
        appointment_id: realApptId,
        paymentId: realPaymentId,
        payment_id: realPaymentId,
        encodedImage: jsonRes.encodedImage,
        payload: jsonRes.payload,
        bookingPayload: requestBody,
        pix: {
          appointmentId: realApptId,
          paymentId: realPaymentId,
          encodedImage: jsonRes.encodedImage,
          payload: jsonRes.payload,
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
  };

  return (
    <div>
      <button onClick={onBack} className={`flex items-center gap-1 text-sm ${tw.textMuted} mb-4 hover:opacity-80`}>
        <ChevronLeft className="w-4 h-4" />Voltar
      </button>

      {/* ─── ESCOLHA DE MÉTODO (COMO PAGAR + CPF DO PAGADOR + CONTINUAR PARA PAGAMENTO) ─── */}
      {stage === 'choose' && (
        <div className="space-y-3">
          <div className={`${tw.card} rounded-2xl p-4`}>
            <div className={`text-[11px] uppercase font-bold ${tw.textMuted} tracking-wide mb-3`}>Como pagar</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <MethodOption
                active={method === 'pix'}
                isDark={isDark}
                tw={tw}
                primaryColor={accent.bg}
                onClick={() => setMethod('pix')}
                icon={QrCode}
                title="Pix"
                subtitle="Aprovação na hora — pague pelo banco"
              />
              <MethodOption
                active={method === 'card'}
                isDark={isDark}
                tw={tw}
                primaryColor={accent.bg}
                onClick={() => setMethod('card')}
                icon={CreditCard}
                title="Cartão"
                subtitle="Ambiente seguro hospedado pelo Asaas"
              />
            </div>
          </div>

          <div className={`${tw.card} rounded-2xl p-4`}>
            <label className={`text-[11px] uppercase font-bold ${tw.textMuted} tracking-wide block mb-2`}>CPF do pagador</label>
            <input
              type="text"
              inputMode="numeric"
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              placeholder="000.000.000-00"
              maxLength={14}
              className={`w-full px-4 py-3 border rounded-xl text-sm ${tw.input}`}
            />
            <p className={`text-[11px] ${tw.textFaint} mt-1.5`}>Necessário para emitir o comprovante de pagamento.</p>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/25 p-3 rounded-xl">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{errorMsg}
            </div>
          )}

          <button
            type="button"
            onClick={handleStart}
            disabled={method === 'pix' && cpfDigits.length !== 11}
            className="w-full font-bold py-4 rounded-2xl text-sm transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer"
            style={{ backgroundColor: accent.bg, color: accent.fg }}
          >
            <span style={{ color: accent.fg }}>Continuar para pagamento</span>
          </button>
          <p className={`text-[11px] ${tw.textFaint} text-center`}>
            Seu agendamento só é confirmado após o pagamento ser aprovado.
          </p>
        </div>
      )}

      {/* ─── GERANDO CÓDIGO PIX NO ASAAS ─── */}
      {stage === 'creating' && (
        <div className={`${tw.card} rounded-2xl p-10 flex flex-col items-center justify-center`}>
          <Loader2 className="w-8 h-8 animate-spin text-[#2563EB] mb-3" />
          <p className={`text-sm font-medium ${tw.text}`}>Gerando código Pix…</p>
          <p className={`text-xs ${tw.textMuted} mt-1`}>Conectando ao Asaas para emitir o QR Code</p>
        </div>
      )}

      {/* ─── TELA DO PIX (QR CODE + COPIA E COLA + VERIFICAÇÃO) ─── */}
      {stage === 'pix' && intentData && (
        <PixPaymentBox
          appointmentId={intentData.appointment_id}
          paymentId={intentData.payment_id}
          pixData={intentData.pix}
          bookingPayload={intentData.bookingPayload}
          expiresAt={intentData.expires_at}
          primaryColor={primaryColor}
          companyId={payload?.companyId || payload?.company_id}
          onPaid={(confirmedData) =>
            onSucceeded?.({
              ...intentData,
              appointment_id: confirmedData?.appointmentId || intentData.appointment_id,
              appointment: confirmedData?.appointment || null,
            })
          }
          onExpired={() => setStage('expired')}
        />
      )}

      {/* ─── CARTÃO ─── */}
      {stage === 'card' && (
        <div className="bg-white rounded-2xl border border-black/8 p-5">
          <CardPaymentFormAsaas
            primaryColor={primaryColor}
            amountLabel={payload.price ? `Pagar R$ ${Number(payload.price).toFixed(2).replace('.', ',')}` : 'Pagar agora'}
            defaultCpf={cpfDigits || payload.customer_cpf || ''}
            defaultName={payload.customer_name}
            defaultEmail={payload.customer_email}
            defaultPhone={payload.customer_phone}
            onSubmit={async (card) => {
              const bookingBody = buildRequestBody();
              const res = await fetch('/api/appointments/create-card', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'card',
                  companyId: bookingBody.companyId,
                  company_id: bookingBody.companyId,
                  booking: bookingBody,
                  card,
                }),
              });
              const data = await res.json().catch(() => null);
              const statusUpper = String(data?.status || '').toUpperCase();
              if (!res.ok || !data?.success || !['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(statusUpper)) {
                throw new Error(
                  data?.message ||
                  data?.error ||
                  'O pagamento não foi bem-sucedido. Verifique os dados do cartão e tente novamente.'
                );
              }
              const finalApptId = data.appointmentId || data.appointment_id || payload.appointment_id;
              const targetCompanyId = bookingBody.companyId;
              if (finalApptId && targetCompanyId) {
                try {
                  const rawSaved = localStorage.getItem(`bt_my_appointments_${targetCompanyId}`) || '[]';
                  const list = JSON.parse(rawSaved);
                  if (!list.includes(finalApptId)) {
                    list.unshift(finalApptId);
                    localStorage.setItem(`bt_my_appointments_${targetCompanyId}`, JSON.stringify(list));
                  }
                } catch (_) {}
              }
              onSucceeded?.({
                appointment_id: finalApptId,
                appointment: data.appointment || null,
              });
            }}
          />
        </div>
      )}

      {/* ─── EXPIROU ─── */}
      {stage === 'expired' && (
        <div className="bg-white rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <h3 className="font-bold text-amber-900 mb-1">Tempo esgotado</h3>
          <p className="text-sm text-amber-800 mb-4">O pagamento não foi confirmado dentro do prazo. Você pode gerar um novo código Pix.</p>
          <button
            onClick={restart}
            className="inline-flex items-center gap-2 bg-white text-amber-700 border border-amber-300 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-amber-100"
          >
            <RefreshCw className="w-4 h-4" /> Tentar novamente
          </button>
        </div>
      )}

      {/* ─── ERRO EM VERMELHO ─── */}
      {stage === 'error' && (
        <div className="bg-red-50 rounded-2xl border border-red-300 p-5 text-center">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
          <h3 className="font-bold text-red-900 mb-1">Não foi possível gerar o Pix</h3>
          <p className="text-sm font-medium text-red-700 mb-4">{errorMsg || ASAAS_PIX_ERROR_MSG}</p>
          <button
            onClick={restart}
            className="inline-flex items-center gap-2 bg-white text-red-700 border border-red-300 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-red-100"
          >
            <RefreshCw className="w-4 h-4" /> Voltar e tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}

function MethodOption({ active, isDark, tw, primaryColor, onClick, icon: Icon, title, subtitle }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left px-4 py-3 rounded-xl border transition-all cursor-pointer ${
        active
          ? 'border-2 shadow-sm'
          : isDark
          ? 'border-[rgba(255,255,255,0.14)] hover:border-[rgba(255,255,255,0.28)]'
          : 'border-black/10 hover:border-gray-300'
      }`}
      style={active ? { borderColor: primaryColor, backgroundColor: `${primaryColor}14` } : {}}
    >
      <Icon className="w-5 h-5 mb-1.5" style={{ color: active ? primaryColor : isDark ? 'rgba(255,255,255,0.65)' : '#6B7280' }} />
      <div className={`font-bold text-sm ${tw?.text || ''}`}>{title}</div>
      <div className={`text-[11px] ${tw?.textMuted || 'text-gray-500'} mt-0.5`}>{subtitle}</div>
    </button>
  );
}