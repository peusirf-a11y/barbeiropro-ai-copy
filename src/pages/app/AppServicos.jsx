import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { resolveCompanyId } from '@/api/functions';
import { supabase } from '@/lib/supabaseClient';
import { useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useToast } from '@/components/ui/use-toast';
import { Star, Clock, Pencil, Trash2, Briefcase, AlertCircle } from 'lucide-react';
import AppPageHeader from '@/components/app/AppPageHeader';
import PrimaryButton from '@/components/app/PrimaryButton';
import StandardModal from '@/components/ui/standard-modal';

const emptyForm = {
  name: '',
  description: '',
  duration_minutes: 30,
  price: 0,
  is_active: true,
  is_featured: false,
};

function normalizeService(s) {
  if (!s) return s;
  const isActive = s.is_active !== undefined ? Boolean(s.is_active) : (s.active !== undefined ? Boolean(s.active) : true);
  const isFeatured = s.is_featured !== undefined ? Boolean(s.is_featured) : (s.featured !== undefined ? Boolean(s.featured) : false);
  return {
    ...s,
    is_active: isActive,
    active: isActive,
    is_featured: isFeatured,
    featured: isFeatured,
    duration_minutes: Number(s.duration_minutes ?? 30),
    price: Number(s.price ?? 0),
  };
}

