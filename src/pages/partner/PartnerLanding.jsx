// Landing pública do Programa de Parceiros Oficial — O CORTE
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
  Shield,
  AlertCircle,
  Eye,
  EyeOff,
  Clock,
  CheckCircle2,
  Wallet,
  Calendar,
  Award,
  Headphones,
  Users,
} from 'lucide-react';
import { getDeviceFingerprint } from '@/lib/referralTracking';

const EARNINGS_PROJECTION = [
  { count: '3 barbearias', monthly: 'R$ 107,10 / mês', yearly: '~R$ 1.179,63' },
  { count: '5 barbearias', monthly: 'R$ 178,50 / mês', yearly: '~R$ 1.966,05' },
  { count: '10 barbearias', monthly: 'R$ 357,00 / mês', yearly: '~R$ 3.932,10' },
  { count: '20 barbearias', monthly: 'R$ 714,00 / mês', yearly: '~R$ 7.864,20' },
];

const LIFECYCLE_STEPS = [
  {
    step: '01',
    icon: Clock,
    title: 'Cadastro e Período de Testes (Trial)',
    desc: 'A barbearia regista-se através do link ou código do parceiro e usufrui de 7 dias de teste gratuito. Durante este período, o estado no painel permanece como indicação em avaliação, sem gerar saldo financeiro.',
  },
  {
    step: '02',
    icon: Shield,
    title: 'Hold Antifraude (14 a 30 dias)',
    desc: 'Assim que a barbearia paga a primeira mensalidade, o valor de 30% é lançado na secção "Em Hold (Anti-fraude)". Este período protege o programa contra estornos de cartão, cancelamentos imediatos ou transações irregulares.',
  },
  {
    step: '03',
    icon: CheckCircle2,
    title: 'Aprovação de Saldo',
    desc: 'Terminado o prazo de hold com a assinatura confirmada, o valor é transferido automaticamente para "A Pagar (Aprovadas)".',
  },
  {
    step: '04',
    icon: Wallet,
    title: 'Pagamento via Pix',
    desc: 'Fecho do ciclo no dia 01 de cada mês. O repasse financeiro é efetuado entre os dias 05 e 10 diretamente para a chave Pix cadastrada no perfil do parceiro. Valor mínimo de transferência: R$ 50,00 (caso inferior, acumula para o ciclo seguinte).',
  },
];

