import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Scissors, AlertCircle, ArrowLeft, Sun, Moon } from 'lucide-react';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { usePublicTheme } from '@/hooks/usePublicTheme';

export default function CustomerLoginPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isDark, toggle, tw } = usePublicTheme();

  const { data: companies = [], isLoading: loadingCo } = useQuery({
    queryKey: ['company-by-slug', slug],
    queryFn: () => base44.entities.Company.filter({ slug }),
    enabled: !!slug,
  });
  const company = companies[0];
  const primaryColor = company?.primary_color || '#2563EB';

  const { customer, login, loading: loadingAuth } = useCustomerAuth(company?.id);

  const [mode, setMode] = useState('check');
  const [form, setForm] = useState({ email: '', password: '', name: '', phone: '', resetToken: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rt = params.get('reset_token');
    const em = params.get('email');
    if (rt && em) {
      setForm(p => ({ ...p, resetToken: rt, email: em }));
      setMode('reset');
    }
  }, []);

  useEffect(() => {
    if (!loadingAuth && customer && mode !== 'reset') {
      navigate(`/cliente/${slug}`, { replace: true });
    }
  }, [customer, loadingAuth, navigate, slug, mode]);

  const handleCheck = async (e) => {
    e.preventDefault();
    if (!form.email.trim()) { setError('Informe seu e-mail'); return; }
    setError(''); setSubmitting(true);
    try {
      const res = await base44.functions.invoke('customerAuth', {
        action: 'check', company_id: company.id, email: form.email.trim().toLowerCase(),
      });
      const data = res?.data || {};
      if (data.exists && data.has_password) { setMode('login'); }
      else { setMode('signup'); if (data.name) setForm(p => ({ ...p, name: data.name })); }
    } catch (err) { setError(err?.message || 'Erro ao verificar e-mail'); }
    finally { setSubmitting(false); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!form.password) { setError('Informe sua senha'); return; }
    setError(''); setSubmitting(true);
    try {
      const res = await base44.functions.invoke('customerAuth', {
        action: 'login', company_id: company.id,
        email: form.email.trim().toLowerCase(), password: form.password,
      });
      if (res?.data?.success) {
        login(res.data.token, res.data.customer || { id: res.data.customer_id });
        navigate(`/cliente/${slug}`, { replace: true });
      } else { setError(res?.data?.error || 'E-mail ou senha incorretos'); }
    } catch (err) { setError(err?.response?.data?.error || err?.message || 'Erro ao entrar'); }
    finally { setSubmitting(false); }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Informe seu nome'); return; }
    if (!form.phone.trim() || form.phone.replace(/\D/g, '').length < 10) { setError('Informe um WhatsApp válido'); return; }
    if (!form.password || form.password.length < 6) { setError('A senha precisa ter pelo menos 6 caracteres'); return; }
    setError(''); setSubmitting(true);
    try {
      const res = await base44.functions.invoke('customerAuth', {
        action: 'signup', company_id: company.id,
        email: form.email.trim().toLowerCase(), password: form.password,
        name: form.name.trim(), phone: form.phone.replace(/\D/g, ''),
      });
      if (res?.data?.success) {
        login(res.data.token, res.data.customer || { id: res.data.customer_id });
        navigate(`/cliente/${slug}`, { replace: true });
      } else { setError(res?.data?.error || 'Erro ao criar conta'); }
    } catch (err) { setError(err?.response?.data?.error || err?.message || 'Erro ao criar conta'); }
    finally { setSubmitting(false); }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    if (!form.email.trim()) { setError('Informe seu e-mail'); return; }
    setError(''); setInfo(''); setSubmitting(true);
    try {
      await base44.functions.invoke('customerAuth', {
        action: 'request_reset', company_id: company.id, email: form.email.trim().toLowerCase(),
      });
      setInfo('Se este e-mail tiver cadastro, enviamos um link. Verifique sua caixa de entrada (e o spam).');
    } catch (err) { setError(err?.response?.data?.error || err?.message || 'Erro ao solicitar redefinição'); }
    finally { setSubmitting(false); }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (!form.password || form.password.length < 6) { setError('A senha precisa ter pelo menos 6 caracteres'); return; }
    setError(''); setSubmitting(true);
    try {
      const res = await base44.functions.invoke('customerAuth', {
        action: 'reset_password', company_id: company.id,
        email: form.email.trim().toLowerCase(), reset_token: form.resetToken, password: form.password,
      });
      if (res?.data?.success) {
        login(res.data.token, res.data.customer || { id: res.data.customer_id });
        navigate(`/cliente/${slug}`, { replace: true });
      } else { setError(res?.data?.error || 'Erro ao redefinir senha'); }
    } catch (err) { setError(err?.response?.data?.error || err?.message || 'Erro ao redefinir senha'); }
    finally { setSubmitting(false); }
  };

  const inputClass = `w-full px-4 py-3 border rounded-xl text-sm ${tw.input}`;
  const emailDisplay = isDark
    ? 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm'
    : 'bg-gray-50 border border-black/8 rounded-lg px-3 py-2 text-sm';

  if (loadingCo || loadingAuth) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${tw.bg}`}>
        <div className="w-8 h-8 border-4 border-white/20 border-t-white/70 rounded-full animate-spin" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${tw.bg} p-6`}>
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-orange-400 mx-auto mb-3" />
          <p className={`font-semibold ${tw.text}`}>Barbearia não encontrada</p>
        </div>
      </div>
    );
  }

  const titles = {
    check: 'Entrar / Criar conta',
    login: 'Bem-vindo de volta',
    signup: 'Criar sua conta',
    forgot: 'Esqueci minha senha',
    reset: 'Criar nova senha',
  };
  const subtitles = {
    check: 'Acesse sua conta para gerenciar seus agendamentos e planos.',
    login: 'Entre com sua senha para continuar.',
    signup: 'Crie uma senha para acompanhar seus agendamentos.',
    forgot: 'Informe seu e-mail e enviaremos um link de redefinição.',
    reset: 'Defina uma nova senha para sua conta.',
  };

  return (
    <div className={`min-h-screen ${tw.bg} flex flex-col`}>
      <header className={`${tw.header} border-b px-6 py-4`}>
        <div className="max-w-md mx-auto flex items-center gap-3">
          <Link to={`/agendar/${slug}`} className={`p-1 -ml-1 rounded hover:opacity-70 ${tw.textMuted}`}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
            <Scissors className="w-4 h-4 text-white" />
          </div>
          <span className={`font-bold text-sm ${tw.text} flex-1 truncate`}>{company.name}</span>
          <button onClick={toggle} className={`w-8 h-8 rounded-full flex items-center justify-center ${tw.logoutBtn}`}>
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className={`${tw.card} rounded-3xl shadow-lg p-8 w-full max-w-sm`}>
          <h1 className={`text-2xl font-black ${tw.text} mb-2`}>{titles[mode]}</h1>
          <p className={`text-sm ${tw.textMuted} mb-6`}>{subtitles[mode]}</p>

          {mode === 'check' && (
            <form onSubmit={handleCheck} className="space-y-3">
              <div>
                <label className={`text-xs font-semibold ${tw.textMuted} block mb-1`}>E-mail</label>
                <input type="email" autoFocus value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="seu@email.com" className={inputClass} />
              </div>
              {error && <div className={`text-sm text-red-500 flex items-center gap-2`}><AlertCircle className="w-4 h-4" />{error}</div>}
              <button type="submit" disabled={submitting}
                className="w-full text-white font-bold py-3.5 rounded-xl text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: primaryColor }}>
                {submitting ? 'Verificando...' : 'Continuar'}
              </button>
            </form>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3">
              <div className={emailDisplay}>
                <span className={`text-xs ${tw.textFaint}`}>E-mail</span>
                <div className={`font-semibold truncate ${tw.text}`}>{form.email}</div>
              </div>
              <div>
                <label className={`text-xs font-semibold ${tw.textMuted} block mb-1`}>Senha</label>
                <input type="password" autoFocus value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className={inputClass} />
              </div>
              {error && <div className="text-sm text-red-500 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
              <button type="submit" disabled={submitting}
                className="w-full text-white font-bold py-3.5 rounded-xl text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: primaryColor }}>
                {submitting ? 'Entrando...' : 'Entrar'}
              </button>
              <div className="flex items-center justify-between mt-2">
                <button type="button" onClick={() => { setMode('check'); setError(''); setForm(p => ({ ...p, password: '' })); }}
                  className={`text-xs ${tw.textMuted} hover:opacity-70`}>
                  Usar outro e-mail
                </button>
                <button type="button" onClick={() => { setMode('forgot'); setError(''); setInfo(''); setForm(p => ({ ...p, password: '' })); }}
                  className="text-xs font-semibold hover:underline" style={{ color: primaryColor }}>
                  Esqueci minha senha
                </button>
              </div>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-3">
              <div>
                <label className={`text-xs font-semibold ${tw.textMuted} block mb-1`}>E-mail</label>
                <input type="email" autoFocus value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="seu@email.com" className={inputClass} />
              </div>
              {error && <div className="text-sm text-red-500 flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
              {info && <div className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg p-3">{info}</div>}
              {!info && (
                <button type="submit" disabled={submitting}
                  className="w-full text-white font-bold py-3.5 rounded-xl text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}>
                  {submitting ? 'Enviando...' : 'Enviar link de redefinição'}
                </button>
              )}
              <button type="button" onClick={() => { setMode('check'); setError(''); setInfo(''); }}
                className={`w-full text-xs ${tw.textMuted} hover:opacity-70 mt-2`}>
                Voltar
              </button>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleReset} className="space-y-3">
              <div className={emailDisplay}>
                <span className={`text-xs ${tw.textFaint}`}>E-mail</span>
                <div className={`font-semibold truncate ${tw.text}`}>{form.email}</div>
              </div>
              <div>
                <label className={`text-xs font-semibold ${tw.textMuted} block mb-1`}>Nova senha</label>
                <input type="password" autoFocus value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="Mínimo 6 caracteres" className={inputClass} />
              </div>
              {error && <div className="text-sm text-red-500 flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
              <button type="submit" disabled={submitting}
                className="w-full text-white font-bold py-3.5 rounded-xl text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: primaryColor }}>
                {submitting ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </form>
          )}

          {mode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-3">
              <div className={emailDisplay}>
                <span className={`text-xs ${tw.textFaint}`}>E-mail</span>
                <div className={`font-semibold truncate ${tw.text}`}>{form.email}</div>
              </div>
              {[
                { label: 'Nome completo', key: 'name', type: 'text', placeholder: '' },
                { label: 'WhatsApp', key: 'phone', type: 'tel', placeholder: '(11) 99999-9999' },
              ].map(f => (
                <div key={f.key}>
                  <label className={`text-xs font-semibold ${tw.textMuted} block mb-1`}>{f.label}</label>
                  <input type={f.type} value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} className={inputClass} />
                </div>
              ))}
              <div>
                <label className={`text-xs font-semibold ${tw.textMuted} block mb-1`}>Crie uma senha</label>
                <input type="password" value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="Mínimo 6 caracteres" className={inputClass} />
              </div>
              {error && <div className="text-sm text-red-500 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
              <button type="submit" disabled={submitting}
                className="w-full text-white font-bold py-3.5 rounded-xl text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: primaryColor }}>
                {submitting ? 'Criando conta...' : 'Criar conta'}
              </button>
              <button type="button" onClick={() => { setMode('check'); setError(''); }}
                className={`w-full text-xs ${tw.textMuted} hover:opacity-70 mt-2`}>
                Usar outro e-mail
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}