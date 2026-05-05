import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Scissors, Check, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import Logo from '@/components/Logo';
import { useNavigate } from 'react-router-dom';
import BusinessDetailsStep, { isBusinessDetailsValid } from '@/components/onboarding/BusinessDetailsStep';

function sanitizeSlug(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 40);
}

const RESERVED_SLUGS = ['app', 'api', 'admin', 'master', 'checkout', 'onboarding', 'agendar', 'demo', 'login', 'logout', 'termos-de-uso', 'politica-de-privacidade'];

const STEPS = [
  { id: 1, title: 'Dados da barbearia', sub: 'Informações básicas do negócio' },
  { id: 2, title: 'Branding', sub: 'Identidade visual e link público' },
  { id: 3, title: 'Dados fiscais & endereço', sub: 'Necessários para pagamentos online' },
  { id: 4, title: 'Serviços iniciais', sub: 'Configure seus primeiros serviços' },
  { id: 5, title: 'Profissionais', sub: 'Adicione os barbeiros' },
  { id: 6, title: 'Equipe', sub: 'Quem vai acessar o sistema' },
  { id: 7, title: 'Conclusão', sub: 'Sua barbearia está pronta!' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [company, setCompany] = useState({ name: '', phone: '', whatsapp: '', address: '', slug: '', primary_color: '#2563EB' });
  const [businessDetails, setBusinessDetails] = useState({
    business_type: '',
    phone: '',
    address_details: { line1: '', line2: '', neighborhood: '', city: '', state: '', postal_code: '', country: 'BR' },
  });
  const [services, setServices] = useState([{ name: 'Corte Clássico', duration_minutes: 30, price: 45 }]);
  const [professionals, setProfessionals] = useState([{ name: '', specialty: '' }]);
  const [companyId, setCompanyId] = useState(null);
  const [slugError, setSlugError] = useState('');
  const [validatingSlug, setValidatingSlug] = useState(false);

  const validateSlug = async (slug) => {
    const clean = sanitizeSlug(slug);
    if (!clean || clean.length < 3) {
      setSlugError('Slug deve ter ao menos 3 caracteres');
      return false;
    }
    if (RESERVED_SLUGS.includes(clean)) {
      setSlugError('Este slug é reservado, escolha outro');
      return false;
    }
    setValidatingSlug(true);
    try {
      const existing = await base44.entities.Company.filter({ slug: clean });
      const taken = existing.some(c => c.id !== companyId);
      if (taken) {
        setSlugError('Este link já está em uso, tente outro');
        setValidatingSlug(false);
        return false;
      }
    } catch (e) { /* ignore */ }
    setSlugError('');
    setValidatingSlug(false);
    return true;
  };

  const createCompanyMutation = useMutation({
    mutationFn: (data) => base44.entities.Company.create(data),
    onSuccess: (result) => {
      setCompanyId(result.id);
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: (data) => base44.entities.Service.create(data),
  });

  const createProMutation = useMutation({
    mutationFn: (data) => base44.entities.Professional.create(data),
  });

  const handleNext = async () => {
    if (step === 2) {
      const ok = await validateSlug(company.slug);
      if (!ok) return;
      const cleanSlug = sanitizeSlug(company.slug);
      if (!companyId) {
        const result = await createCompanyMutation.mutateAsync({
          ...company,
          slug: cleanSlug,
          status: 'active',
          onboarding_step: 2,
          onboarding_completed: false,
        });
        setCompanyId(result.id);
      } else {
        await base44.entities.Company.update(companyId, { slug: cleanSlug, onboarding_step: 3 });
      }
    }
    // Step 3 (novo): persiste dados fiscais + endereço estruturado na Company.
    // Também copia phone para Company.phone se ainda estiver vazio, e monta
    // address (string legacy) a partir do endereço estruturado.
    if (step === 3 && companyId) {
      const a = businessDetails.address_details || {};
      const legacyAddress = [
        [a.line1, a.line2].filter(Boolean).join(', '),
        a.neighborhood,
        a.city && a.state ? `${a.city}/${a.state}` : (a.city || a.state),
        a.postal_code,
      ].filter(Boolean).join(' · ');
      await base44.entities.Company.update(companyId, {
        business_type: businessDetails.business_type,
        phone: businessDetails.phone || company.phone || '',
        address_details: businessDetails.address_details,
        address: legacyAddress,
        onboarding_step: 4,
      });
    }
    if (step === 4 && companyId) {
      // Paralelizado: todas as criações ao mesmo tempo
      await Promise.all(
        services.filter(s => s.name).map(s =>
          createServiceMutation.mutateAsync({ ...s, company_id: companyId, active: true })
        )
      );
    }
    if (step === 5 && companyId) {
      // Paralelizado
      await Promise.all(
        professionals.filter(p => p.name).map(p =>
          createProMutation.mutateAsync({ ...p, company_id: companyId, active: true })
        )
      );
    }

    // Tracking fire-and-forget — não trava a navegação
    base44.functions.invoke('trackEvent', {
      event_type: 'onboarding_step_completed',
      metadata: { step },
    }).catch(() => {});

    if (step === 7) {
      // Marca como concluído SOMENTE no clique final, e invalida cache antes de navegar
      if (companyId) {
        await base44.entities.Company.update(companyId, {
          onboarding_completed: true,
          onboarding_step: 7,
        });
      }
      base44.functions.invoke('trackEvent', { event_type: 'onboarding_completed' }).catch(() => {});

      // Invalida todos os caches que decidem onboarding/redirect
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['companies'] }),
        queryClient.invalidateQueries({ queryKey: ['companies-onboarding'] }),
        queryClient.invalidateQueries({ queryKey: ['private-route-company'] }),
        queryClient.invalidateQueries({ queryKey: ['my-company'] }),
      ]);

      navigate('/app/dashboard');
      return;
    }
    setStep(s => s + 1);
  };

  return (
    <div className="min-h-screen bg-[#F8F7F3] flex flex-col lg:flex-row font-inter">
      {/* Sidebar */}
      <div className="w-full lg:w-72 bg-gradient-to-b from-[#2563EB] to-[#60A5FA] lg:min-h-screen p-6 lg:p-8 flex flex-col">
        <div className="flex items-center gap-2 mb-6 lg:mb-12">
          <Logo size={44} />
          <span className="font-black text-white tracking-[0.14em] text-lg">O CORTE</span>
        </div>
        <div className="space-y-2 hidden lg:block">
          {STEPS.map(s => (
            <div key={s.id} className={`flex items-start gap-3 p-3 rounded-xl transition-all ${s.id === step ? 'bg-white/15' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold transition-all ${s.id < step ? 'bg-white/90 text-[#2563EB]' : s.id === step ? 'bg-white text-[#2563EB]' : 'bg-white/20 text-white/50'}`}>
                {s.id < step ? <Check className="w-3.5 h-3.5" /> : s.id}
              </div>
              <div>
                <div className={`text-sm font-semibold ${s.id <= step ? 'text-white' : 'text-white/40'}`}>{s.title}</div>
                <div className={`text-xs mt-0.5 ${s.id === step ? 'text-white/70' : 'text-white/30'}`}>{s.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 p-6 sm:p-8 lg:p-12 flex flex-col">
        <div className="max-w-lg flex-1 w-full">
          <div className="mb-8">
            <div className="text-xs font-semibold text-[#2563EB] uppercase tracking-widest mb-2">Etapa {step} de {STEPS.length}</div>
            <h1 className="text-3xl font-black text-[#1B1C1E]">{STEPS[step - 1].title}</h1>
            <p className="text-gray-500 mt-1">{STEPS[step - 1].sub}</p>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              {[
                { label: 'Nome da barbearia *', key: 'name', placeholder: 'Ex: Barbearia Studio 47' },
                { label: 'Telefone', key: 'phone', placeholder: '(11) 99999-9999' },
                { label: 'WhatsApp', key: 'whatsapp', placeholder: '11999999999' },
                { label: 'Endereço', key: 'address', placeholder: 'Rua, número, bairro, cidade' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">{f.label}</label>
                  <input type="text" value={company[f.key]} onChange={e => setCompany(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full px-4 py-3 border border-black/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 bg-white" />
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Slug (URL pública) *</label>
                <div className="flex items-center bg-white border border-black/10 rounded-xl overflow-hidden">
                  <span className="px-4 py-3 text-gray-400 text-sm border-r border-black/10 bg-gray-50">/agendar/</span>
                  <input type="text" value={company.slug}
                    onChange={e => { setCompany(p => ({ ...p, slug: sanitizeSlug(e.target.value) })); setSlugError(''); }}
                    onBlur={e => validateSlug(e.target.value)}
                    placeholder="studio47"
                    className="flex-1 px-4 py-3 text-sm focus:outline-none" />
                </div>
                {company.slug && !slugError && <p className="text-xs text-[#2563EB] mt-1">Link: {window.location.origin}/agendar/{company.slug}</p>}
                {slugError && <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{slugError}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Cor principal</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={company.primary_color} onChange={e => setCompany(p => ({ ...p, primary_color: e.target.value }))}
                    className="w-12 h-12 rounded-xl border border-black/10 cursor-pointer" />
                  <div>
                    <div className="text-sm font-semibold text-[#1B1C1E]">{company.primary_color}</div>
                    <div className="text-xs text-gray-400">Cor dos botões e destaques no link público</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <BusinessDetailsStep value={businessDetails} onChange={setBusinessDetails} />
          )}

          {step === 4 && (
            <div className="space-y-3">
              {services.map((s, i) => (
                <div key={i} className="bg-white rounded-xl border border-black/10 p-4">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Nome</label>
                      <input type="text" value={s.name} onChange={e => setServices(arr => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                        className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Preço (R$)</label>
                      <input type="number" value={s.price} onChange={e => setServices(arr => arr.map((x, j) => j === i ? { ...x, price: +e.target.value } : x))}
                        className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm focus:outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">Duração (min)</label>
                    <input type="number" value={s.duration_minutes} onChange={e => setServices(arr => arr.map((x, j) => j === i ? { ...x, duration_minutes: +e.target.value } : x))}
                      className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm focus:outline-none" />
                  </div>
                </div>
              ))}
              <button onClick={() => setServices(p => [...p, { name: '', duration_minutes: 30, price: 0 }])}
                className="w-full py-2.5 border-2 border-dashed border-black/15 rounded-xl text-sm text-gray-400 hover:border-[#2563EB] hover:text-[#2563EB] transition-colors">
                + Adicionar serviço
              </button>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              {professionals.map((p, i) => (
                <div key={i} className="bg-white rounded-xl border border-black/10 p-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">Nome</label>
                    <input type="text" value={p.name} onChange={e => setProfessionals(arr => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                      className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">Especialidade</label>
                    <input type="text" value={p.specialty} onChange={e => setProfessionals(arr => arr.map((x, j) => j === i ? { ...x, specialty: e.target.value } : x))}
                      className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm focus:outline-none" />
                  </div>
                </div>
              ))}
              <button onClick={() => setProfessionals(p => [...p, { name: '', specialty: '' }])}
                className="w-full py-2.5 border-2 border-dashed border-black/15 rounded-xl text-sm text-gray-400 hover:border-[#2563EB] hover:text-[#2563EB] transition-colors">
                + Adicionar profissional
              </button>
            </div>
          )}

          {step === 6 && (
            <div className="bg-white rounded-2xl border border-black/8 p-6 text-center">
              <p className="text-gray-500 text-sm">Você pode convidar membros da equipe mais tarde em <strong>Equipe</strong> no painel.</p>
            </div>
          )}

          {step === 7 && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-black text-[#1B1C1E] mb-3">Tudo pronto!</h2>
              <p className="text-gray-500 mb-6">Sua barbearia está configurada e o link público de agendamento está ativo.</p>
              {company.slug && (
                <div className="bg-[#2563EB]/5 border border-[#2563EB]/20 rounded-xl p-4 text-sm text-[#2563EB] font-medium mb-6">
                  {window.location.origin}/agendar/{company.slug}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-8 max-w-lg w-full">
          {step > 1 ? (
            <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#1B1C1E]">
              <ArrowLeft className="w-4 h-4" />Voltar
            </button>
          ) : <div />}
          <button onClick={handleNext}
            disabled={
              (step === 1 && !company.name) ||
              (step === 2 && (!company.slug || !!slugError || validatingSlug)) ||
              (step === 3 && !isBusinessDetailsValid(businessDetails))
            }
            className="flex items-center gap-2 bg-[#2563EB] text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-[#2563EB]/90 disabled:opacity-50 transition-colors">
            {step === 7 ? 'Acessar o painel' : 'Continuar'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}