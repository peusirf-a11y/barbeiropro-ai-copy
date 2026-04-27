// Página pública: /avaliar/:token
// Cliente avalia o atendimento de 1 a 5 estrelas + comentário opcional.

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Star, Loader2, CheckCircle2, XCircle, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Logo from '@/components/Logo';

export default function ReviewAppointment() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await base44.functions.invoke('submitReview', { action: 'fetch', token });
        if (cancelled) return;
        if (data?.success) {
          setData(data);
          if (data.existing_review) {
            setSubmitted(true);
            setRating(data.existing_review.rating);
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
    if (rating < 1) return;
    setSubmitting(true);
    setError('');
    try {
      const { data } = await base44.functions.invoke('submitReview', { action: 'submit', token, rating, comment });
      if (data?.success) setSubmitted(true);
      else setError(data?.error || 'Erro ao enviar');
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const accent = data?.company?.primary_color || '#2563EB';

  return (
    <div className="min-h-screen bg-[#F7F8FB] flex items-center justify-center p-4 font-inter">
      <div className="bg-white rounded-3xl shadow-xl border border-black/5 max-w-md w-full p-8 text-center">
        <div className="flex justify-center mb-6">
          <Logo size={56} />
        </div>

        {loading && (
          <>
            <Loader2 className="w-10 h-10 mx-auto animate-spin text-[#2563EB]" />
            <p className="text-gray-500 mt-4 text-sm">Carregando...</p>
          </>
        )}

        {!loading && error && !data && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-4">
              <XCircle className="w-9 h-9 text-red-500" />
            </div>
            <h1 className="text-xl font-black text-[#0F172A] mb-2">Link inválido</h1>
            <p className="text-gray-500 text-sm mb-6">{error}</p>
            <Link to="/" className="text-sm font-semibold text-[#2563EB]">Voltar ao site →</Link>
          </>
        )}

        {!loading && data && submitted && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-9 h-9 text-green-600" />
            </div>
            <h1 className="text-2xl font-black text-[#0F172A] mb-2">Obrigado pela avaliação!</h1>
            <p className="text-gray-500 text-sm mb-6">Sua opinião ajuda muito a {data.company?.name || 'nossa equipe'} a melhorar.</p>
            <div className="flex justify-center gap-1 mb-6">
              {[1, 2, 3, 4, 5].map(n => (
                <Star key={n} className={`w-7 h-7 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
              ))}
            </div>
            {comment && <p className="text-sm text-gray-600 italic">"{comment}"</p>}
          </>
        )}

        {!loading && data && !submitted && (
          <>
            <h1 className="text-2xl font-black text-[#0F172A] mb-2">
              Como foi seu atendimento?
            </h1>
            <p className="text-gray-500 text-sm mb-6">
              {data.appointment?.customer_name?.split(' ')[0]}, sua opinião é muito importante para a {data.company?.name}.
            </p>

            <div className="bg-[#F7F8FB] rounded-2xl p-4 text-sm text-gray-600 mb-6">
              <strong className="text-[#0F172A]">{data.appointment?.service_name}</strong>
              {data.appointment?.professional_name && <> com <strong className="text-[#0F172A]">{data.appointment.professional_name}</strong></>}
            </div>

            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n}
                  onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(n)}
                  className="p-1 transition-transform hover:scale-110">
                  <Star className={`w-10 h-10 transition-colors ${n <= (hover || rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
                </button>
              ))}
            </div>

            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Deixe um comentário (opcional)"
              rows={3}
              className="w-full px-4 py-3 border border-black/10 rounded-xl text-sm resize-none mb-4"
            />

            {error && <div className="text-sm text-red-500 mb-3">{error}</div>}

            <button
              onClick={handleSubmit}
              disabled={rating < 1 || submitting}
              className="w-full text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
              style={{ background: accent }}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {submitting ? 'Enviando...' : 'Enviar avaliação'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}