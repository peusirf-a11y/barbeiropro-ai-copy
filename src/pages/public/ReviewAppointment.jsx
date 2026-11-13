// Página pública: /avaliar/:token
// Fluxo de avaliação em 3 passos (mobile-first, touch-friendly):
//   1. NPS 0-10 (botões grandes, escala vermelho->verde)
//   2. 4 ratings em estrelas (atendimento/qualidade/ambiente/pontualidade) — opcionais
//   3. Comentário (opcional) + envio
// Tela final: agradecimento + botão "Avaliar no Google" se NPS>=9 e Company tem review_link.
//
// Backward compatible: o backend aceita payload antigo (rating 1-5). Mas a UI nova sempre envia NPS.

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Star, Loader2, CheckCircle2, XCircle, Send, ChevronRight, ChevronLeft, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Logo from '@/components/Logo';
import { sanitizeHexColor } from '@/lib/colorUtils';

// Escala NPS visual: 0-6 detrator (vermelho), 7-8 passivo (âmbar), 9-10 promotor (verde).
const NPS_COLORS = {
  detractor: { bg: 'bg-red-50', ring: 'ring-red-200', text: 'text-red-700', active: 'bg-red-500 text-white shadow-lg' },
  passive:   { bg: 'bg-amber-50', ring: 'ring-amber-200', text: 'text-amber-700', active: 'bg-amber-500 text-white shadow-lg' },
  promoter:  { bg: 'bg-emerald-50', ring: 'ring-emerald-200', text: 'text-emerald-700', active: 'bg-emerald-500 text-white shadow-lg' },
};
const npsBucket = (n) => (n <= 6 ? 'detractor' : n <= 8 ? 'passive' : 'promoter');
const NPS_LABEL = {
  detractor: 'Pode melhorar',
  passive:   'Foi bom',
  promoter:  'Adorei!',
};

const RATING_QUESTIONS = [
  { key: 'service_rating',     label: 'Qualidade do serviço', emoji: '✂️' },
  { key: 'punctuality_rating', label: 'Pontualidade',         emoji: '⏰' },
  { key: 'environment_rating', label: 'Ambiente',             emoji: '🪑' },
];