export default function PartnerLanding() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    cpf_cnpj: '',
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
      setError('Por favor, informe seu nome completo.');
      return;
    }

    const cleanEmail = form.email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Por favor, informe um endereço de e-mail válido.');
      return;
    }

    if (!form.phone.trim() || form.phone.trim().length < 8) {
      setError('Por favor, informe seu número de WhatsApp com DDD.');
      return;
    }

    if (!form.cpf_cnpj.trim() || form.cpf_cnpj.trim().length < 11) {
      setError('Por favor, informe um CPF ou CNPJ válido.');
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
                cpf_cnpj: form.cpf_cnpj.trim(),
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
            cpf_cnpj: form.cpf_cnpj.trim(),
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
        cpf_cnpj: form.cpf_cnpj.trim(),
        pix_key: form.pix_key.trim(),
        password: form.password,
        commission_percentage: 30,
        fingerprint,
      });

      const partnerData = res?.data?.partner || {
        name: form.name.trim(),
        email: cleanEmail,
        phone: form.phone.trim(),
        cpf_cnpj: form.cpf_cnpj.trim(),
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
      <div className="min-h-screen flex items-center justify-center p-4 text-white">
        <AppBackgroundLayer />
        <div className="relative max-w-md w-full rounded-3xl border border-emerald-400/30 bg-emerald-500/10 backdrop-blur-xl p-8 text-center shadow-2xl animate-fade-in">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-400/20 flex items-center justify-center text-emerald-400 mb-4 shadow-sm">
            <CheckCircle className="w-9 h-9" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black mb-2 text-white">Cadastro recebido! 🎉</h1>
          <p className="text-sm text-white/80 mb-6 leading-relaxed">
            Seu cadastro no Programa de Parceiros Oficial está em análise pela nossa equipe. Enviaremos um e-mail de aprovação assim que for liberado.
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
                <span className="text-white/50">Código provisório:</span>
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
    <div className="min-h-screen text-white font-inter">
      <AppBackgroundLayer />
      <header className="relative max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
        <Link to="/landing">
          <BrandMark size={32} tone="dark" />
        </Link>
        <Link to="/parceiro/login" className="text-sm font-semibold text-white/70 hover:text-white transition-colors">
          Já tem conta? Entrar →
        </Link>
      </header>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12 space-y-12">
        {/* Topo: Proposta de Valor + Formulário de Adesão */}
        <div className="grid lg:grid-cols-12 gap-10 items-start">
          {/* Coluna da esquerda — Modelo de Remuneração */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#2563EB]/15 border border-[#60A5FA]/25 text-[#93C5FD] text-xs font-bold px-3 py-1.5 rounded-full mb-4">
                <Gift className="w-3.5 h-3.5" /> PROGRAMA DE PARCEIROS OFICIAL — O CORTE
              </div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight bg-gradient-to-b from-white to-white/75 bg-clip-text text-transparent mb-4 leading-tight">
                30% de comissão recorrente em canais B2B.
              </h1>
              <p className="text-white/70 text-sm sm:text-base leading-relaxed">
                O Programa de Parceiros de <strong className="text-white">O CORTE</strong> foi desenhado como um modelo de afiliação e canais B2B estruturado para remunerar de forma recorrente e previsível profissionais que possuem ligação direta com o ecossistema de barbearias (<strong className="text-white/90">vendedores de cosméticos, distribuidores, afiadores e barbeiros influentes</strong>).
              </p>
            </div>

            {/* 1. Resumo do Modelo de Remuneração */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-black uppercase tracking-wider text-[#93C5FD] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  1. Resumo do Modelo de Remuneração
                </h2>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                  Recorrência: 12 meses consecutivos
                </span>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/8">
                  <div className="text-[11px] font-bold uppercase text-white/50">Comissão</div>
                  <div className="text-2xl font-black text-emerald-300 mt-0.5">30%</div>
                  <div className="text-[11px] text-white/55 mt-0.5">Recorrente sobre cada mensalidade paga</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/8">
                  <div className="text-[11px] font-bold uppercase text-white/50">Meses 1 a 3 (Pioneiros)</div>
                  <div className="text-xl font-black text-white mt-0.5">R$ 23,97<span className="text-xs font-normal text-white/50">/mês</span></div>
                  <div className="text-[11px] text-white/55 mt-0.5">Sobre mensalidade de R$ 79,90</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/8">
                  <div className="text-[11px] font-bold uppercase text-white/50">Mês 4 ao 12 (Padrão)</div>
                  <div className="text-xl font-black text-[#93C5FD] mt-0.5">R$ 35,70<span className="text-xs font-normal text-white/50">/mês</span></div>
                  <div className="text-[11px] text-white/55 mt-0.5">Sobre mensalidade de R$ 119,00</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-r from-[#2563EB]/15 to-emerald-500/10 border border-[#60A5FA]/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-white">Potencial Anual por Cliente Indicado</div>
                  <div className="text-xs text-white/65">
                    Cada barbearia ativa durante 1 ano (12 mensalidades) gera acumulado direto para você:
                  </div>
                </div>
                <div className="text-2xl font-black text-emerald-300 whitespace-nowrap">
                  ~R$ 393,21
                </div>
              </div>
            </div>

            {/* 2. Projeção de Ganhos em Escala */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 sm:p-6">
              <h2 className="text-sm font-black uppercase tracking-wider text-[#93C5FD] flex items-center gap-2 mb-4">
                <Users className="w-4 h-4" />
                2. Projeção de Ganhos em Escala
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-white/50 text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 pr-3">Barbearias Ativas Indicadas</th>
                      <th className="py-2.5 px-3">Comissão Mensal Estimada (Mês 4+)</th>
                      <th className="py-2.5 pl-3 text-right">Retorno Acumulado em 12 Meses</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/8">
                    {EARNINGS_PROJECTION.map((row, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="py-3 pr-3 font-bold text-white">{row.count}</td>
                        <td className="py-3 px-3 font-semibold text-[#93C5FD]">{row.monthly}</td>
                        <td className="py-3 pl-3 text-right font-black text-emerald-300">{row.yearly}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Coluna da direita — Formulário */}
          <form
            onSubmit={submit}
            noValidate
            className="lg:col-span-5 rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-6 sm:p-8 shadow-2xl lg:sticky lg:top-6"
          >
            <div className="text-xs font-bold text-white/70 uppercase tracking-wider mb-5 flex items-center justify-between">
              <span>Cadastre-se como Parceiro</span>
              <span className="text-[11px] text-emerald-300 font-bold normal-case">30% recorrente</span>
            </div>

            <div className="space-y-3.5 mb-5">
              {/* Nome Completo */}
              <div>
                <label className="block text-[11px] font-semibold text-white/70 mb-1">Nome completo *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Seu nome ou Razão Social"
                  className="w-full px-3.5 py-2.5 bg-white/[0.05] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20 transition-all"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-[11px] font-semibold text-white/70 mb-1">E-mail *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="seu.email@exemplo.com"
                  className="w-full px-3.5 py-2.5 bg-white/[0.05] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20 transition-all"
                />
              </div>

              {/* WhatsApp */}
              <div>
                <label className="block text-[11px] font-semibold text-white/70 mb-1">WhatsApp com DDD *</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                  className="w-full px-3.5 py-2.5 bg-white/[0.05] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20 transition-all"
                />
              </div>

              {/* CPF ou CNPJ */}
              <div>
                <label className="block text-[11px] font-semibold text-white/70 mb-1">CPF ou CNPJ *</label>
                <input
                  type="text"
                  value={form.cpf_cnpj}
                  onChange={e => setForm(p => ({ ...p, cpf_cnpj: e.target.value }))}
                  placeholder="000.000.000-00 ou 00.000.000/0001-00"
                  className="w-full px-3.5 py-2.5 bg-white/[0.05] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20 transition-all"
                />
              </div>

              {/* Chave PIX */}
              <div>
                <label className="block text-[11px] font-semibold text-white/70 mb-1">Chave PIX para receber comissões</label>
                <input
                  type="text"
                  value={form.pix_key}
                  onChange={e => setForm(p => ({ ...p, pix_key: e.target.value }))}
                  placeholder="CPF, e-mail, telefone ou chave aleatória"
                  className="w-full px-3.5 py-2.5 bg-white/[0.05] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20 transition-all"
                />
              </div>

              {/* Senha */}
              <div>
                <label className="block text-[11px] font-semibold text-white/70 mb-1">
                  Senha de acesso * (mínimo 8 caracteres)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="Crie sua senha segura"
                    className="w-full px-3.5 py-2.5 pr-10 bg-white/[0.05] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
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
              Repasses via Pix entre os dias 05 e 10 de cada mês (mínimo R$ 50,00). Sem taxa de adesão.
            </p>
          </form>
        </div>

        {/* 3. Ciclo de Vida da Indicação e Regras Operacionais */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2.5">
              <Calendar className="w-5 h-5 text-[#60A5FA]" />
              3. Ciclo de Vida da Indicação e Regras Operacionais
            </h2>
            <p className="text-xs sm:text-sm text-white/60 mt-1">
              O painel de gestão de parceiros acompanha cada indicação através de quatro etapas bem definidas:
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {LIFECYCLE_STEPS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="p-4 rounded-2xl bg-white/[0.03] border border-white/8 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-9 h-9 rounded-xl bg-[#2563EB]/15 border border-[#60A5FA]/25 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-[#93C5FD]" />
                      </div>
                      <span className="text-xs font-mono font-black text-white/30">ETAPA {item.step}</span>
                    </div>
                    <h3 className="font-bold text-sm text-white mb-1.5">{item.title}</h3>
                    <p className="text-xs text-white/60 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Condições e Encerramento do Contrato */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8">
          <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2.5 mb-5">
            <Award className="w-5 h-5 text-emerald-400" />
            4. Condições e Encerramento do Contrato
          </h2>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8">
              <div className="font-bold text-sm text-white mb-1.5 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#93C5FD]" />
                Teto de 12 Mensalidades
              </div>
              <p className="text-xs text-white/60 leading-relaxed">
                Cada barbearia gera exatamente até 12 repasses mensais de comissão. Ao completar 1 ano, aquela assinatura deixa de comissionar, mantendo a rentabilidade e o equilíbrio financeiro do SaaS a longo prazo.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8">
              <div className="font-bold text-sm text-white mb-1.5 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Manutenção dos Rendimentos
              </div>
              <p className="text-xs text-white/60 leading-relaxed">
                Para sustentar ou expandir o seu rendimento mensal, o parceiro é incentivado a continuar a apresentar a plataforma a novos estabelecimentos da sua rota comercial.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8">
              <div className="font-bold text-sm text-white mb-1.5 flex items-center gap-2">
                <Headphones className="w-4 h-4 text-amber-300" />
                Isenção de Suporte Técnico
              </div>
              <p className="text-xs text-white/60 leading-relaxed">
                O parceiro atua estritamente como canal de recomendação comercial; toda a configuração inicial, suporte técnico, hospedagem e atualizações ficam sob responsabilidade direta de O CORTE.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}