export default function AppServicos() {
  const { company, companyId, isLoading: loadingCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const resolveActiveCompanyId = useCallback(async () => {
    if (companyId && companyId !== 'comp_demo_01') return companyId;
    if (company?.id && company.id !== 'comp_demo_01') return company.id;

    try {
      const rawAdmin = localStorage.getItem('admin_logged_user');
      if (rawAdmin) {
        const parsed = JSON.parse(rawAdmin);
        if (parsed?.company_id && parsed.company_id !== 'comp_demo_01') {
          return parsed.company_id;
        }
        if (parsed?.email && supabase) {
          const { data: compByEmail } = await supabase
            .from('companies')
            .select('id')
            .eq('owner_email', parsed.email.trim().toLowerCase())
            .maybeSingle();
          if (compByEmail?.id) return compByEmail.id;
        }
      }
    } catch (_) {}

    try {
      if (supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionEmail = sessionData?.session?.user?.email;
        if (sessionEmail) {
          const { data: compBySession } = await supabase
            .from('companies')
            .select('id')
            .eq('owner_email', sessionEmail.trim().toLowerCase())
            .maybeSingle();
          if (compBySession?.id) return compBySession.id;
        }
      }
    } catch (_) {}

    const resolved = await resolveCompanyId({ company_id: companyId });
    if (resolved && resolved !== 'comp_demo_01') return resolved;

    try {
      if (supabase) {
        const { data: firstComp } = await supabase
          .from('companies')
          .select('id')
          .limit(1)
          .maybeSingle();
        if (firstComp?.id) return firstComp.id;
      }
    } catch (_) {}

    return companyId || resolved || null;
  }, [companyId, company]);

  const fetchServices = useCallback(async (overrideCompanyId) => {
    const activeCompanyId = overrideCompanyId || await resolveActiveCompanyId();
    if (!activeCompanyId) {
      setServices([]);
      setIsLoading(false);
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('company_id', activeCompanyId)
        .order('created_at', { ascending: false });

      console.log('[AppServicos] fetchServices Supabase:', { activeCompanyId, data, error });

      if (error) {
        throw error;
      }

      const normalizedList = (data || []).map(normalizeService);
      setServices(normalizedList);
      queryClient.setQueryData(['services', activeCompanyId], normalizedList);
      return normalizedList;
    } catch (err) {
      console.warn('[AppServicos] Falha ao buscar direto do Supabase, consultando fallback:', err?.message);
      try {
        const res = await base44.functions.invoke('listServices', { company_id: activeCompanyId });
        const fallbackList = (res?.data?.services || []).map(normalizeService);
        setServices(fallbackList);
        return fallbackList;
      } catch (_) {
        setServices([]);
        return [];
      }
    } finally {
      setIsLoading(false);
    }
  }, [resolveActiveCompanyId, queryClient]);

  useEffect(() => {
    if (!loadingCompany) {
      fetchServices();
    }
  }, [loadingCompany, companyId, fetchServices]);

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (s) => {
    const norm = normalizeService(s);
    setEditing(norm);
    setForm({
      name: norm.name || '',
      description: norm.description || '',
      duration_minutes: norm.duration_minutes || 30,
      price: norm.price ?? 0,
      is_active: norm.is_active,
      is_featured: norm.is_featured,
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    setFormError('');

    if (!form.name || !form.name.trim()) {
      const msg = 'Informe o nome do serviço.';
      setFormError(msg);
      toast({
        title: 'Nome obrigatório',
        description: msg,
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const activeCompanyId = await resolveActiveCompanyId();
      if (!activeCompanyId) {
        const msg = 'Não foi possível identificar o company_id da empresa ativa da sessão.';
        setFormError(msg);
        toast({
          title: 'Erro de sessão',
          description: msg,
          variant: 'destructive',
        });
        setIsSaving(false);
        return;
      }

      // Payload com os nomes de colunas normalizados exigidos pelo banco
      const payload = {
        name: form.name.trim(),
        description: form.description ? form.description.trim() : '',
        duration_minutes: Number(form.duration_minutes) || 30,
        price: Number(form.price) || 0,
        is_active: Boolean(form.is_active),
        is_featured: Boolean(form.is_featured),
        company_id: activeCompanyId,
      };

      if (editing?.id) {
        const { data: updated, error } = await supabase
          .from('services')
          .update(payload)
          .eq('id', editing.id)
          .select();

        if (error) {
          console.error('[AppServicos] Erro ao atualizar serviço no Supabase:', error);
          setFormError(error.message);
          toast({
            title: 'Erro ao atualizar serviço',
            description: error.message,
            variant: 'destructive',
          });
          setIsSaving(false);
          return;
        }

        try {
          const rawLocal = localStorage.getItem('barberpass_local_services');
          const localList = rawLocal ? JSON.parse(rawLocal) : [];
          const savedRecord = normalizeService((updated && updated[0]) || { ...editing, ...payload });
          const nextLocal = localList.map(item => (item.id === editing.id ? savedRecord : item));
          localStorage.setItem('barberpass_local_services', JSON.stringify(nextLocal));
        } catch (_) {}

        toast({
          title: 'Serviço atualizado com sucesso!',
          description: `"${payload.name}" foi atualizado.`,
        });
      } else {
        const { data: inserted, error } = await supabase
          .from('services')
          .insert([payload])
          .select();

        if (error) {
          console.error('[AppServicos] Erro ao inserir serviço no Supabase:', error);
          setFormError(error.message);
          toast({
            title: 'Erro ao criar serviço',
            description: error.message,
            variant: 'destructive',
          });
          setIsSaving(false);
          return;
        }

        try {
          const rawLocal = localStorage.getItem('barberpass_local_services');
          const localList = rawLocal ? JSON.parse(rawLocal) : [];
          const savedRecord = normalizeService(
            (inserted && inserted[0]) || { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...payload }
          );
          localList.unshift(savedRecord);
          localStorage.setItem('barberpass_local_services', JSON.stringify(localList));
        } catch (_) {}

        toast({
          title: 'Serviço criado com sucesso!',
          description: `"${payload.name}" foi adicionado à sua lista de serviços.`,
        });
      }

      closeForm();
      await fetchServices(activeCompanyId);
      queryClient.invalidateQueries({ queryKey: ['services'] });
    } catch (err) {
      const errorMsg = err?.message || 'Erro inesperado ao salvar serviço.';
      console.error('[AppServicos] Exceção ao salvar serviço:', err);
      setFormError(errorMsg);
      toast({
        title: 'Erro ao salvar serviço',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (s) => {
    const nextActive = !s.is_active;
    const { error } = await supabase
      .from('services')
      .update({ is_active: nextActive })
      .eq('id', s.id);

    if (error) {
      toast({
        title: 'Erro ao atualizar status',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    await fetchServices();
    queryClient.invalidateQueries({ queryKey: ['services'] });
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir serviço?')) return;
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro ao excluir serviço',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Serviço excluído com sucesso!' });
    await fetchServices();
    queryClient.invalidateQueries({ queryKey: ['services'] });
  };

  const activeServices = services.filter(s => s.is_active);
  const inactiveServices = services.filter(s => !s.is_active);

  if (loadingCompany || isLoading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-4 border-[#60A5FA]/20 border-t-[#60A5FA] rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in">
        <AppPageHeader
          title="Serviços"
          subtitle={`${activeServices.length} ativos · ${inactiveServices.length} inativos`}
          icon={Briefcase}
        >
          <PrimaryButton onClick={openNew}>Novo serviço</PrimaryButton>
        </AppPageHeader>

        {services.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-16 text-center text-white/55">
            <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm mb-3">Nenhum serviço cadastrado</p>
            <button onClick={openNew} className="text-sm font-semibold text-[#93C5FD] hover:text-white transition-colors">Adicionar primeiro serviço</button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map(s => (
              <div key={s.id} className={`group relative rounded-2xl border p-5 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 overflow-hidden ${s.is_active ? 'bg-white/[0.025] border-white/8 hover:border-[#60A5FA]/30 hover:bg-white/[0.04]' : 'bg-white/[0.015] border-white/5 opacity-55'}`}>
                {s.is_active && (
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.06] to-transparent pointer-events-none" />
                )}
                {s.is_featured && (
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-400/[0.08] to-transparent pointer-events-none" />
                )}
                <div className="relative flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-bold text-white truncate">{s.name}</h3>
                    {s.is_featured && <Star className="w-4 h-4 text-amber-300 fill-amber-400 flex-shrink-0" />}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(s)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Editar"><Pencil className="w-3.5 h-3.5 text-white/55" /></button>
                    <button onClick={() => handleDelete(s.id)} className="p-1.5 hover:bg-rose-500/10 rounded-lg transition-colors" title="Excluir"><Trash2 className="w-3.5 h-3.5 text-rose-300" /></button>
                  </div>
                </div>
                {s.description && <p className="relative text-xs text-white/55 mb-3 line-clamp-2">{s.description}</p>}
                <div className="relative flex items-center justify-between mb-3">
                  <span className="flex items-center gap-1 text-xs text-white/60"><Clock className="w-3.5 h-3.5" />{s.duration_minutes} min</span>
                  <span className="text-xl font-black bg-gradient-to-b from-white to-[#93C5FD] bg-clip-text text-transparent">R${s.price}</span>
                </div>
                <div className="relative flex items-center justify-between pt-3 border-t border-white/8">
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${s.is_active ? 'bg-emerald-400/15 text-emerald-200 border-emerald-400/30' : 'bg-white/[0.04] text-white/55 border-white/10'}`}>
                    {s.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                  <button onClick={() => handleToggleActive(s)}
                    className="text-xs text-white/55 hover:text-[#93C5FD] font-medium transition-colors">
                    {s.is_active ? 'Inativar' : 'Ativar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <StandardModal
          open={showForm}
          onClose={closeForm}
          title={editing ? 'Editar Serviço' : 'Novo Serviço'}
          footer={
            <>
              <button onClick={closeForm} className="flex-1 min-h-[48px] px-4 border border-white/10 rounded-xl text-sm font-medium text-white/80 bg-white/[0.03] hover:bg-white/[0.06] active:bg-white/[0.08] transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={!form.name || isSaving}
                className="flex-1 min-h-[48px] px-4 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white rounded-xl text-sm font-semibold hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all shadow-[0_8px_24px_rgba(37,99,235,0.4)] ring-1 ring-white/15">
                {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            {formError && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-white/60 block mb-1">Nome *</label>
              <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Corte Clássico"
                className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
            </div>
            <div>
              <label className="text-xs font-semibold text-white/60 block mb-1">Descrição</label>
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
                className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-white/60 block mb-1">Duração (min) *</label>
                <input type="number" min="5" step="5" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: +e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/60 block mb-1">Preço (R$) *</label>
                <input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(p => ({ ...p, price: +e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
              </div>
            </div>
            <div className="flex gap-5 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer text-white/85">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} className="accent-[#60A5FA]" />
                Ativo
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer text-white/85">
                <input type="checkbox" checked={form.is_featured} onChange={e => setForm(p => ({ ...p, is_featured: e.target.checked }))} className="accent-amber-400" />
                <Star className="w-3.5 h-3.5 text-amber-300" /> Destaque
              </label>
            </div>
          </div>
        </StandardModal>
      </div>
    </AppLayout>
  );
}