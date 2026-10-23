// CriarSenha — Tela pós-checkout com persistência 100% real no Supabase (companies e auth.users)
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import Logo from '@/components/Logo';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Sparkles,
  Building2,
} from 'lucide-react';

const PLAN_LABEL = { starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' };

function passwordStrength(p) {
  if (!p) return { ok: false, msg: '' };
  if (p.length < 8) return { ok: false, msg: 'Mínimo de 8 caracteres.' };
  if (!/[A-Za-z]/.test(p)) return { ok: false, msg: 'Precisa de ao menos 1 letra.' };
  if (!/\d/.test(p)) return { ok: false, msg: 'Precisa de ao menos 1 número.' };
  return { ok: true, msg: 'Senha forte.' };
}

export default function CriarSenha() {
  const navigate = useNavigate();
  const { setUser, setIsAuthenticated } = useAuth();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);

  let localCheckout = {};
  try {
    const raw = localStorage.getItem('barberpass_checkout_data');
    if (raw) localCheckout = JSON.parse(raw);
  } catch (_) {}

  const initialEmail = (params.get('email') || localCheckout.email || localStorage.getItem('barberpass_auth_email') || '').trim().toLowerCase();
  const planKey = (params.get('plan') || localCheckout.plan || 'pro').toLowerCase();
  const planName = PLAN_LABEL[planKey] || 'Pro';
  const nomeBarbearia = (params.get('business') || localCheckout.business_name || '').trim();
  const nomeResponsavel = (params.get('owner') || localCheckout.owner_name || '').trim();
  const whatsapp = (params.get('phone') || localCheckout.phone || '').trim();
  const cnpj = (params.get('cnpj') || localCheckout.cnpj || '').trim();

  const [emailInput, setEmailInput] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [statusStep, setStatusStep] = useState('');

  const strength = passwordStrength(password);
  const cleanEmail = emailInput.trim().toLowerCase();
  const canSubmit = !!cleanEmail && cleanEmail.includes('@') && strength.ok && password === confirm && !submitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setStatusStep('Verificando conexão...');
    setSubmitting(true);

    if (!isSupabaseConfigured || !supabase) {
      setError('Cliente Supabase não está configurado.');
      setSubmitting(false);
      return;
    }

    try {
      const targetBusinessName = nomeBarbearia || `Barbearia ${cleanEmail.split('@')[0]}`;
      const targetOwnerName = nomeResponsavel || 'Proprietário';
      const targetEmail = cleanEmail;

      // 1. PERSISTÊNCIA NA TABELA `companies` NO SUPABASE
      setStatusStep('Cadastrando empresa no Supabase...');
      const slugBase = targetBusinessName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'barbearia';

      // Gera slug único
      const slug = `${slugBase}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Primeiro verifica se empresa para este owner_email já foi criada
      let targetCompany = null;
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id, name, slug, owner_email, phone, whatsapp, cnpj, active, created_at')
        .eq('owner_email', targetEmail)
        .maybeSingle();

      if (existingCompany) {
        console.log('[CriarSenha] Empresa existente encontrada no Supabase:', existingCompany.id);
        targetCompany = existingCompany;
      } else {
        // Tenta INSERT completo conforme especificado
        let insertData = {
          name: targetBusinessName,
          slug: slug,
          owner_name: targetOwnerName,
          owner_email: targetEmail,
          phone: whatsapp || null,
          whatsapp: whatsapp || null,
          cnpj: cnpj || null,
          plan: planKey || 'pro',
          active: true,
          payment_status: 'paid',
          onboarding_completed: true,
          created_at: new Date().toISOString()
        };

        console.log('[CriarSenha] Executando INSERT em companies:', insertData);
        let { data: newCompany, error: companyError } = await supabase
          .from('companies')
          .insert([insertData])
          .select('id, name, slug, owner_email, phone, whatsapp, cnpj, active, created_at')
          .single();

        // Se o schema cache não contiver colunas adicionais (ex: owner_name, plan), faz fallback para colunas base
        if (companyError && (companyError.code === 'PGRST204' || companyError.message?.includes('column'))) {
          console.warn('[CriarSenha] Ajustando payload para colunas base suportadas no banco:', companyError.message);
          const baseData = {
            name: targetBusinessName,
            slug: slug,
            owner_email: targetEmail,
            phone: whatsapp || null,
            whatsapp: whatsapp || null,
            cnpj: cnpj || null,
            active: true,
            created_at: new Date().toISOString()
          };
          const fallbackRes = await supabase
            .from('companies')
            .insert([baseData])
            .select('id, name, slug, owner_email, phone, whatsapp, cnpj, active, created_at')
            .single();
          newCompany = fallbackRes.data;
          companyError = fallbackRes.error;
        }

        // Se houver conflito de slug único (23505), gera com timestamp
        if (companyError && companyError.code === '23505') {
          const uniqueSlug = `${slugBase}-${Date.now().toString().slice(-6)}`;
          const retrySlug = await supabase
            .from('companies')
            .insert([{
              name: targetBusinessName,
              slug: uniqueSlug,
              owner_email: targetEmail,
              phone: whatsapp || null,
              whatsapp: whatsapp || null,
              cnpj: cnpj || null,
              active: true,
              created_at: new Date().toISOString()
            }])
            .select('id, name, slug, owner_email, phone, whatsapp, cnpj, active, created_at')
            .single();
          newCompany = retrySlug.data;
          companyError = retrySlug.error;
        }

        if (companyError) {
          console.warn('[Supabase Company Warning] Falha ao persistir Company:', companyError.message);
          setError(`Erro ao cadastrar empresa no Supabase: ${companyError.message || 'Falha no INSERT'}`);
          setSubmitting(false);
          return;
        }

        targetCompany = newCompany;
      }

      // 2. CRIAÇÃO DO UTILIZADOR EM `auth.users`
      setStatusStep('Criando usuário de acesso no Supabase Auth...');
      console.log('[CriarSenha] Criando usuário auth.users:', { email: targetEmail, company_id: targetCompany?.id });

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: targetEmail,
        password: password.trim(),
        options: {
          data: {
            name: targetOwnerName,
            company_id: targetCompany?.id,
            role: 'admin' // role de dono da barbearia (tenant)
          }
        }
      });

      if (authError) {
        // Se já existir conta criada, prossegue para login direto com a senha
        if (authError.message?.toLowerCase().includes('already') || authError.status === 422) {
          console.log('[CriarSenha] Usuário já registrado no auth, procedendo com login...');
        } else {
          console.warn('[Supabase Auth Warning] Erro no signUp:', authError.message);
          if (authError.message?.toLowerCase().includes('invalid') || authError.message?.toLowerCase().includes('email')) {
            setError(`O Supabase rejeitou o domínio do e-mail "${targetEmail}". Utilize um e-mail válido com provedor real (ex.: @gmail.com, @hotmail.com, @outlook.com ou domínio corporativo próprio).`);
          } else {
            setError(`Erro ao criar utilizador no Supabase: ${authError.message}`);
          }
          setSubmitting(false);
          return;
        }
      }

      // 3. VINCULAÇÃO E LOGIN IMEDIATO
      setStatusStep('Autenticando e abrindo seu painel...');
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: password.trim(),
      });

      if (loginError && !authData?.session) {
        console.warn('[Supabase Login Warning] Erro no login imediato:', loginError.message);
        setError(`Conta registrada com sucesso! Porém houve falha ao logar automaticamente: ${loginError.message}. Por favor, faça login pela página de login.`);
        setSubmitting(false);
        return;
      }

      const activeUser = loginData?.user || authData?.user;
      if (activeUser) {
        activeUser.company_id = targetCompany?.id;
        activeUser.role = 'admin';
        setUser?.(activeUser);
        setIsAuthenticated?.(true);

        try {
          localStorage.setItem('admin_logged_user', JSON.stringify(activeUser));
          localStorage.setItem('barberpass_auth_email', targetEmail);
          localStorage.removeItem('barberpass_checkout_data');
        } catch (_) {}
      }

      // Redireciona com sucesso direto para o painel da barbearia
      console.log('[CriarSenha] Sucesso completo! Redirecionando para /app/dashboard');
      navigate('/app/dashboard', { replace: true });

    } catch (err) {
      console.warn('[CriarSenha] Erro inesperado ao finalizar checkout:', err?.message);
      setError(`Erro no processo de contratação: ${err?.message || 'Falha de comunicação'}`);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] font-inter">
      <header className="bg-white/80 backdrop-blur-sm border-b border-black/5 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Logo size={32} />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Ativação de Assinatura
          </span>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-14 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#2563EB]/10 text-[#2563EB] mb-4 shadow-sm">
            <KeyRound className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight mb-2">
            Crie sua senha de acesso
          </h1>
          <p className="text-sm sm:text-base text-gray-500 max-w-md mx-auto">
            Pagamento confirmado! Crie a senha para acessar o painel da sua barbearia.
          </p>
        </div>

        {/* Resumo da conta */}
        <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-3">
            <SummaryItem icon={Building2} label="Barbearia" value={nomeBarbearia || 'Sua Barbearia'} />
            <SummaryItem icon={Sparkles} label="Plano" value={`O CORTE · ${planName}`} />
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-black/8 shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Email de acesso da barbearia
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                autoComplete="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                disabled={submitting}
                placeholder="seu@email.com (use domínio válido: @gmail, @outlook, etc.)"
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-sm text-[#0F172A] placeholder-gray-400"
                required
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              O Supabase exige um domínio de e-mail autêntico para autenticação e recuperação de senha.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Nova senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                placeholder="Mínimo 8 caracteres"
                autoFocus
                className="w-full h-11 pl-10 pr-10 rounded-xl border border-gray-200 bg-white text-sm text-[#0F172A] placeholder-gray-400"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {password && (
              <div className={`mt-1.5 text-[11px] font-semibold ${strength.ok ? 'text-emerald-600' : 'text-amber-600'}`}>
                {strength.msg}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Confirmar senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={submitting}
                placeholder="Repita a senha"
                className="w-full h-11 pl-10 pr-3 rounded-xl border border-gray-200 bg-white text-sm text-[#0F172A] placeholder-gray-400"
              />
            </div>
            {confirm && password !== confirm && (
              <div className="mt-1.5 text-[11px] font-semibold text-amber-600">
                As senhas não coincidem.
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 flex items-start gap-3 text-sm text-rose-800">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-rose-600" />
              <div className="space-y-1">
                <div className="font-bold">Aviso do Supabase</div>
                <div className="text-xs leading-relaxed">{error}</div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full h-12 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-bold transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{statusStep || 'Processando no Supabase…'}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Criar senha e entrar
              </>
            )}
          </button>

          <Link
            to={`/login?email=${encodeURIComponent(cleanEmail)}`}
            className="block text-center text-xs font-semibold text-gray-500 hover:text-[#2563EB]"
          >
            Já tenho senha — ir para o login
          </Link>
        </form>
      </div>
    </div>
  );
}

function SummaryItem({ icon: Icon, label, value, valueClass = '' }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-[#2563EB]/8 text-[#2563EB] flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">{label}</div>
        <div className={`text-sm font-semibold text-[#0F172A] truncate ${valueClass}`}>{value}</div>
      </div>
    </div>
  );
}