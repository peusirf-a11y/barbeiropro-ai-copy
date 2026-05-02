// Etapa única de identificação obrigatória — rege o fluxo do agendamento público.
// Pede APENAS o telefone primeiro. Após validação, busca o cliente:
//   - Se existir: pula direto para o próximo passo (sem cadastro).
//   - Se não existir: libera campos Nome (obrigatório) + Email (opcional).
//
// Regras:
//   - Foco automático no telefone (mobile-first).
//   - Bloqueia "Continuar" se telefone inválido (DDD + número, mín. 10 dígitos).
//   - Lookup automático com debounce; emite onIdentified(customer | null).
//   - Persistência (criação/atualização do Customer) é responsabilidade do parent
//     ao confirmar o agendamento — aqui apenas identificamos.

import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Phone, Check, AlertCircle, ChevronRight, User } from 'lucide-react';

// Máscara BR: (11) 99999-9999 / (11) 9999-9999
function formatPhoneBR(raw) {
  const d = String(raw || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function isValidPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  return d.length >= 10 && d.length <= 11;
}

export default function PhoneIdentificationStep({
  companyId,
  scopeUnitId,        // quando customers_shared=false, restringe lookup à unidade
  primaryColor = '#2563EB',
  initialPhone = '',
  initialName = '',
  initialEmail = '',
  onContinue,         // ({ phone, name, email, existingCustomer }) => void
}) {
  const [phone, setPhone] = useState(formatPhoneBR(initialPhone));
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [lookupState, setLookupState] = useState('idle'); // idle | searching | found | new
  const [existing, setExisting] = useState(null);
  const [error, setError] = useState('');
  const phoneRef = useRef(null);
  const nameRef = useRef(null);

  const phoneDigits = phone.replace(/\D/g, '');
  const phoneValid = isValidPhone(phone);

  // Foco automático mobile-first
  useEffect(() => {
    phoneRef.current?.focus();
  }, []);

  // Lookup automático com debounce de 350ms quando o telefone fica válido
  useEffect(() => {
    if (!companyId || !phoneValid) {
      setLookupState('idle');
      setExisting(null);
      return;
    }
    let cancelled = false;
    setLookupState('searching');
    const t = setTimeout(async () => {
      try {
        const filter = { company_id: companyId, phone: phoneDigits };
        if (scopeUnitId) filter.unit_id = scopeUnitId;
        const matches = await base44.entities.Customer.filter(filter, '-created_date', 1);
        if (cancelled) return;
        const found = matches?.[0] || null;
        if (found) {
          setExisting(found);
          setName(found.name || '');
          setEmail(found.email || '');
          setLookupState('found');
        } else {
          setExisting(null);
          setLookupState('new');
          // Foca no nome para acelerar conversão
          setTimeout(() => nameRef.current?.focus(), 50);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[PhoneIdentification] lookup falhou:', err.message);
          setLookupState('new');
        }
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [companyId, scopeUnitId, phoneDigits, phoneValid]);

  const canContinue =
    phoneValid &&
    (lookupState === 'found' || (lookupState === 'new' && name.trim().length >= 2));

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    if (!phoneValid) {
      setError('Informe um telefone válido com DDD.');
      phoneRef.current?.focus();
      return;
    }
    if (lookupState !== 'found' && !name.trim()) {
      setError('Informe seu nome para continuar.');
      nameRef.current?.focus();
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Informe um e-mail válido.');
      return;
    }
    setError('');
    onContinue?.({
      phone: phoneDigits,
      name: (existing?.name || name).trim(),
      email: (email || existing?.email || '').trim(),
      existingCustomer: existing,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md" style={{ backgroundColor: primaryColor }}>
          <Phone className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-2xl font-black text-[#111827] tracking-tight mb-1.5">Vamos começar</h2>
        <p className="text-sm text-[#6B7280]">Informe seu WhatsApp para identificar seu cadastro</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-[#6B7280] block mb-1.5">WhatsApp / Telefone *</label>
          <input
            ref={phoneRef}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(e) => { setPhone(formatPhoneBR(e.target.value)); setError(''); }}
            placeholder="(11) 99999-9999"
            className="w-full px-4 py-3.5 border border-black/10 rounded-xl text-base font-medium bg-white"
          />
          {phoneValid && lookupState === 'searching' && (
            <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1.5">
              <span className="w-3 h-3 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
              Buscando seu cadastro…
            </p>
          )}
        </div>

        {/* Cliente existente — mostra confirmação compacta no topo */}
        {lookupState === 'found' && existing && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3 animate-fade-in">
            <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <Check className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Bem-vindo de volta</div>
              <div className="font-bold text-[#111827] text-base truncate">{existing.name}</div>
              {existing.total_appointments ? (
                <div className="text-[11px] text-emerald-700 mt-0.5">
                  {existing.total_appointments} {existing.total_appointments === 1 ? 'agendamento' : 'agendamentos'} no histórico
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Cliente novo — libera Nome (obrigatório) + Email (opcional) */}
        {lookupState === 'new' && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
              <User className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-blue-800 leading-relaxed">
                <span className="font-semibold">Primeira vez aqui?</span> Preencha seus dados para criarmos seu cadastro.
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-[#6B7280] block mb-1.5">Seu nome *</label>
              <input
                ref={nameRef}
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                placeholder="Como você se chama?"
                className="w-full px-4 py-3.5 border border-black/10 rounded-xl text-base bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#6B7280] block mb-1.5">E-mail (opcional)</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="seu@email.com"
                className="w-full px-4 py-3.5 border border-black/10 rounded-xl text-base bg-white"
              />
              <p className="text-[11px] text-gray-400 mt-1.5">Para você receber a confirmação por e-mail.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}

        <button
          type="submit"
          disabled={!canContinue}
          className="w-full text-white font-bold py-4 rounded-2xl text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-1.5"
          style={{ backgroundColor: primaryColor }}
        >
          Continuar
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}