// Landing pública do programa de parceiros — exibe explicação + formulário de cadastro.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import AppBackgroundLayer from '@/components/layout/AppBackgroundLayer';
import BrandMark from '@/components/BrandMark';
import { Loader2, CheckCircle, Gift, TrendingUp, Shield, ArrowRight, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { getDeviceFingerprint } from '@/lib/referralTracking';

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

    console.log('[PartnerLanding] Clique no botão "Quero ser parceiro" disparado!');
    setError('');

    // 1. Validações locais com mensagens visíveis
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
      console.log('[PartnerLanding] Iniciando envio do cadastro de parceiro...');
      const fingerprint = getDeviceFingerprint ? getDeviceFingerprint() : 'device_' + Date.now();
      const cleanFirst = (form.name.trim().split(' ')[0] || 'PARC').toUpperCase().replace(/[^A-Z]/g, '');
      const referralCode = `${cleanFirst}${Math.floor(1000 + Math.random() * 9000)}`;

      let authUserId = null;

      // 2. Criação da conta de autenticação no Supabase Auth (se disponível)
      if (isSupabaseConfigured && supabase?.auth?.signUp) {
        try {
          console.log('[PartnerLanding] Criando conta no Supabase Auth para o parceiro:', cleanEmail);
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
                role: 'partner',
              },
            },
          });

          if (authData?.user?.id) {
            authUserId = authData.user.id;
          }

          if (authErr && !authErr.message?.includes('already registered')) {
            console.warn('[PartnerLanding] Aviso no Supabase Auth signUp:', authErr.message);
          } else {
            console.log('[PartnerLanding] Registro no Supabase Auth concluído com sucesso!');
          }
        } catch (supaErr) {
          console.warn('[PartnerLanding] Exceção no Supabase Auth:', supaErr);
        }

        // 3. Inserção na tabela partners do Supabase
        try {
          console.log('[PartnerLanding] Inserindo registro na tabela partners...');
          const partnerPayload = {
            full_name: form.name.trim(),
            email: cleanEmail,
            phone: form.phone.trim(),
            cpf_cnpj: form.cpf_cnpj.trim(),
            pix_key: form.pix_key.trim(),
            referral_code: referralCode,
            status: 'pending',
            created_at: new Date().toISOString(),
          };

          if (authUserId) {
            partnerPayload.id = authUserId;
          }

          const { data: partnerRow, error: insertErr } = await supabase
            .from('partners')
            .upsert(partnerPayload, { onConflict: 'email' })
            .select()
            .maybeSingle();

          if (insertErr) {
            console.warn('[PartnerLanding] Aviso ao gravar na tabela partners:', insertErr.message);
          } else {
            console.log('[PartnerLanding] Registro gravado na tabela partners com sucesso:', partnerRow);
          }
        } catch (tableErr) {
          console.warn('[PartnerLanding] Aviso ao consultar tabela partners:', tableErr);
        }
      }

      // 4. Chamada da função partnerRegister para manter compatibilidade com painel local e Master
      const res = await base44.functions.invoke('partnerRegister', {
        name: form.name.trim(),
        email: cleanEmail,
        phone: form.phone.trim(),
        cpf_cnpj: form.cpf_cnpj.trim(),
        pix_key: form.pix_key.trim(),
        password: form.password,
        fingerprint,
      });

      console.log('[PartnerLanding] Resposta da função partnerRegister:', res);

      const partnerData = res?.data?.partner || {
        name: form.name.trim(),
        email: cleanEmail,
        phone: form.phone.trim(),
        cpf_cnpj: form.cpf_cnpj.trim(),
        referral_code: referralCode,
      };

      if (res?.data?.success || res?.data?.ok || partnerData) {
        console.log('[PartnerLanding] Cadastro concluído com sucesso! Renderizando tela de confirmação.');
        setSuccess(partnerData);
      } else {
        const errorMsg = res?.data?.message || res?.data?.error || 'Erro ao processar o cadastro de parceiro.';
        setError(errorMsg);
      }
    } catch (err) {
      console.error('[PartnerLanding] Exceção capturada durante submissão:', err);
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
            Seu cadastro está em análise pela nossa equipe. Enviaremos um e-mail de aprovação assim que for liberado.
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

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12 grid lg:grid-cols-2 gap-10 items-start">
        {/* Coluna da esquerda — Proposta de valor */}
        <div>
          <div className="inline-flex items-center gap-2 bg-[#2563EB]/15 border border-[#60A5FA]/25 text-[#93C5FD] text-xs font-bold px-3 py-1.5 rounded-full mb-5">
            <Gift className="w-3.5 h-3.5" /> PROGRAMA DE PARCEIROS
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent mb-4 leading-tight">
            Indique. Ganhe. Para sempre.
          </h1>
          <p className="text-white/70 text-base sm:text-lg leading-relaxed mb-6">
            Ganhe <strong className="text-white">20% de comissão recorrente</strong> sobre cada barbearia que assinar o O CORTE pela sua indicação. Pagamento mensal enquanto a barbearia estiver ativa.
          </p>
          <div className="space-y-3 mb-6">
            {[
              { icon: TrendingUp, title: 'Renda recorrente', desc: 'Comissão todo mês, sem teto e sem prazo de expiração.' },
              { icon: Shield, title: 'Pagamento garantido', desc: 'Após 15 dias de hold anti-fraude, sua comissão é liberada para saque via PIX.' },
              { icon: ArrowRight, title: 'Link próprio', desc: 'Seu código único é rastreado por 90 dias após o clique do cliente.' },
            ].map((it, i) => (
              <div key={i} className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/8 backdrop-blur-sm">
                <div className="w-9 h-9 rounded-xl bg-[#2563EB]/15 border border-[#60A5FA]/20 flex items-center justify-center flex-shrink-0">
                  <it.icon className="w-4 h-4 text-[#93C5FD]" />
                </div>
                <div>
                  <div className="font-bold text-sm text-white">{it.title}</div>
                  <div className="text-xs text-white/55 mt-0.5">{it.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coluna da direita — Formulário */}
        <form
          onSubmit={submit}
          noValidate
          className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-6 sm:p-8 shadow-2xl"
        >
          <div className="text-xs font-bold text-white/70 uppercase tracking-wider mb-5 flex items-center justify-between">
            <span>Cadastre-se em 1 minuto</span>
            <span className="text-[11px] text-[#93C5FD] font-normal normal-case">Sem taxa de adesão</span>
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

          {/* Mensagem de Erro Visual */}
          {error && (
            <div className="bg-rose-500/15 border border-rose-400/40 text-rose-200 text-xs p-3.5 rounded-xl mb-4 font-medium flex items-start gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          {/* Botão de Envio com type="submit" e onClick explícito */}
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
                <span>Quero ser parceiro</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-white/50 text-center mt-3 leading-relaxed">
            Aprovação manual da equipe. Você receberá um e-mail com as instruções assim que aprovado.
          </p>
        </form>
      </div>
    </div>
  );
}