// Landing de alta conversão do Programa de Parceiros Oficial — O CORTE
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import AppBackgroundLayer from '@/components/layout/AppBackgroundLayer';
import BrandMark from '@/components/BrandMark';
import {
  Loader2,
  CheckCircle,
  Gift,
  TrendingUp,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { getDeviceFingerprint } from '@/lib/referralTracking';

const EARNINGS_PROJECTION = [
  { count: '3 barbearias ativas', monthly: 'R$ 107,10 / mês', yearly: '~R$ 1.179 / ano' },
  { count: '5 barbearias ativas', monthly: 'R$ 178,50 / mês', yearly: '~R$ 1.966 / ano' },
  { count: '10 barbearias ativas', monthly: 'R$ 357,00 / mês', yearly: '~R$ 3.932 / ano' },
  { count: '20 barbearias ativas', monthly: 'R$ 714,00 / mês', yearly: '~R$ 7.864 / ano' },
];

export default function PartnerLanding() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    pix_key: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  const submit = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    setError('');

    if (!form.name.trim()) {
      setError('Por favor, informe seu nome completo ou Razão Social.');
      return;
    }

    const cleanEmail = form.email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Por favor, informe um endereço de e-mail válido.');
      return;
    }

    if (!form.phone.trim() || form.phone.trim().length < 8) {
      setError('Por favor, informe seu WhatsApp com DDD.');
      return;
    }

    if (!form.pix_key.trim()) {
      setError('Por favor, informe sua chave Pix para receber as comissões.');
      return;
    }

    if (!form.password || form.password.length < 8) {
      setError('Crie uma senha de acesso com no mínimo 8 caracteres.');
      return;
    }

    setLoading(true);

    try {
      const fingerprint = getDeviceFingerprint ? getDeviceFingerprint() : 'device_' + Date.now();
      const cleanFirst = (form.name.trim().split(' ')[0] || 'PARC').toUpperCase().replace(/[^A-Z]/g, '');
      const referralCode = `${cleanFirst}${Math.floor(1000 + Math.random() * 9000)}`;

      let authUserId = null;

      if (isSupabaseConfigured && supabase?.auth?.signUp) {
        try {
          const { data: authData, error: authErr } = await supabase.auth.signUp({
            email: cleanEmail,
            password: form.password,
            options: {
              data: {
                name: form.name.trim(),
                full_name: form.name.trim(),
                phone: form.phone.trim(),
                pix_key: form.pix_key.trim(),
                referral_code: referralCode,
                commission_rate: 30,
                role: 'partner',
              },
            },
          });

          if (authData?.user?.id) {
            authUserId = authData.user.id;
          }

          if (authErr && !authErr.message?.includes('already registered')) {
            console.warn('[PartnerLanding] Aviso no Supabase Auth signUp:', authErr.message);
          }
        } catch (supaErr) {
          console.warn('[PartnerLanding] Exceção no Supabase Auth:', supaErr);
        }

        try {
          const partnerPayload = {
            full_name: form.name.trim(),
            email: cleanEmail,
            phone: form.phone.trim(),
            pix_key: form.pix_key.trim(),
            referral_code: referralCode,
            commission_rate: 30,
            status: 'pending',
            created_at: new Date().toISOString(),
          };

          if (authUserId) {
            partnerPayload.id = authUserId;
          }

          await supabase
            .from('partners')
            .upsert(partnerPayload, { onConflict: 'email' })
            .select()
            .maybeSingle();
        } catch (tableErr) {
          console.warn('[PartnerLanding] Aviso ao consultar tabela partners:', tableErr);
        }
      }

      const res = await base44.functions.invoke('partnerRegister', {
        name: form.name.trim(),
        email: cleanEmail,
        phone: form.phone.trim(),
        pix_key: form.pix_key.trim(),
        password: form.password,
        commission_percentage: 30,
        fingerprint,
      });

      const partnerData = res?.data?.partner || {
        name: form.name.trim(),
        email: cleanEmail,
        phone: form.phone.trim(),
        referral_code: referralCode,
        commission_percentage: 30,
      };

      if (res?.data?.success || res?.data?.ok || partnerData) {
        setSuccess(partnerData);
      } else {
        const errorMsg = res?.data?.message || res?.data?.error || 'Erro ao processar o cadastro de parceiro.';
        setError(errorMsg);
      }
    } catch (err) {
      setError(err?.message || 'Falha de comunicação ao cadastrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-white font-inter">
        <AppBackgroundLayer />
        <div className="relative max-w-md w-full rounded-3xl border border-emerald-400/30 bg-emerald-500/10 backdrop-blur-xl p-7 sm:p-8 text-center shadow-2xl animate-fade-in">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-400/20 flex items-center justify-center text-emerald-400 mb-4 shadow-sm">
            <CheckCircle className="w-9 h-9" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black mb-2 text-white">Cadastro recebido! 🎉</h1>
          <p className="text-sm text-white/80 mb-6 leading-relaxed">
            Seu cadastro no Programa de Parceiros Oficial está em análise. Enviaremos a confirmação por e-mail assim que for aprovado.
          </p>

          <div className="bg-white/[0.05] border border-white/10 rounded-2xl p-4 text-left text-sm space-y-2 mb-6">
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/50">Nome:</span>
              <span className="font-semibold text-white">{success.name}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/50">E-mail:</span>
              <span className="font-semibold text-white">{success.email}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/50">Comissão recorrente:</span>
              <span className="font-bold text-emerald-300">30% por 12 meses</span>
            </div>
            {success.referral_code && (
              <div className="flex justify-between items-center text-xs pt-2 border-t border-white/10">
                <span className="text-white/50">Código de parceiro:</span>
                <span className="font-mono font-bold text-[#93C5FD] bg-[#2563EB]/20 px-2 py-0.5 rounded">
                  {success.referral_code}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate('/parceiro/login')}
            className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] hover:brightness-110 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition-all shadow-lg shadow-blue-500/30 active:scale-[0.99]"
          >
            Ir para o Login do Parceiro →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between text-white font-inter">
      <AppBackgroundLayer />

      {/* Header compacto */}
      <header className="relative w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
        <Link to="/landing">
          <BrandMark size={30} tone="dark" />
        </Link>
        <Link
          to="/parceiro/login"
          className="text-xs sm:text-sm font-semibold text-white/75 hover:text-white transition-colors px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10"
        >
          Já tem conta? Entrar →
        </Link>
      </header>

      {/* Conteúdo Principal em 3 Blocos Enxutos */}
      <main className="relative w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-8 lg:py-10 flex-1">
        <div className="grid lg:grid-cols-12 gap-6 lg:gap-10 items-start">
          {/* Coluna Esquerda: BLOCO 1 (Hero) + BLOCO 2 (Ganhos & Simulador Visual) */}
          <div className="lg:col-span-7 space-y-5 sm:space-y-6">
            {/* BLOCO 1: HERO & PROPOSTA DIRETA */}
            <div>
              <div className="inline-flex items-center gap-2 bg-[#2563EB]/15 border border-[#60A5FA]/30 text-[#93C5FD] text-[11px] sm:text-xs font-extrabold px-3 py-1.5 rounded-full mb-3.5 tracking-wide">
                <Gift className="w-3.5 h-3.5 flex-shrink-0" />
                <span>PROGRAMA DE PARCEIROS OFICIAL — O CORTE</span>
              </div>

              <h1 className="text-2xl sm:text-4xl lg:text-[42px] font-black tracking-tight bg-gradient-to-b from-white to-white/80 bg-clip-text text-transparent leading-[1.15] mb-3">
                Ganhe 30% todo mês por cada barbearia indicada
              </h1>

              <p className="text-white/70 text-sm sm:text-base leading-relaxed">
                Indique barbearias da sua região e receba comissão recorrente direto no seu Pix durante 1 ano inteiro por cada cliente ativo.
              </p>
            </div>

            {/* BLOCO 2: GANHOS & SIMULADOR VISUAL (Cards Compactos) */}
            <div className="space-y-4">
              {/* 1. Cartão de Valores Base */}
              <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-xl p-4 sm:p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <h2 className="text-sm sm:text-base font-extrabold text-white">
                      30% de Comissão Recorrente
                    </h2>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                    12 meses consecutivos
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/8 flex items-center justify-between sm:block">
                    <div className="text-xs text-white/60 font-medium">
                      Meses 1 a 3 <span className="text-white/40">(Preço de Lançamento)</span>
                    </div>
                    <div className="text-lg sm:text-xl font-black text-white sm:mt-1">
                      R$ 23,97 <span className="text-xs font-normal text-white/50">/ mês</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/8 flex items-center justify-between sm:block">
                    <div className="text-xs text-white/60 font-medium">
                      Mês 4 a 12 <span className="text-white/40">(Plano Padrão)</span>
                    </div>
                    <div className="text-lg sm:text-xl font-black text-[#93C5FD] sm:mt-1">
                      R$ 35,70 <span className="text-xs font-normal text-white/50">/ mês</span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#2563EB]/20 via-emerald-500/15 to-emerald-500/10 border border-emerald-400/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-white">
                    <Sparkles className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                    <span>Até <strong className="text-emerald-300">~R$ 393,21</strong> por barbearia ao longo de 1 ano</span>
                  </div>
                </div>
              </div>

              {/* 2. Tabela Rápida de Projeção (Compacta, focada em escala) */}
              <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-xl p-4 sm:p-6 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#93C5FD]">
                    Simulador de Ganhos em Escala
                  </h3>
                  <span className="text-[11px] text-white/45">Projeção Mês 4+</span>
                </div>

                <div className="divide-y divide-white/8">
                  {EARNINGS_PROJECTION.map((row, idx) => (
                    <div
                      key={idx}
                      className="py-2.5 sm:py-3 flex items-center justify-between gap-2 text-xs sm:text-sm"
                    >
                      <span className="font-bold text-white">{row.count}</span>
                      <div className="flex items-center gap-2 sm:gap-3 text-right">
                        <span className="font-bold text-[#93C5FD]">{row.monthly}</span>
                        <span className="text-[11px] sm:text-xs font-extrabold text-emerald-300 bg-emerald-500/10 border border-emerald-400/20 px-2 py-0.5 rounded-lg">
                          {row.yearly}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Coluna Direita: BLOCO 3 (Formulário Enxuto de Cadastro) */}
          <form
            onSubmit={submit}
            noValidate
            className="lg:col-span-5 rounded-2xl sm:rounded-3xl border border-white/12 bg-white/[0.045] backdrop-blur-2xl p-5 sm:p-7 shadow-2xl lg:sticky lg:top-6"
          >
            <div className="flex items-center justify-between gap-2 mb-5">
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                Cadastre-se como Parceiro
              </h2>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#2563EB]/20 border border-[#60A5FA]/30 text-[#93C5FD]">
                30% recorrente
              </span>
            </div>

            <div className="space-y-3.5 mb-5">
              {/* 1. Nome completo ou Razão Social */}
              <div>
                <label className="block text-xs font-semibold text-white/75 mb-1">
                  Nome completo ou Razão Social *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Seu nome ou empresa"
                  className="w-full px-3.5 py-2.5 bg-white/[0.05] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20 transition-all"
                />
              </div>

              {/* 2. E-mail */}
              <div>
                <label className="block text-xs font-semibold text-white/75 mb-1">
                  E-mail *
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="seu.email@exemplo.com"
                  className="w-full px-3.5 py-2.5 bg-white/[0.05] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20 transition-all"
                />
              </div>

              {/* 3. WhatsApp (com DDD) */}
              <div>
                <label className="block text-xs font-semibold text-white/75 mb-1">
                  WhatsApp (com DDD) *
                </label>
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                  className="w-full px-3.5 py-2.5 bg-white/[0.05] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20 transition-all"
                />
              </div>

              {/* 4. Chave Pix */}
              <div>
                <label className="block text-xs font-semibold text-white/75 mb-1">
                  Chave Pix (para receber as comissões) *
                </label>
                <input
                  type="text"
                  required
                  value={form.pix_key}
                  onChange={(e) => setForm((p) => ({ ...p, pix_key: e.target.value }))}
                  placeholder="CPF, CNPJ, e-mail, celular ou chave aleatória"
                  className="w-full px-3.5 py-2.5 bg-white/[0.05] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20 transition-all"
                />
              </div>

              {/* 5. Senha de acesso */}
              <div>
                <label className="block text-xs font-semibold text-white/75 mb-1">
                  Senha de acesso (mínimo 8 caracteres) *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Crie sua senha segura"
                    className="w-full px-3.5 py-2.5 pr-10 bg-white/[0.05] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-rose-500/15 border border-rose-400/40 text-rose-200 text-xs p-3.5 rounded-xl mb-4 font-medium flex items-start gap-2.5 animate-shake">
                <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                <div className="leading-relaxed">{error}</div>
              </div>
            )}

            <button
              type="submit"
              onClick={submit}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#1D4ED8] to-[#3B82F6] hover:brightness-110 active:scale-[0.99] text-white font-bold py-3.5 px-4 rounded-xl text-sm shadow-[0_8px_24px_rgba(37,99,235,0.4)] disabled:opacity-60 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Cadastrando...</span>
                </>
              ) : (
                <>
                  <Gift className="w-4 h-4" />
                  <span>Quero ser parceiro oficial</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-white/50 text-center mt-3 leading-relaxed">
              Repasses mensais via Pix • Sem taxa de adesão • Cancele quando quiser
            </p>
          </form>
        </div>
      </main>

      {/* Rodapé enxuto com link discreto */}
      <footer className="relative w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center border-t border-white/5 mt-8">
        <Link
          to="/termos-de-uso"
          className="text-xs text-white/40 hover:text-white/70 transition-colors underline underline-offset-4"
        >
          Termos do Programa de Parceiros
        </Link>
      </footer>
    </div>
  );
}