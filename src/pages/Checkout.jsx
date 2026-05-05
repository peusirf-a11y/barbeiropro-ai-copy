import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Logo from '@/components/Logo';
import { CheckCircle, ArrowLeft, Loader2, Shield, Star, Zap, Lock } from 'lucide-react';

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    price: 97,
    desc: 'Para barbearias que estão começando',
    features: ['Até 2 profissionais', 'Agenda online', 'Link público de agendamento', 'Gestão de clientes', 'Financeiro básico'],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 197,
    desc: 'Para barbearias em crescimento',
    features: ['Até 8 profissionais', 'Tudo do Starter', 'AI Growth Engine', 'Relatórios avançados', 'Suporte prioritário'],
    highlight: true,
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 397,
    desc: 'Para redes e estúdios premium',
    features: ['Profissionais ilimitados', 'Tudo do Pro', 'White-label total', 'Multi-unidade', 'Onboarding dedicado'],
  },
];

function getInitialPlan() {
  if (typeof window === 'undefined') return 'pro';
  const params = new URLSearchParams(window.location.search);
  const p = params.get('plano');
  return ['starter', 'pro', 'enterprise'].includes(p) ? p : 'pro';
}

export default function Checkout() {
  const [selectedPlan, setSelectedPlan] = useState(getInitialPlan());
  const [form, setForm] = useState({
    business_name: '',
    owner_name: '',
    email: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    try {
      if (window.self !== window.top) setIframeBlocked(true);
    } catch (e) {
      setIframeBlocked(true);
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('cancelled')) setCancelled(true);
  }, []);

  const plan = PLANS.find(p => p.key === selectedPlan);

  const validate = () => {
    if (!form.business_name.trim()) return 'Informe o nome da barbearia';
    if (!form.owner_name.trim()) return 'Informe o nome do responsável';
    if (!form.email.trim() || !form.email.includes('@')) return 'Informe um email válido';
    if (!form.phone.trim()) return 'Informe o WhatsApp';
    return null;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');

    if (iframeBlocked) {
      alert('O checkout só funciona no app publicado. Abra esta página em uma nova aba.');
      return;
    }

    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true);
    try {
      const { data } = await base44.functions.invoke('createCheckoutSession', {
        plan: selectedPlan,
        business_name: form.business_name.trim(),
        owner_name: form.owner_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
      });
      if (data?.url) {
        window.location.href = data.url;
      } else {
        setError(data?.error || 'Erro ao iniciar pagamento');
        setLoading(false);
      }
    } catch (err2) {
      setError(err2?.response?.data?.error || err2.message || 'Erro ao processar checkout');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7F3] font-inter">
      {/* Top bar */}
      <header className="bg-white border-b border-black/5 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo size={36} />
            <span className="font-black text-[15px] text-[#0F172A] tracking-[0.14em]">O CORTE</span>
          </Link>
          <Link to="/" className="text-xs text-gray-500 hover:text-[#2563EB] flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Voltar
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-12 pb-32 lg:pb-12">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* LEFT — Resumo */}
          <div className="order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 bg-[#2563EB]/10 text-[#2563EB] text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              <Zap className="w-3 h-3" /> 7 dias grátis · Cancele quando quiser
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-[#0F172A] leading-tight mb-3">
              Comece a usar O CORTE hoje
            </h1>
            <p className="text-gray-500 mb-8">
              Cadastre sua barbearia, escolha o plano e ganhe <strong>7 dias grátis</strong>. Você só é cobrado depois desse período.
            </p>

            {/* Resumo do plano */}
            <div className="bg-white rounded-2xl border border-black/8 p-5 mb-5 shadow-card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Plano selecionado</div>
                  <div className="text-xl font-black text-[#0F172A]">O CORTE · {plan.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-[#0F172A]">R${plan.price}</div>
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
                <span className="text-gray-500">Cobrança hoje</span>
                <span className="font-bold text-green-600">R$ 0,00</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">Após 7 dias: R${plan.price}/mês</div>
            </div>

            {/* Garantias */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-white rounded-xl border border-black/8 p-3 text-center">
                <Shield className="w-5 h-5 text-[#2563EB] mx-auto mb-1" />
                <div className="text-[11px] font-semibold text-gray-700">Pagamento seguro</div>
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
              Pagamento processado de forma segura via Stripe. Você pode cancelar a qualquer momento direto no painel — sem multas, sem burocracia.
            </p>
          </div>

          {/* RIGHT — Form */}
          <div className="order-1 lg:order-2">
            <div className="bg-white rounded-2xl border border-black/8 p-5 sm:p-7 shadow-card">
              {/* Plan picker */}
              <div className="mb-6">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Escolha seu plano</div>
                <div className="grid grid-cols-3 gap-2">
                  {PLANS.map(p => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setSelectedPlan(p.key)}
                      className={`relative text-center px-2 py-3 rounded-xl border-2 transition-all ${
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
                      <div className="text-base font-black text-[#0F172A] mt-0.5">R${p.price}</div>
                      <div className="text-[10px] text-gray-400">/mês</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3.5">
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

                {cancelled && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-lg">
                    Pagamento cancelado. Tente novamente quando quiser.
                  </div>
                )}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg">
                    {error}
                  </div>
                )}
                {iframeBlocked && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-lg">
                    Para finalizar o pagamento, abra esta página em uma nova aba.
                  </div>
                )}

                {/* Desktop submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="hidden lg:flex w-full items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-brand active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  {loading ? 'Processando...' : `Assinar ${plan.name} — R$${plan.price}/mês`}
                </button>

                <p className="hidden lg:block text-[11px] text-gray-400 text-center leading-relaxed">
                  Você não será cobrado nos primeiros 7 dias. Cancele a qualquer momento.<br />
                  Ao continuar, você concorda com os{' '}
                  <Link to="/termos-de-uso" className="underline hover:text-[#2563EB]">Termos de Uso</Link>
                  {' '}e a{' '}
                  <Link to="/politica-de-privacidade" className="underline hover:text-[#2563EB]">Política de Privacidade</Link>.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-black/8 p-3 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-bold py-3.5 rounded-xl text-sm transition-all active:scale-[0.99] disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
          {loading ? 'Processando...' : `Assinar — R$${plan.price}/mês`}
        </button>
        <p className="text-[10px] text-gray-400 text-center mt-1.5">7 dias grátis · Cancele quando quiser</p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 text-sm border border-black/10 rounded-lg bg-white focus:bg-white"
      />
    </div>
  );
}