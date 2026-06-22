// Landing pública do programa de parceiros — exibe explicação + formulário de cadastro.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import AppBackgroundLayer from '@/components/layout/AppBackgroundLayer';
import BrandMark from '@/components/BrandMark';
import { Loader2, CheckCircle, Gift, TrendingUp, Shield, ArrowRight } from 'lucide-react';
import { getDeviceFingerprint } from '@/lib/referralTracking';

export default function PartnerLanding() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', cpf_cnpj: '', pix_key: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  const submit = async (e) => {
    e?.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.cpf_cnpj.trim()) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }
    if (!form.password || form.password.length < 8) {
      setError('Crie uma senha com pelo menos 8 caracteres.');
      return;
    }
    setLoading(true);
    try {
      const fingerprint = getDeviceFingerprint();
      const { data } = await base44.functions.invoke('partnerRegister', { ...form, fingerprint });
      if (data?.success) setSuccess(data.partner);
      else setError(data?.message || data?.error || 'Erro ao cadastrar.');
    } catch (err) {
      setError(err?.message || 'Erro ao cadastrar.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-white">
        <AppBackgroundLayer />
        <div className="relative max-w-md w-full rounded-2xl border border-emerald-400/30 bg-emerald-500/10 backdrop-blur-xl p-8 text-center">
          <CheckCircle className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
          <h1 className="text-2xl font-black mb-2">Cadastro recebido!</h1>
          <p className="text-sm text-white/75 mb-5">Seu cadastro está em análise. Avisaremos por email assim que for aprovado.</p>
          <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4 text-left text-sm space-y-1">
            <div><span className="text-white/55">Nome:</span> <span className="font-semibold">{success.name}</span></div>
            <div><span className="text-white/55">Email:</span> <span className="font-semibold">{success.email}</span></div>
            <div><span className="text-white/55">Código provisório:</span> <span className="font-mono font-bold text-[#93C5FD]">{success.referral_code}</span></div>
          </div>
          <Link to="/parceiro/login" className="inline-block mt-6 text-sm text-[#93C5FD] hover:underline">Já tem cadastro? Entrar →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <AppBackgroundLayer />
      <header className="relative max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
        <Link to="/landing"><BrandMark size={32} tone="dark" /></Link>
        <Link to="/parceiro/login" className="text-sm text-white/70 hover:text-white">Entrar →</Link>
      </header>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12 grid lg:grid-cols-2 gap-10">
        <div>
          <div className="inline-flex items-center gap-2 bg-[#2563EB]/15 border border-[#60A5FA]/25 text-[#93C5FD] text-xs font-bold px-3 py-1.5 rounded-full mb-5">
            <Gift className="w-3 h-3" /> PROGRAMA DE PARCEIROS
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent mb-4">
            Indique. Ganhe. Para sempre.
          </h1>
          <p className="text-white/65 text-base sm:text-lg leading-relaxed mb-6">
            Ganhe <strong className="text-white">20% de comissão recorrente</strong> sobre cada barbearia que assinar o O CORTE pela sua indicação. Comissão mensal enquanto a barbearia estiver ativa.
          </p>
          <div className="space-y-3 mb-6">
            {[
              { icon: TrendingUp, title: 'Renda recorrente', desc: 'Comissão todo mês, sem teto e sem prazo de expiração.' },
              { icon: Shield, title: 'Pagamento garantido', desc: 'Após 15 dias de hold anti-fraude, sua comissão é liberada.' },
              { icon: ArrowRight, title: 'Link próprio', desc: 'Seu código único rastreado por 90 dias após o clique.' },
            ].map((it, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/8">
                <div className="w-9 h-9 rounded-lg bg-[#2563EB]/15 border border-[#60A5FA]/20 flex items-center justify-center flex-shrink-0">
                  <it.icon className="w-4 h-4 text-[#93C5FD]" />
                </div>
                <div>
                  <div className="font-bold text-sm">{it.title}</div>
                  <div className="text-xs text-white/55">{it.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 sm:p-7 h-fit">
          <div className="text-xs font-bold text-white/60 uppercase tracking-wider mb-4">Cadastre-se em 1 minuto</div>
          {[
            { k: 'name', label: 'Nome completo *', type: 'text' },
            { k: 'email', label: 'Email *', type: 'email' },
            { k: 'phone', label: 'WhatsApp *', type: 'tel', placeholder: '(11) 99999-9999' },
            { k: 'cpf_cnpj', label: 'CPF ou CNPJ *', type: 'text' },
            { k: 'pix_key', label: 'Chave PIX para receber', type: 'text' },
            { k: 'password', label: 'Senha de acesso * (mín. 8 caracteres)', type: 'password' },
          ].map(f => (
            <div key={f.k} className="mb-3">
              <label className="block text-[11px] font-semibold text-white/60 mb-1">{f.label}</label>
              <input
                type={f.type}
                value={form[f.k]}
                onChange={e => setForm(p => ({ ...p, [f.k]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20"
              />
            </div>
          ))}
          {error && <div className="bg-rose-500/10 border border-rose-400/30 text-rose-300 text-xs p-3 rounded-lg mb-3">{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white font-bold py-3 rounded-xl text-sm shadow-[0_8px_24px_rgba(37,99,235,0.4)] hover:brightness-110 active:scale-[0.99] disabled:opacity-60 transition-all">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
            {loading ? 'Enviando...' : 'Quero ser parceiro'}
          </button>
          <p className="text-[11px] text-white/40 text-center mt-3">
            Aprovação manual. Você receberá um email quando o cadastro for aprovado.
          </p>
        </form>
      </div>
    </div>
  );
}