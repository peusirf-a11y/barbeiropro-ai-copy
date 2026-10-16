import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import PartnerLayout from '@/components/partner/PartnerLayout';
import { getPartnerToken, useCurrentPartner } from '@/hooks/usePartnerAuth';
import { Loader2, Save, CheckCircle2, User, Phone, Key, Shield, AlertCircle, Copy } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

export default function PartnerSettings() {
  const token = getPartnerToken();
  const { partner, isLoading, refresh } = useCurrentPartner();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    pix_key: '',
    cpf_cnpj: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (partner) {
      setForm({
        name: partner?.name || partner?.full_name || '',
        phone: partner?.phone || partner?.whatsapp || '',
        pix_key: partner?.pix_key || '',
        cpf_cnpj: partner?.cpf_cnpj || '',
      });
    }
  }, [partner]);

  const submit = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');

    try {
      console.log('[PartnerSettings] Salvando alterações do perfil...', form);

      // 1. Atualiza no Supabase se disponível
      if (isSupabaseConfigured && supabase && partner?.email) {
        try {
          await supabase
            .from('partners')
            .update({
              full_name: form.name.trim(),
              name: form.name.trim(),
              phone: form.phone.trim(),
              pix_key: form.pix_key.trim(),
              cpf_cnpj: form.cpf_cnpj.trim(),
              updated_at: new Date().toISOString(),
            })
            .eq('email', partner.email.toLowerCase().trim());
        } catch (supaErr) {
          console.warn('[PartnerSettings] Erro ao atualizar no Supabase:', supaErr);
        }
      }

      // 2. Atualiza via partnerAuth
      const res = await base44.functions.invoke('partnerAuth', {
        action: 'update_profile',
        token,
        name: form.name.trim(),
        phone: form.phone.trim(),
        pix_key: form.pix_key.trim(),
        cpf_cnpj: form.cpf_cnpj.trim(),
      });

      console.log('[PartnerSettings] Resposta do update_profile:', res);

      await refresh();
      setSaved(true);
      toast({ title: 'Perfil atualizado!', description: 'Suas alterações foram salvas com sucesso.' });
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('[PartnerSettings] Erro ao salvar:', err);
      setError(err?.message || 'Falha ao salvar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  const copyCode = (code) => {
    const targetCode = typeof code === 'string' ? code : partner?.referral_code;
    if (targetCode) {
      try {
        navigator.clipboard?.writeText(targetCode);
        toast({ title: 'Código copiado!', description: targetCode });
      } catch (_) {}
    }
  };

  if (isLoading) {
    return (
      <PartnerLayout>
        <div className="p-12 text-center text-white/50 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#60A5FA]" />
          <span>Carregando dados do parceiro...</span>
        </div>
      </PartnerLayout>
    );
  }

  return (
    <PartnerLayout>
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-black tracking-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
          Configurações do Perfil
        </h1>
        <p className="text-white/50 text-sm mt-1">
          Atualize seus dados cadastrais e a chave PIX para recebimento das comissões.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl">
        {/* Formulário Principal */}
        <form onSubmit={submit} className="lg:col-span-2 rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8 space-y-5 shadow-2xl">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-200 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1.5">
              Nome Completo
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Seu nome completo"
                className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1.5">
              WhatsApp com DDD
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="(11) 99999-9999"
                className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1.5">
              CPF ou CNPJ
            </label>
            <input
              type="text"
              value={form.cpf_cnpj}
              onChange={(e) => setForm((p) => ({ ...p, cpf_cnpj: e.target.value }))}
              placeholder="000.000.000-00"
              className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1.5">
              Chave PIX para Recebimento
            </label>
            <div className="relative">
              <Key className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={form.pix_key}
                onChange={(e) => setForm((p) => ({ ...p, pix_key: e.target.value }))}
                placeholder="CPF, e-mail, telefone ou chave aleatória"
                className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm font-mono text-emerald-300 placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20"
              />
            </div>
            <p className="text-[11px] text-white/40 mt-1">
              Suas comissões aprovadas são pagas diretamente nesta chave PIX.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#1D4ED8] to-[#3B82F6] hover:brightness-110 active:scale-[0.99] text-white font-bold py-3 px-6 rounded-xl text-sm transition-all shadow-lg shadow-blue-500/20 disabled:opacity-60 cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : saved ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>Alterações Salvas!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Salvar Alterações</span>
              </>
            )}
          </button>
        </form>

        {/* Resumo da Conta */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 space-y-4 h-fit">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#60A5FA]" />
            Dados da Conta
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/6">
              <span className="text-white/45 block text-[10px] uppercase font-bold">E-mail Cadastrado</span>
              <span className="font-semibold text-white truncate block mt-0.5">{partner?.email || '—'}</span>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/6 flex items-center justify-between">
              <div>
                <span className="text-white/45 block text-[10px] uppercase font-bold">Código de Afiliado</span>
                <span className="font-mono font-bold text-[#93C5FD] block mt-0.5 text-sm">
                  {partner?.referral_code || '—'}
                </span>
              </div>
              {partner?.referral_code && (
                <button
                  type="button"
                  onClick={copyCode}
                  className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                  title="Copiar Código"
                >
                  <Copy className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/6">
              <span className="text-white/45 block text-[10px] uppercase font-bold">Taxa de Comissão</span>
              <span className="font-bold text-emerald-300 block mt-0.5">
                {partner?.commission_percentage || partner?.commission_rate || 20}% Recorrente
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/6">
              <span className="text-white/45 block text-[10px] uppercase font-bold">Status da Conta</span>
              <span className="font-bold text-emerald-300 block mt-0.5 capitalize">
                {partner?.status === 'active' || partner?.status === 'approved' ? 'Aprovado / Ativo' : partner?.status || 'Pendente'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </PartnerLayout>
  );
}