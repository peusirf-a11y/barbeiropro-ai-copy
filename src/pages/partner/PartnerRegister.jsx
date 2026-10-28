// Cadastro público enxuto de parceiro — submete em partnerRegister.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { getDeviceFingerprint } from '@/lib/referralTracking';
import Logo from '@/components/Logo';
import { Loader2, CheckCircle2, Gift } from 'lucide-react';

export default function PartnerRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', pix_key: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const errMap = {
    rate_limited: 'Muitas tentativas. Aguarde alguns minutos.',
    name_required: 'Informe seu nome completo ou Razão Social.',
    invalid_email: 'E-mail inválido.',
    invalid_phone: 'WhatsApp inválido.',
    invalid_password: 'Crie uma senha com pelo menos 8 caracteres.',
    email_already_registered: 'Já existe um cadastro com este e-mail.',
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) {
      setError('Informe seu nome completo ou Razão Social.');
      return;
    }
    if (!form.email.trim() || !form.email.includes('@')) {
      setError('Informe um e-mail válido.');
      return;
    }
    if (!form.phone.trim() || form.phone.trim().length < 8) {
      setError('Informe seu WhatsApp com DDD.');
      return;
    }
    if (!form.pix_key.trim()) {
      setError('Informe sua chave Pix para receber as comissões.');
      return;
    }
    if (!form.password || form.password.length < 8) {
      setError('Crie uma senha com pelo menos 8 caracteres.');
      return;
    }
    setLoading(true);
    try {
      const fingerprint = getDeviceFingerprint();
      const res = await base44.functions.invoke('partnerRegister', { ...form, commission_percentage: 30, fingerprint });
      if (res?.data?.success) {
        setSuccess(true);
      } else {
        setError(errMap[res?.data?.error] || res?.data?.error || 'Erro ao enviar cadastro.');
      }
    } catch (err) {
      setError(errMap[err?.response?.data?.error] || 'Erro ao enviar cadastro.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#050816] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white/[0.03] border border-emerald-400/20 rounded-2xl p-8 text-center backdrop-blur-xl">
          <div className="w-14 h-14 bg-emerald-400/15 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-emerald-300" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Cadastro enviado! 🎉</h1>
          <p className="text-sm text-white/65 mb-6">
            Nosso time vai analisar seus dados e enviar um e-mail assim que aprovar.
          </p>
          <button onClick={() => navigate('/parceiro/login')} className="w-full bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white font-bold py-3 rounded-xl">
            Ir para o login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050816] text-white flex flex-col justify-between">
      <header className="px-4 lg:px-8 py-5 border-b border-white/8 flex items-center justify-between">
        <Link to="/parceiro"><Logo size={32} /></Link>
        <Link to="/parceiro/login" className="text-sm text-white/65 hover:text-white">Já sou parceiro</Link>
      </header>

      <div className="max-w-md w-full mx-auto px-4 py-8 lg:py-12">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h1 className="text-2xl font-black tracking-tight text-white">
            Cadastre-se como Parceiro
          </h1>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#2563EB]/20 border border-[#60A5FA]/30 text-[#93C5FD]">
            30% recorrente
          </span>
        </div>
        <p className="text-white/55 text-sm mb-6">
          Ganhe 30% todo mês por cada barbearia indicada durante 1 ano inteiro.
        </p>

        <form onSubmit={submit} className="space-y-3.5">
          <Field label="Nome completo ou Razão Social *" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Seu nome ou empresa" />
          <Field label="E-mail *" type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="voce@exemplo.com" />
          <Field label="WhatsApp (com DDD) *" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="(11) 99999-9999" />
          <Field label="Chave Pix (para receber as comissões) *" value={form.pix_key} onChange={(v) => setForm((f) => ({ ...f, pix_key: v }))} placeholder="CPF, CNPJ, e-mail, celular ou aleatória" />
          <Field label="Senha de acesso (mínimo 8 caracteres) *" type="password" value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} placeholder="Crie sua senha de acesso" />

          {error && <div className="bg-rose-400/10 border border-rose-400/30 text-rose-200 text-xs p-3 rounded-lg">{error}</div>}

          <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] text-white font-bold py-3.5 rounded-xl shadow-[0_8px_24px_rgba(37,99,235,0.45)] disabled:opacity-60">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
            {loading ? 'Cadastrando...' : 'Quero ser parceiro oficial'}
          </button>
          <p className="text-[11px] text-white/50 text-center mt-3">
            Repasses mensais via Pix • Sem taxa de adesão • Cancele quando quiser
          </p>
        </form>
      </div>

      <footer className="py-6 text-center border-t border-white/5">
        <Link to="/termos-de-uso" className="text-xs text-white/40 hover:text-white/70 transition-colors underline underline-offset-4">
          Termos do Programa de Parceiros
        </Link>
      </footer>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-white/65 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/12 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA]"
      />
    </div>
  );
}