export default function ReviewAppointment() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  // Wizard: 'nps' -> 'ratings' -> 'comment' -> submitted
  const [step, setStep] = useState('nps');
  const [nps, setNps] = useState(null);
  const [ratings, setRatings] = useState({ service_rating: 0, punctuality_rating: 0, environment_rating: 0 });
  const [comment, setComment] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [googleReviewUrl, setGoogleReviewUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await base44.functions.invoke('submitReview', { action: 'fetch', token });
        if (cancelled) return;
        // Sempre salva dados da empresa/agendamento se disponíveis (para mostrar logo mesmo no erro)
        if (data?.appointment || data?.company) {
          setData(data);
        }
        if (data?.success) {
          if (data.google_review_url) setGoogleReviewUrl(data.google_review_url);
          if (data.existing_review) {
            // Review já enviada — mostra direto o sucesso.
            setSubmitted(true);
            if (data.existing_review.nps_score != null) setNps(data.existing_review.nps_score);
            setComment(data.existing_review.comment || '');
          }
        } else {
          setError(data?.error || 'Link inválido');
        }
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.error || err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleSubmit = async () => {
    if (nps == null) return;
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        action: 'submit',
        token,
        nps_score: nps,
        comment,
        ...ratings,
      };
      const { data } = await base44.functions.invoke('submitReview', payload);
      if (data?.success) {
        setSubmitted(true);
        if (data.google_review_url) setGoogleReviewUrl(data.google_review_url);
      } else {
        setError(data?.error || 'Erro ao enviar');
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const accent = sanitizeHexColor(data?.company?.primary_color, '#2563EB');
  const customerFirstName = data?.appointment?.customer_name?.split(' ')[0] || '';

  // --- Renderização --- //

  if (loading) {
    return (
      <Shell>
        <div className="py-12 text-center">
          <Loader2 className="w-10 h-10 mx-auto animate-spin text-[#2563EB]" strokeWidth={1.75} />
          <p className="text-[#55596A] dark:text-white/60 mt-4 text-sm">Carregando...</p>
        </div>
      </Shell>
    );
  }

  if (error && !data) {
    return (
      <Shell>
        <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
          <XCircle className="w-9 h-9 text-rose-600 dark:text-rose-400" strokeWidth={1.75} />
        </div>
        <h1 className="text-xl font-black text-[#171827] dark:text-white mb-2 text-center">Link inválido</h1>
        <p className="text-[#55596A] dark:text-white/60 text-sm mb-6 text-center">{error}</p>
        <div className="text-center">
          <Link to="/" className="text-sm font-semibold text-[#2563EB] hover:underline">Voltar ao site →</Link>
        </div>
      </Shell>
    );
  }

  if (submitted) {
    return (
      <Shell company={data?.company}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-9 h-9 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
          </div>
          <h1 className="text-2xl font-black text-[#171827] dark:text-white mb-2">Obrigado pelo feedback 🙌</h1>
          <p className="text-[#55596A] dark:text-white/60 text-sm mb-6">
            Sua opinião ajuda a {data?.company?.name || 'nossa equipe'} a melhorar.
          </p>
          {googleReviewUrl && (
            <a
              href={googleReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 text-white font-bold py-3.5 rounded-xl transition-all hover:opacity-95 active:scale-[0.98] shadow-sm mb-3"
              style={{ background: accent }}
            >
              <ExternalLink className="w-4 h-4" strokeWidth={1.75} /> Avaliar no Google
            </a>
          )}
        </div>
      </Shell>
    );
  }

  // --- Wizard --- //
  return (
    <Shell company={data?.company}>
      {/* Resumo do atendimento */}
      <div className="bg-[#F1F2F7] dark:bg-[#0F101A] border border-[#E5E7EF] dark:border-[#232538] rounded-2xl p-4 text-sm text-[#55596A] dark:text-white/70 mb-5 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[#171827] dark:text-white truncate">{data?.appointment?.service_name}</div>
          {data?.appointment?.professional_name && (
            <div className="text-xs text-[#55596A] dark:text-white/50 truncate">com {data.appointment.professional_name}</div>
          )}
        </div>
      </div>

      {step === 'nps' && (
        <StepNps
          customerFirstName={customerFirstName}
          companyName={data?.company?.name}
          value={nps}
          onChange={setNps}
          onNext={() => setStep('ratings')}
          accent={accent}
        />
      )}

      {step === 'ratings' && (
        <StepRatings
          ratings={ratings}
          onChange={setRatings}
          onBack={() => setStep('nps')}
          onNext={() => setStep('comment')}
          accent={accent}
        />
      )}

      {step === 'comment' && (
        <StepComment
          comment={comment}
          onChange={setComment}
          onBack={() => setStep('ratings')}
          onSubmit={handleSubmit}
          submitting={submitting}
          error={error}
          accent={accent}
        />
      )}
    </Shell>
  );
}

// ---------- Shell (cabeçalho + container) ---------- //

function Shell({ company, children }) {
  return (
    <div className="min-h-screen bg-[#F1F2F7] dark:bg-[#0F101A] flex items-center justify-center p-4 font-inter text-[#171827] dark:text-white">
      <div className="bg-white dark:bg-[#171827] rounded-3xl shadow-sm border border-[#E5E7EF] dark:border-[#232538] max-w-md w-full p-6 sm:p-8">
        <div className="flex flex-col items-center mb-6">
          {company?.logo_url ? (
            <img
              src={company.logo_url}
              alt={company.name}
              className="w-16 h-16 rounded-2xl object-cover mb-2 ring-1 ring-black/5"
            />
          ) : (
            <Logo size={56} />
          )}
          {company?.name && (
            <div className="text-sm font-bold text-[#171827] dark:text-white mt-2">{company.name}</div>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Step 1: NPS ---------- //

function StepNps({ customerFirstName, companyName, value, onChange, onNext, accent }) {
  return (
    <>
      <h1 className="text-xl sm:text-2xl font-black text-[#171827] dark:text-white mb-2 text-center">
        {customerFirstName ? `${customerFirstName}, ` : ''}como foi sua experiência?
      </h1>
      <p className="text-[#55596A] dark:text-white/60 text-sm mb-6 text-center">
        De 0 a 10, quanto você indicaria <strong>{companyName || 'a barbearia'}</strong> para um amigo?
      </p>

      {/* Grid 0-10 — 2 linhas no mobile, 1 no desktop */}
      <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5 mb-3">
        {Array.from({ length: 11 }, (_, n) => {
          const bucket = npsBucket(n);
          const colors = NPS_COLORS[bucket];
          const isActive = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`aspect-square rounded-xl font-bold text-base sm:text-sm tabular-nums transition-all active:scale-95 cursor-pointer ${
                isActive
                  ? colors.active
                  : `${colors.bg} ring-1 ${colors.ring} ${colors.text} hover:scale-105`
              }`}
              aria-label={`Nota ${n}`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-[#55596A] dark:text-white/40 px-1 mb-6">
        <span>Nada provável</span>
        <span>Muito provável</span>
      </div>

      {value != null && (
        <div className={`text-center text-sm font-semibold mb-4 ${NPS_COLORS[npsBucket(value)].text}`}>
          {NPS_LABEL[npsBucket(value)]}
        </div>
      )}

      <button
        type="button"
        onClick={onNext}
        disabled={value == null}
        className="w-full text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 transition-all active:scale-[0.98] shadow-sm cursor-pointer"
        style={{ background: accent }}
      >
        Continuar <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
      </button>
    </>
  );
}

// ---------- Step 2: Ratings ---------- //

function StepRatings({ ratings, onChange, onBack, onNext, accent }) {
  const update = (key, val) => onChange({ ...ratings, [key]: val });
  return (
    <>
      <h2 className="text-xl font-black text-[#171827] dark:text-white mb-1 text-center">Quase lá!</h2>
      <p className="text-[#55596A] dark:text-white/60 text-sm mb-6 text-center">
        Como você avalia cada ponto? <span className="text-[#55596A]/60 dark:text-white/40">(opcional)</span>
      </p>

      <div className="space-y-5 mb-6">
        {RATING_QUESTIONS.map(q => (
          <div key={q.key}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{q.emoji}</span>
              <span className="text-sm font-semibold text-[#171827] dark:text-white">{q.label}</span>
            </div>
            <div className="flex justify-between gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => update(q.key, n)}
                  className="flex-1 p-2 transition-transform active:scale-90 cursor-pointer"
                  aria-label={`${q.label}: ${n} estrelas`}
                >
                  <Star className={`w-7 h-7 mx-auto transition-colors ${
                    n <= ratings[q.key] ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-white/10'
                  }`} strokeWidth={1.75} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-3.5 rounded-xl border border-[#E5E7EF] dark:border-[#232538] bg-slate-50 dark:bg-white/[0.04] text-[#171827] dark:text-white font-semibold flex items-center gap-1 active:scale-[0.98] cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm cursor-pointer"
          style={{ background: accent }}
        >
          Continuar <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </div>
    </>
  );
}

// ---------- Step 3: Comment ---------- //

function StepComment({ comment, onChange, onBack, onSubmit, submitting, error, accent }) {
  return (
    <>
      <h2 className="text-xl font-black text-[#171827] dark:text-white mb-1 text-center">Quer deixar um comentário?</h2>
      <p className="text-[#55596A] dark:text-white/60 text-sm mb-6 text-center">
        Conta o que você achou. <span className="text-[#55596A]/60 dark:text-white/40">(opcional)</span>
      </p>

      <textarea
        value={comment}
        onChange={e => onChange(e.target.value.slice(0, 1000))}
        placeholder="Escreva aqui..."
        rows={5}
        className="w-full px-4 py-3 border border-[#E5E7EF] dark:border-[#232538] bg-slate-50 dark:bg-white/[0.04] text-[#171827] dark:text-white rounded-xl text-sm resize-none mb-1 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all"
        maxLength={1000}
      />
      <div className="text-[10px] text-[#55596A] dark:text-white/40 text-right mb-4 tabular-nums">{comment.length}/1000</div>

      {error && <div className="text-sm text-rose-500 mb-3 text-center">{error}</div>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="px-4 py-3.5 rounded-xl border border-[#E5E7EF] dark:border-[#232538] bg-slate-50 dark:bg-white/[0.04] text-[#171827] dark:text-white font-semibold disabled:opacity-40 active:scale-[0.98] cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="flex-1 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 transition-all active:scale-[0.98] shadow-sm cursor-pointer"
          style={{ background: accent }}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} /> : <Send className="w-4 h-4" strokeWidth={1.75} />}
          {submitting ? 'Enviando...' : 'Enviar avaliação'}
        </button>
      </div>
    </>
  );
}