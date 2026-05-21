// Cadastro público de parceiro — submete em partnerRegister.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { getDeviceFingerprint } from '@/lib/referralTracking';
import Logo from '@/components/Logo';
import { Loader2, CheckCircle2 } from 'lucide-react';

export default function PartnerRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', cpf_cnpj: '', pix_key: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const errMap = {
    rate_limited: 'Muitas tentativas. Aguarde alguns minutos.',
    name_required: 'Informe seu nome.',
    invalid_email: 'Email inválido.',
    invalid_phone: 'Telefone inválido.',
    cpf_cnpj_required: 'CPF ou CNPJ obrigatório.',
    email_already_registered: 'Já existe um cadastro com este email.',
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const fingerprint = getDeviceFingerprint();
      const res = await base44.functions.invoke('partnerRegister', { ...form, fingerprint });
      if (res?.data?.success) {
        setSuccess(true);
      } else {
        setError(errMap[res?.data?.error] || res?.data?.error || 'Erro ao enviar cadastro.');
      }
    } catch (err) {
      setError(errMap[err?.response?.data?.error] || 'Erro ao enviar cadastro.');
    } finally { setLoading(false); }
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
            Nosso time vai analisar seus dados e enviar um email assim que aprovar. Geralmente leva até 24h.
          </p>
          <button onClick={() => navigate('/parceiro/login')} className="w-full bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white font-bold py-3 rounded-xl">
            Ir para o login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050816] text-white">
      <header className="px-4 lg:px-8 py-5 border-b border-white/8 flex items-center justify-between">
        <Link to="/parceiro"><Logo size={32} /></Link>
        <Link to="/parceiro/login" className="text-sm text-white/65 hover:text-white">Já sou parceiro</Link>
      </header>

      <div className="max-w-md mx-auto px-4 py-8 lg:py-14">
        <h1 className="text-3xl font-black tracking-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent mb-2">
          Cadastro de parceiro
        </h1>
        <p className="text-white/55 text-sm mb-7">Receba 20% recorrente sobre cada barbearia que você indicar.</p>

        <form onSubmit={submit} className="space-y-3.5">
          <Field label="Nome completo" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Seu nome" />
          <Field label="Email" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="voce@exemplo.com" />
          <Field label="Telefone (WhatsApp)" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="(11) 99999-9999" />
          <Field label="CPF ou CNPJ" value={form.cpf_cnpj} onChange={v => setForm(f => ({ ...f, cpf_cnpj: v }))} placeholder="Somente números" />
          <Field label="Chave PIX (para receber comissão)" value={form.pix_key} onChange={v => setForm(f => ({ ...f, pix_key: v }))} placeholder="CPF, email, telefone ou chave aleatória" />

          {error && <div className="bg-rose-400/10 border border-rose-400/30 text-rose-200 text-xs p-3 rounded-lg">{error}</div>}

          <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] text-white font-bold py-3.5 rounded-xl shadow-[0_8px_24px_rgba(37,99,235,0.45)] disabled:opacity-60">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Enviando...' : 'Enviar cadastro'}
          </button>
          <p className="text-[11px] text-white/40 text-center mt-3">
            Ao cadastrar, você concorda com os <Link to="/termos-de-uso" className="underline text-white/60">Termos</Link>.
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-white/65 mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3.5 py-3 bg-white/[0.04] border border-white/12 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA]" />
    </div>
  );
}