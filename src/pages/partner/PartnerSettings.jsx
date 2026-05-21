import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import PartnerLayout from '@/components/partner/PartnerLayout';
import { getPartnerToken, useCurrentPartner } from '@/hooks/usePartnerAuth';
import { Loader2, Save, CheckCircle2 } from 'lucide-react';

export default function PartnerSettings() {
  const token = getPartnerToken();
  const { partner, refresh } = useCurrentPartner();
  const [form, setForm] = useState({ name: '', phone: '', pix_key: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (partner) setForm({ name: partner.name || '', phone: partner.phone || '', pix_key: partner.pix_key || '' });
  }, [partner]);

  const submit = async (e) => {
    e?.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await base44.functions.invoke('partnerAuth', { action: 'update_profile', token, ...form });
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PartnerLayout>
      <div className="mb-5">
        <h1 className="text-2xl font-black tracking-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">Configurações</h1>
        <p className="text-white/50 text-sm mt-1">Atualize seus dados e a chave PIX para receber comissões.</p>
      </div>

      <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-white/60 mb-1">Nome completo</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-white/60 mb-1">WhatsApp</label>
            <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-white/60 mb-1">Chave PIX</label>
            <input value={form.pix_key} onChange={e => setForm(p => ({ ...p, pix_key: e.target.value }))}
              placeholder="CPF, email, telefone ou chave aleatória"
              className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
            <p className="text-[11px] text-white/40 mt-1">Sem chave PIX, suas comissões aprovadas ficam aguardando.</p>
          </div>
          <div className="pt-2 border-t border-white/8 grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-white/50">Email:</span> <span className="font-semibold">{partner?.email}</span></div>
            <div><span className="text-white/50">Código:</span> <span className="font-mono font-bold text-[#93C5FD]">{partner?.referral_code}</span></div>
            <div><span className="text-white/50">Comissão:</span> <span className="font-semibold">{partner?.commission_percentage}%</span></div>
            <div><span className="text-white/50">Status:</span> <span className="font-semibold text-emerald-300">{partner?.status === 'active' ? 'Ativo' : partner?.status}</span></div>
          </div>
        </div>
        <button type="submit" disabled={saving}
          className="mt-5 inline-flex items-center gap-2 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:brightness-110 active:scale-[0.98] disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar alterações'}
        </button>
      </form>
    </PartnerLayout>
  );
}