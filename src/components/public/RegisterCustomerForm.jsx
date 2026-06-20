import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';

export default function RegisterCustomerForm({ companyId, onSuccess, onGoToLogin, primaryColor = '#2563EB' }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const validateForm = () => {
    const { name, email, phone, password, confirmPassword } = form;
    if (!name.trim()) return 'Nome obrigatório';
    if (!email.trim()) return 'Email obrigatório';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Email inválido';
    if (!phone.trim()) return 'Telefone obrigatório';
    if (phone.replace(/\D/g, '').length < 11) return 'Telefone deve ter 11 dígitos';
    if (password.length < 6) return 'Senha deve ter no mínimo 6 caracteres';
    if (password !== confirmPassword) return 'Senhas não conferem';
    if (!acceptedTerms) return 'Você deve aceitar os termos e política de privacidade';
    return '';
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    const validation = validateForm();
    if (validation) { setError(validation); return; }

    setLoading(true);
    try {
      const res = await base44.functions.invoke('customerAuth', {
        company_id: companyId,
        action: 'signup',
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.replace(/\D/g, ''),
        password: form.password,
      });

      if (!res?.data?.success) { setError(res?.data?.error || 'Falha ao criar conta. Tente novamente.'); return; }
      const { customer_id, token } = res.data;
      if (!customer_id || !token) { setError('Resposta inválida do servidor'); return; }
      localStorage.setItem(`bt_customer_token_${companyId}`, token);
      onSuccess(customer_id, token);
    } catch (err) {
      setError(err.message || 'Erro ao conectar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-3 border border-white/10 rounded-xl text-sm bg-white/5 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-black text-white mb-1">Criar conta</h3>
        <p className="text-sm text-white/40">Rápido e seguro</p>
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        {[
          { label: 'Nome', key: 'name', type: 'text', placeholder: 'Seu nome' },
          { label: 'Email', key: 'email', type: 'email', placeholder: 'seu@email.com' },
        ].map(f => (
          <div key={f.key}>
            <label className="text-xs font-semibold text-white/50 block mb-2">{f.label}</label>
            <input type={f.type} value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              placeholder={f.placeholder} className={inputClass} disabled={loading} />
          </div>
        ))}

        <div>
          <label className="text-xs font-semibold text-white/50 block mb-2">Telefone</label>
          <input type="tel" value={form.phone}
            onChange={(e) => { let val = e.target.value.replace(/\D/g, ''); if (val.length > 11) val = val.slice(0, 11); setForm({ ...form, phone: val }); }}
            placeholder="(11) 99999-9999" className={inputClass} disabled={loading} />
        </div>

        {[
          { label: 'Senha', key: 'password', show: showPassword, toggle: () => setShowPassword(p => !p), placeholder: 'Mínimo 6 caracteres' },
          { label: 'Confirmar Senha', key: 'confirmPassword', show: showConfirm, toggle: () => setShowConfirm(p => !p), placeholder: 'Confirme a senha' },
        ].map(f => (
          <div key={f.key}>
            <label className="text-xs font-semibold text-white/50 block mb-2">{f.label}</label>
            <div className="relative">
              <input type={f.show ? 'text' : 'password'} value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.placeholder} className={`${inputClass} pr-10`} disabled={loading} />
              <button type="button" onClick={f.toggle}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60" disabled={loading}>
                {f.show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        ))}

        <div className="flex items-start gap-2">
          <input type="checkbox" id="terms" checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="w-4 h-4 cursor-pointer mt-0.5" disabled={loading} />
          <label htmlFor="terms" className="text-xs text-white/40 cursor-pointer">
            Concordo com os{' '}
            <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="underline text-white/60 hover:text-white">Termos de Uso</a>
            {' '}e{' '}
            <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="underline text-white/60 hover:text-white">Política de Privacidade</a>
          </label>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={loading}
          className="w-full py-3 rounded-xl font-bold transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ backgroundColor: primaryColor, color: '#FFFFFF' }}>
          {loading && <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#FFFFFF' }} />}
          <span style={{ color: '#FFFFFF' }}>{loading ? 'Criando conta...' : 'Criar conta'}</span>
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-[#1a1a2e] text-white/30">ou</span>
        </div>
      </div>

      <button type="button" onClick={onGoToLogin}
        className="w-full py-3 rounded-xl font-bold text-white/80 border border-white/15 hover:bg-white/5 transition-colors" disabled={loading}>
        Já tenho conta
      </button>
    </div>
  );
}