import { useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '@/components/Logo';
import { CheckCircle, ArrowLeft, Shield, Star, Zap, Lock, Rocket } from 'lucide-react';
import CardPaymentFormAsaas from '@/components/booking/CardPaymentFormAsaas';
import { usePublicPlans } from '@/hooks/usePublicPlans';

// Oferta de lançamento: R$ 49/mês durante os primeiros 6 meses, depois preço cheio do plano Pro.
const LAUNCH_PROMO = {
  code: 'lancamento',
  price: 49,
  durationMonths: 6,
  plan: 'pro',
};

function getPromoFromUrl() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('promo') === LAUNCH_PROMO.code ? LAUNCH_PROMO : null;
}

function planKeyFromName(name) {
  const n = String(name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (n.includes('starter')) return 'starter';
  if (n.includes('pro')) return 'pro';
  if (n.includes('enterprise') || n.includes('premium')) return 'enterprise';
  return n.split(/\s+/)[0] || 'pro';
}

const PLAN_DESC = {
  starter: 'Para barbearias que estão começando',
  pro: 'Para barbearias em crescimento',
  enterprise: 'Para redes e estúdios premium',
};

const PLANS_FALLBACK = [
  { key: 'starter', name: 'Starter', price: 0, desc: PLAN_DESC.starter, features: [] },
  { key: 'pro', name: 'Pro', price: 0, desc: PLAN_DESC.pro, features: [], highlight: true },
  { key: 'enterprise', name: 'Enterprise', price: 0, desc: PLAN_DESC.enterprise, features: [] },
];

const STATIC_FEATURE_COPY = {
  starter: ['Até 2 profissionais', 'Agenda online', 'Link público de agendamento', 'Gestão de clientes', 'Financeiro básico'],
  pro: ['Até 8 profissionais', 'Tudo do Starter', 'AI Growth Engine', 'Relatórios avançados', 'Suporte prioritário'],
  enterprise: ['Profissionais ilimitados', 'Tudo do Pro', 'White-label total', 'Multi-unidade', 'Onboarding dedicado'],
};

function mapDbPlansToUi(dbPlans) {
  if (!Array.isArray(dbPlans) || dbPlans.length === 0) return PLANS_FALLBACK;
  return dbPlans.map(p => {
    const key = planKeyFromName(p.name);
    return {
      key,
      name: p.name,
      price: Number(p.price_monthly) || 0,
      desc: PLAN_DESC[key] || '',
      features: STATIC_FEATURE_COPY[key] || [],
      highlight: key === 'pro',
    };
  });
}

function getInitialPlan() {
  if (typeof window === 'undefined') return 'pro';
  const params = new URLSearchParams(window.location.search);
  if (params.get('promo') === LAUNCH_PROMO.code) return LAUNCH_PROMO.plan;
  const p = params.get('plano');
  return ['starter', 'pro', 'enterprise'].includes(p) ? p : 'pro';
}

// Máscara dinâmica que se adapta tanto para CPF (11 dígitos) quanto para CNPJ (14 dígitos)
function maskCpfCnpj(value) {
  const d = String(value || '').replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export default function Checkout() {
  const [selectedPlan, setSelectedPlan] = useState(getInitialPlan());
  const [promo] = useState(getPromoFromUrl());
  const isLaunch = !!promo;
  const { plans: dbPlans, isLoading: loadingPlans } = usePublicPlans();
  const PLANS = mapDbPlansToUi(dbPlans);
  const [form, setForm] = useState({
    business_name: '',
    owner_name: '',
    email: '',
    phone: '',
    cpf_cnpj: '',
  });
  const [error, setError] = useState('');
  const [stage, setStage] = useState('form'); // 'form' = dados cadastrais | 'method' = cartão de crédito

  const plan = PLANS.find(p => p.key === selectedPlan) || PLANS[0];
  const effectivePrice = isLaunch ? promo.price : plan.price;

  const validate = () => {
    if (!form.business_name.trim()) return 'Informe o nome da barbearia';
    if (!form.owner_name.trim()) return 'Informe o nome do responsável';
    if (!form.email.trim() || !form.email.includes('@')) return 'Informe um email válido';
    if (!form.phone.trim()) return 'Informe o WhatsApp';
    const cleanDoc = form.cpf_cnpj.replace(/\D/g, '');
    if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
      return 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.';
    }
    return null;
  };

  const handleContinue = (e) => {
    e?.preventDefault();
    setError('');
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setStage('method');
  };

  // Processamento exclusivo com Cartão de Crédito e Bloqueio Rigoroso de Segurança
  const handleCardSubmit = async (card) => {
    setError('');
    const cleanCpfCnpj = form.cpf_cnpj.replace(/\D/g, '');

    const cleanCardDigits = String(card.number || '').replace(/\D/g, '');
    const checkoutData = {
      business_name: form.business_name.trim(),
      owner_name: form.owner_name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      cnpj: cleanCpfCnpj,
      plan: selectedPlan,
      payment_method: 'card',
      card_last_digits: cleanCardDigits.slice(-4),
      card_brand: card.brand || undefined,
    };
    try {
      localStorage.setItem('barberpass_checkout_data', JSON.stringify(checkoutData));
      localStorage.setItem('barberpass_auth_email', form.email.trim().toLowerCase());
    } catch (_) {}

    const payload = {
      customer: {
        name: form.owner_name.trim(),
        email: form.email.trim().toLowerCase(),
        cpfCnpj: cleanCpfCnpj,
        phone: form.phone.trim(),
      },
      plan: {
        name: plan.name,
        value: effectivePrice,
      },
      creditCard: {
        holderName: card.holderName,
        number: card.number,
        expiryMonth: card.expiryMonth,
        expiryYear: card.expiryYear,
        ccv: card.ccv,
        brand: card.brand,
      },
      creditCardHolderInfo: {
        name: card.holderName || form.owner_name.trim(),
        email: card.email || form.email.trim().toLowerCase(),
        cpfCnpj: card.cpfCnpj ? card.cpfCnpj.replace(/\D/g, '') : cleanCpfCnpj,
        postalCode: card.postalCode ? card.postalCode.replace(/\D/g, '') : '01310100',
        addressNumber: card.addressNumber || '100',
        phone: card.phone ? card.phone.replace(/\D/g, '') : form.phone.trim(),
      },
      business_name: form.business_name.trim(),
      owner_name: form.owner_name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      cpf_cnpj: cleanCpfCnpj,
      plan_name: plan.name,
      value: effectivePrice,
      promo: isLaunch ? promo.code : undefined,
    };

    console.info('[Checkout] Submetendo ao endpoint real do Asaas /api/subscribe...');

    // 🔒 Chamada HTTP REAL ao endpoint backend
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    // 🔒 NUNCA avança se a resposta não for status 200 do Asaas
    if (!res.ok || !data.success) {
      const errorMsg = data?.error || data?.message || 'Cartão não autorizado ou dados inválidos no Asaas.';
      console.error('[Checkout] Erro retornado pela API Asaas:', errorMsg);
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      const enrichedCheckout = {
        ...checkoutData,
        company_id: data.company_id,
        asaas_customer_id: data.asaas_customer_id || data.customer_id,
        asaas_subscription_id: data.asaas_subscription_id || data.subscription_id,
        card_last_digits: data.card_last_digits || cleanCardDigits.slice(-4),
        card_brand: data.card_brand || card.brand || 'CARTAO',
        trial_ends_at: data.trial_ends_at,
      };
      localStorage.setItem('barberpass_checkout_data', JSON.stringify(enrichedCheckout));
    } catch (_) {}

    const queryParams = new URLSearchParams({
      email: form.email.trim().toLowerCase(),
      plano: selectedPlan,
      business: form.business_name.trim(),
      owner: form.owner_name.trim(),
      phone: form.phone.trim(),
      cnpj: cleanCpfCnpj,
    }).toString();

    // Somente com cartão validado e assinatura confirmada, redireciona para a tela final de acesso
    window.location.href = data?.url || `/checkout/sucesso?${queryParams}`;
  };

  return (
    <div className="min-h-screen bg-[#F8F7F3] font-inter">
      {/* Top bar */}
      <header className="bg-white border-b border-black/5 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link to="/landing">
            <Logo size={32} />
          </Link>
          <Link to="/landing" className="text-xs text-gray-500 hover:text-[#2563EB] flex items-center gap-1 cursor-pointer">
            <ArrowLeft className="w-3 h-3" /> Voltar
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-12 pb-32 lg:pb-12">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* LEFT — Resumo */}
          <div className="order-2 lg:order-1">
            <div className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-4 ${
              isLaunch
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-[#2563EB]/10 text-[#2563EB]'
            }`}>
              {isLaunch ? <Rocket className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
              {isLaunch
                ? 'Oferta de lançamento — R$ 49/mês por 6 meses'
                : '7 dias grátis · Cancele quando quiser'}
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-[#0F172A] leading-tight mb-3">
              {isLaunch ? 'Garanta sua condição de lançamento' : 'Comece a usar O CORTE hoje'}
            </h1>
            <p className="text-gray-500 mb-8">
              {isLaunch ? (
                <>Plano <strong>Pro completo</strong> por <strong>R$ {promo.price}/mês durante os primeiros {promo.durationMonths} meses</strong>. Depois desse período, migra automaticamente para o preço oficial vigente.</>
              ) : (
                <>Cadastre sua barbearia, escolha o plano e ganhe <strong>7 dias grátis</strong>. A primeira fatura só será debitada em 7 dias.</>
              )}
            </p>

            {/* Resumo do plano */}
            <div className={`bg-white rounded-2xl border p-5 mb-5 shadow-card ${
              isLaunch ? 'border-amber-300 ring-2 ring-amber-200' : 'border-black/8'
            }`}>
              {isLaunch && (
                <div className="flex items-center gap-2 mb-3 -mt-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                    <Rocket className="w-3 h-3" /> Promo de lançamento
                  </span>
                </div>
              )}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Plano selecionado</div>
                  <div className="text-xl font-black text-[#0F172A]">O CORTE · {plan.name}</div>
                </div>
                <div className="text-right">
                  {isLaunch && plan.price > 0 && (
                    <div className="text-xs text-gray-400 line-through">R${plan.price}/mês</div>
                  )}
                  <div className="text-2xl font-black text-[#0F172A]">
                    {loadingPlans && !isLaunch ? '—' : `R$${effectivePrice}`}
                  </div>
                  <div className="text-xs text-gray-400">/mês</div>
                </div>
              </div>
              <div className="border-t border-black/5 pt-3 space-y-2">
                {plan.features.slice(0, 4).map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-[#2563EB] flex-shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-black/5 flex items-center justify-between text-sm">
                <span className="text-gray-500 font-medium">Cobrança hoje (Trial)</span>
                <span className="font-bold text-emerald-600">R$ 0,00</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {isLaunch
                  ? `Após 7 dias grátis: R$${promo.price}/mês pelos primeiros ${promo.durationMonths} meses.`
                  : `Após 7 dias grátis: R$${plan.price}/mês`}
              </div>
            </div>

            {/* Garantias */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-white rounded-xl border border-black/8 p-3 text-center">
                <Shield className="w-5 h-5 text-[#2563EB] mx-auto mb-1" />
                <div className="text-[11px] font-semibold text-gray-700">Validação segura</div>
              </div>
              <div className="bg-white rounded-xl border border-black/8 p-3 text-center">
                <Star className="w-5 h-5 text-[#2563EB] mx-auto mb-1" />
                <div className="text-[11px] font-semibold text-gray-700">7 dias grátis</div>
              </div>
              <div className="bg-white rounded-xl border border-black/8 p-3 text-center">
                <Lock className="w-5 h-5 text-[#2563EB] mx-auto mb-1" />
                <div className="text-[11px] font-semibold text-gray-700">Cancele quando quiser</div>
              </div>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              Processamento seguro no cartão de crédito via Asaas. 7 dias grátis com cancelamento a qualquer momento direto no painel, sem multas e sem burocracia.
            </p>
          </div>

          {/* RIGHT — Form */}
          <div className="order-1 lg:order-2">
            <div className="bg-white rounded-2xl border border-black/8 p-5 sm:p-7 shadow-card">
              {/* Plan picker */}
              {!isLaunch && (
                <div className="mb-6">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Escolha seu plano</div>
                  <div className="grid grid-cols-3 gap-2">
                    {PLANS.map(p => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setSelectedPlan(p.key)}
                        className={`relative text-center px-2 py-3 rounded-xl border-2 transition-all cursor-pointer ${
                          selectedPlan === p.key
                            ? 'border-[#2563EB] bg-[#2563EB]/5'
                            : 'border-black/8 hover:border-black/20'
                        }`}
                      >
                        {p.highlight && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-[#2563EB] text-white text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                            RECOMENDADO
                          </span>
                        )}
                        <div className="text-xs font-bold text-[#0F172A]">{p.name}</div>
                        <div className="text-base font-black text-[#0F172A] mt-0.5">
                          {loadingPlans ? '—' : `R$${p.price}`}
                        </div>
                        <div className="text-[10px] text-gray-400">/mês</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Banner de promoção de lançamento */}
              {isLaunch && (
                <div className="mb-6 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-300 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-200/70 border border-amber-300 flex items-center justify-center flex-shrink-0">
                      <Rocket className="w-4 h-4 text-amber-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold uppercase tracking-wider text-amber-800">
                        Oferta de lançamento ativa
                      </div>
                      <div className="text-sm text-amber-900 mt-0.5 leading-snug">
                        Plano <strong>Pro</strong> por <strong>R$ {promo.price}/mês</strong> nos primeiros <strong>{promo.durationMonths} meses</strong>. Depois, R$ {plan.price}/mês.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ETAPA 1: SEUS DADOS */}
              {stage === 'form' && (
                <form onSubmit={handleContinue} className="space-y-3.5">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Seus dados</div>

                  <Field
                    label="Nome da barbearia"
                    value={form.business_name}
                    onChange={v => setForm(f => ({ ...f, business_name: v }))}
                    placeholder="Ex: Barbearia do João"
                  />
                  <Field
                    label="Nome do responsável"
                    value={form.owner_name}
                    onChange={v => setForm(f => ({ ...f, owner_name: v }))}
                    placeholder="Seu nome completo"
                  />
                  <Field
                    label="Email"
                    type="email"
                    value={form.email}
                    onChange={v => setForm(f => ({ ...f, email: v }))}
                    placeholder="voce@exemplo.com"
                  />
                  <Field
                    label="WhatsApp"
                    value={form.phone}
                    onChange={v => setForm(f => ({ ...f, phone: v }))}
                    placeholder="(11) 99999-9999"
                  />
                  <Field
                    label="CPF ou CNPJ"
                    value={form.cpf_cnpj}
                    onChange={v => setForm(f => ({ ...f, cpf_cnpj: maskCpfCnpj(v) }))}
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    helpText="Aceitamos CPF, MEI ou CNPJ. Profissionais autônomos podem se cadastrar com CPF."
                  />

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg font-medium">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-brand active:scale-[0.99] cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Continuar para o pagamento</span>
                  </button>

                  <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                    Você não será cobrado nos primeiros 7 dias. Cancele a qualquer momento.<br />
                    Ao continuar, você concorda com os{' '}
                    <Link to="/termos-de-uso" className="underline hover:text-[#2563EB]">Termos de Uso</Link>
                    {' '}e a{' '}
                    <Link to="/politica-de-privacidade" className="underline hover:text-[#2563EB]">Política de Privacidade</Link>.
                  </p>
                </form>
              )}

              {/* ETAPA 2: COMO DESEJA PAGAR? (EXCLUSIVO CARTÃO DE CRÉDITO) */}
              {stage === 'method' && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => { setStage('form'); setError(''); }}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#2563EB] cursor-pointer font-medium"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Editar meus dados
                  </button>

                  <div className="border-b border-black/5 pb-2">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">Como deseja pagar?</div>
                    <h2 className="text-base font-black text-[#0F172A]">Cartão de Crédito</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      7 dias grátis. Cancele quando quiser. A primeira fatura só será debitada em 7 dias.
                    </p>
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded-xl font-medium">
                      {error}
                    </div>
                  )}

                  <CardPaymentFormAsaas
                    primaryColor="#2563EB"
                    amountLabel={
                      isLaunch
                        ? `Iniciar 7 dias grátis — depois R$${promo.price}/mês por ${promo.durationMonths} meses`
                        : `Iniciar 7 dias grátis — depois R$${plan.price}/mês`
                    }
                    defaultName={form.owner_name}
                    defaultEmail={form.email}
                    defaultPhone={form.phone}
                    defaultCpf={form.cpf_cnpj}
                    onSubmit={handleCardSubmit}
                  />

                  <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                    Você não será cobrado hoje. Período de teste de 7 dias grátis.<br />
                    Ao continuar, você concorda com os{' '}
                    <Link to="/termos-de-uso" className="underline hover:text-[#2563EB]">Termos de Uso</Link>
                    {' '}e a{' '}
                    <Link to="/politica-de-privacidade" className="underline hover:text-[#2563EB]">Política de Privacidade</Link>.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', helpText }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ color: '#0F172A', backgroundColor: '#FFFFFF', WebkitTextFillColor: '#0F172A' }}
        className="w-full px-3.5 py-2.5 text-sm border border-black/10 rounded-lg placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
      />
      {helpText && <p className="text-[11px] text-gray-500 mt-1">{helpText}</p>}
    </div>
  );
}