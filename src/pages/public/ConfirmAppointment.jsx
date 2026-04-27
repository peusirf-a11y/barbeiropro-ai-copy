// Página pública: /confirma/:token
// Cliente clica no link do WhatsApp, agendamento vira "confirmado".

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, Calendar, User, Scissors } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { base44 } from '@/api/base44Client';
import Logo from '@/components/Logo';

export default function ConfirmAppointment() {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true, success: false, error: '', data: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await base44.functions.invoke('confirmAppointment', { token });
        if (cancelled) return;
        if (data?.success) {
          setState({ loading: false, success: true, error: '', data });
        } else {
          setState({ loading: false, success: false, error: data?.error || 'Não foi possível confirmar.', data });
        }
      } catch (err) {
        if (cancelled) return;
        setState({ loading: false, success: false, error: err?.response?.data?.error || err.message, data: null });
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const appt = state.data?.appointment;
  const company = state.data?.company;
  const accent = company?.primary_color || '#2563EB';

  return (
    <div className="min-h-screen bg-[#F7F8FB] flex items-center justify-center p-4 font-inter">
      <div className="bg-white rounded-3xl shadow-xl border border-black/5 max-w-md w-full p-8 text-center">
        <div className="flex justify-center mb-6">
          <Logo size={56} />
        </div>

        {state.loading && (
          <>
            <Loader2 className="w-12 h-12 mx-auto animate-spin" style={{ color: accent }} />
            <p className="text-gray-500 mt-4">Confirmando seu agendamento...</p>
          </>
        )}

        {!state.loading && state.success && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-9 h-9 text-green-600" />
            </div>
            <h1 className="text-2xl font-black text-[#0F172A] mb-2">
              {state.data?.already_confirmed ? 'Já estava confirmado!' : 'Agendamento confirmado!'}
            </h1>
            <p className="text-gray-500 text-sm mb-6">
              Te esperamos {company?.name ? `na ${company.name}` : ''}. ✂️
            </p>

            {appt && (
              <div className="bg-[#F7F8FB] rounded-2xl p-5 text-left space-y-3 mb-6">
                <Row icon={User} label="Cliente" value={appt.customer_name} />
                <Row icon={Scissors} label="Serviço" value={`${appt.service_name}${appt.professional_name ? ' · ' + appt.professional_name : ''}`} />
                <Row icon={Calendar} label="Quando" value={format(new Date(appt.scheduled_at), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })} />
              </div>
            )}

            {company?.address && (
              <p className="text-xs text-gray-400 mb-4">📍 {company.address}</p>
            )}
            <Link to="/" className="text-sm font-semibold" style={{ color: accent }}>Ir para o site →</Link>
          </>
        )}

        {!state.loading && !state.success && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-4">
              <XCircle className="w-9 h-9 text-red-500" />
            </div>
            <h1 className="text-2xl font-black text-[#0F172A] mb-2">Não foi possível confirmar</h1>
            <p className="text-gray-500 text-sm mb-6">{state.error}</p>
            {appt && (
              <div className="bg-[#F7F8FB] rounded-2xl p-4 text-left text-xs text-gray-500">
                Agendamento: {appt.customer_name} · {format(new Date(appt.scheduled_at), "d MMM HH:mm", { locale: ptBR })}
              </div>
            )}
            <Link to="/" className="text-sm font-semibold text-[#2563EB] mt-6 inline-block">Voltar ao site →</Link>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0 border border-black/5">
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</div>
        <div className="text-sm font-semibold text-[#0F172A]">{value}</div>
      </div>
    </div>
  );
}