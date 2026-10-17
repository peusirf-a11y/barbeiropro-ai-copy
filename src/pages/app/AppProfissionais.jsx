import { useState, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { resolveCompanyId } from '@/api/functions';
import { supabase } from '@/lib/supabaseClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useToast } from '@/components/ui/use-toast';
import { Pencil, Scissors, Trash2, AlertCircle } from 'lucide-react';
import AppPageHeader from '@/components/app/AppPageHeader';
import PrimaryButton from '@/components/app/PrimaryButton';
import { useActiveUnit } from '@/hooks/useActiveUnit';
import MobileSelect from '@/components/ui/mobile-select';
import StandardModal from '@/components/ui/standard-modal';
import BarberPhotoStandardizer from '@/components/profissionais/BarberPhotoStandardizer';
import BarberBioGenerator from '@/components/profissionais/BarberBioGenerator';
import BarberSpecialtiesAnalyzer from '@/components/profissionais/BarberSpecialtiesAnalyzer';

const DAYS = [
  { key: 'seg', label: 'Seg' }, { key: 'ter', label: 'Ter' }, { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' }, { key: 'sex', label: 'Sex' }, { key: 'sab', label: 'Sáb' }, { key: 'dom', label: 'Dom' },
];

const defaultSchedule = Object.fromEntries(
  DAYS.map(d => [d.key, { open: '09:00', close: '18:00', active: d.key !== 'dom' }])
);

const emptyForm = {
  name: '',
  specialty: '',
  photo_url: '',
  active: true,
  is_active: true,
  work_schedule: defaultSchedule,
  service_ids: [],
  services: [],
  unit_ids: [],
  commission_type: 'percent',
  commission_value: 0,
  commission_rate: 0,
  bio: '',
  bio_short: '',
  bio_medium: '',
  bio_full: '',
  bio_generated_at: '',
  specialties: [],
  suggested_specialties: [],
  specialties_analyzed_at: '',
};

function normalizeProfessional(p) {
  if (!p) return p;
  const isActive = p.is_active !== undefined
    ? Boolean(p.is_active)
    : (p.active !== undefined ? Boolean(p.active) : true);
  const commVal = Number(p.commission_rate ?? p.commission_value ?? p.commission_pct ?? 0);
  const commType = p.commission_type || 'percent';
  const specialtiesArr = Array.isArray(p.specialties)
    ? p.specialties
    : (p.specialty ? p.specialty.split(/[,/]/).map(s => s.trim()).filter(Boolean) : []);
  const servicesArr = Array.isArray(p.services)
    ? p.services
    : (Array.isArray(p.service_ids) ? p.service_ids : []);
  const bioText = p.bio || p.bio_short || p.bio_medium || p.bio_full || '';

  return {
    ...p,
    is_active: isActive,
    active: isActive,
    commission_rate: commVal,
    commission_value: commVal,
    commission_type: commType,
    specialties: specialtiesArr,
    services: servicesArr,
    service_ids: Array.isArray(p.service_ids) ? p.service_ids : servicesArr,
    bio: bioText,
    bio_short: p.bio_short || bioText,
  };
}

export default function AppProfissionais() {
  const { company, companyId, isLoading: loadingCompany } = useCompany();
  const { units, isMultiUnit, activeUnitId } = useActiveUnit();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [tab, setTab] = useState('info'); // 'info' | 'bio' | 'specialties' | 'schedule' | 'services' | 'units'

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

    return companyId || company?.id || null;
  }, [company, companyId]);

  const fetchProfessionals = useCallback(async (cId) => {
    const targetCompanyId = cId || (await resolveActiveCompanyId());
    if (!targetCompanyId) return [];

    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('professionals')
          .select('*')
          .eq('company_id', targetCompanyId)
          .order('name', { ascending: true });

        if (!error && Array.isArray(data)) {
          return data.map(normalizeProfessional);
        }
      }
    } catch (err) {
      console.warn('[AppProfissionais] Aviso ao consultar Supabase, usando fallback:', err);
    }

    try {
      const res = await base44.functions.invoke('listProfessionals', {
        company_id: targetCompanyId,
        active_unit_id: activeUnitId,
      });
      const list = res?.data?.professionals || [];
      return list.map(normalizeProfessional);
    } catch (_) {
      return [];
    }
  }, [resolveActiveCompanyId, activeUnitId]);

  const { data: professionals = [], isLoading, refetch } = useQuery({
    queryKey: ['professionals', companyId, activeUnitId],
    queryFn: () => fetchProfessionals(),
    enabled: !loadingCompany,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services', companyId],
    queryFn: async () => {
      const targetCId = await resolveActiveCompanyId();
      if (supabase && targetCId) {
        const { data, error } = await supabase
          .from('services')
          .select('*')
          .eq('company_id', targetCId);
        if (!error && Array.isArray(data)) return data;
      }
      const res = await base44.functions.invoke('listServices', { company_id: targetCId || companyId });
      return res?.data?.services || [];
    },
    enabled: !loadingCompany,
  });

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setTab('info');
  };

  const openNew = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      ...(isMultiUnit && activeUnitId ? { unit_ids: [activeUnitId] } : {}),
    });
    setFormError('');
    setTab('info');
    setShowForm(true);
  };

  const openEdit = (p) => {
    const norm = normalizeProfessional(p);
    setEditing(norm);
    setForm({
      name: norm.name || '',
      specialty: norm.specialty || (norm.specialties?.[0] || ''),
      photo_url: norm.photo_url || norm.avatar_url || '',
      active: norm.is_active,
      is_active: norm.is_active,
      work_schedule: norm.work_schedule || defaultSchedule,
      service_ids: norm.service_ids || norm.services || [],
      services: norm.services || norm.service_ids || [],
      unit_ids: norm.unit_ids || [],
      commission_type: norm.commission_type || 'percent',
      commission_value: norm.commission_rate ?? 0,
      commission_rate: norm.commission_rate ?? 0,
      bio: norm.bio || '',
      bio_short: norm.bio_short || norm.bio || '',
      bio_medium: norm.bio_medium || '',
      bio_full: norm.bio_full || '',
      bio_generated_at: norm.bio_generated_at || '',
      specialties: norm.specialties || [],
      suggested_specialties: norm.suggested_specialties || norm.specialties || [],
      specialties_analyzed_at: norm.specialties_analyzed_at || '',
    });
    setFormError('');
    setTab('info');
    setShowForm(true);
  };

  const toggleUnit = (uid) => {
    setForm(p => ({
      ...p,
      unit_ids: p.unit_ids.includes(uid) ? p.unit_ids.filter(id => id !== uid) : [...p.unit_ids, uid],
    }));
  };

  const toggleService = (sid) => {
    setForm(p => {
      const nextIds = p.service_ids.includes(sid)
        ? p.service_ids.filter(id => id !== sid)
        : [...p.service_ids, sid];
      return {
        ...p,
        service_ids: nextIds,
        services: nextIds,
      };
    });
  };

  const setSchedule = (day, field, val) => {
    setForm(p => ({
      ...p,
      work_schedule: {
        ...p.work_schedule,
        [day]: { ...p.work_schedule[day], [field]: val },
      },
    }));
  };

  // Salvar formulário com persistência em Supabase e tratamento de erros rigoroso
  const handleSave = async () => {
    setFormError('');

    if (!form.name || !form.name.trim()) {
      const msg = 'Informe o nome do profissional.';
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

      // Tratamento e normalização dos campos conforme o schema do Supabase:
      // - name, specialty, commission_type, commission_rate, is_active, bio, specialties, services
      // - Valores numéricos de comissão convertidos para Number (ou 0 se vazios)
      const rawComm = form.commission_rate !== undefined && form.commission_rate !== ''
        ? form.commission_rate
        : (form.commission_value !== undefined && form.commission_value !== '' ? form.commission_value : 0);
      const commissionRateNum = Number(rawComm) || 0;

      const servicesArray = Array.isArray(form.services) && form.services.length > 0
        ? form.services
        : (Array.isArray(form.service_ids) ? form.service_ids : []);

      const specialtiesArray = Array.isArray(form.specialties) && form.specialties.length > 0
        ? form.specialties
        : (Array.isArray(form.suggested_specialties) && form.suggested_specialties.length > 0
            ? form.suggested_specialties
            : (form.specialty ? form.specialty.split(/[,/]/).map(s => s.trim()).filter(Boolean) : []));

      const bioString = (form.bio || form.bio_medium || form.bio_short || form.bio_full || '').trim();

      const payload = {
        company_id: activeCompanyId,
        name: form.name.trim(),
        specialty: form.specialty ? form.specialty.trim() : (specialtiesArray[0] || 'Barbeiro'),
        commission_type: form.commission_type || 'percent',
        commission_rate: commissionRateNum,
        is_active: Boolean(form.is_active !== undefined ? form.is_active : (form.active !== undefined ? form.active : true)),
        bio: bioString,
        specialties: specialtiesArray,
        services: servicesArray,
      };

      if (editing?.id) {
        const { data: updated, error } = await supabase
          .from('professionals')
          .update(payload)
          .eq('id', editing.id)
          .select();

        if (error) {
          console.error('[AppProfissionais] Erro ao atualizar profissional no Supabase:', error);
          setFormError(error.message);
          toast({
            title: 'Erro ao atualizar profissional',
            description: error.message,
            variant: 'destructive',
          });
          setIsSaving(false);
          return;
        }

        toast({
          title: 'Profissional atualizado com sucesso!',
          description: `"${payload.name}" foi atualizado.`,
        });
      } else {
        const { data: inserted, error } = await supabase
          .from('professionals')
          .insert(payload)
          .select();

        // Tratamento e exibição imediata de erros devolvidos pelo Supabase
        if (error) {
          console.error('[AppProfissionais] Erro ao cadastrar profissional no Supabase:', error);
          setFormError(error.message);
          toast({
            title: 'Erro ao cadastrar profissional',
            description: error.message,
            variant: 'destructive',
          });
          setIsSaving(false);
          return;
        }

        toast({
          title: 'Profissional cadastrado com sucesso!',
          description: `"${payload.name}" foi adicionado à equipe.`,
        });
      }

      // Em caso de sucesso: feche o modal, emita notificação de sucesso e execute o refetch
      closeForm();
      await fetchProfessionals(activeCompanyId);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
    } catch (err) {
      const errorMsg = err?.message || 'Erro inesperado ao salvar profissional.';
      console.error('[AppProfissionais] Exceção ao salvar profissional:', err);
      setFormError(errorMsg);
      toast({
        title: 'Erro ao salvar profissional',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deseja realmente excluir este profissional?')) return;
    try {
      if (supabase) {
        const { error } = await supabase.from('professionals').delete().eq('id', id);
        if (error) {
          toast({
            title: 'Erro ao excluir',
            description: error.message,
            variant: 'destructive',
          });
          return;
        }
      } else {
        await base44.entities.Professional.delete(id);
      }
      toast({ title: 'Profissional removido com sucesso' });
      await fetchProfessionals();
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
    } catch (err) {
      toast({
        title: 'Erro ao excluir',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Filtra a lista de profissionais pela unidade ativa em multi-unidade
  const visiblePros = isMultiUnit && activeUnitId
    ? professionals.filter(p => !p.unit_ids || p.unit_ids.length === 0 || p.unit_ids.includes(activeUnitId))
    : professionals;

  if (loadingCompany || isLoading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in">
        <AppPageHeader
          title="Profissionais"
          subtitle={`${visiblePros.length} ${visiblePros.length === 1 ? 'profissional' : 'profissionais'}${isMultiUnit ? ' nesta unidade' : ' cadastrados'}`}
          icon={Scissors}
        >
          <PrimaryButton onClick={openNew}>Novo profissional</PrimaryButton>
        </AppPageHeader>

        {visiblePros.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-16 text-center text-white/55">
            <Scissors className="w-10 h-10 mx-auto mb-3 text-white/25" />
            <p className="text-sm mb-3">Nenhum profissional cadastrado</p>
            <button onClick={openNew} className="text-sm font-semibold text-[#93C5FD] hover:text-[#BFDBFE] hover:underline transition-colors">
              Adicionar primeiro profissional
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {visiblePros.map(pro => (
              <div
                key={pro.id}
                className={`group relative rounded-2xl border bg-white/[0.025] backdrop-blur-md p-5 hover:bg-white/[0.04] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden ${
                  pro.is_active || pro.active ? 'border-white/8 hover:border-[#60A5FA]/30' : 'border-white/8 opacity-55'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.05] to-transparent pointer-events-none" />
                <div className="relative flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {pro.photo_url || pro.avatar_url ? (
                      <img
                        src={pro.photo_url || pro.avatar_url}
                        alt={pro.name}
                        className="w-12 h-12 rounded-xl object-cover ring-2 ring-white/15 shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
                      />
                    ) : (
                      <div className="relative w-12 h-12 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] rounded-xl flex items-center justify-center shadow-[0_8px_24px_rgba(37,99,235,0.4)] ring-1 ring-white/15">
                        <span className="absolute inset-0 rounded-xl bg-[#60A5FA]/30 blur-md opacity-60" aria-hidden="true" />
                        <Scissors className="relative w-5 h-5 text-white" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-white">{pro.name}</h3>
                      <p className="text-xs text-white/55">{pro.specialty || (pro.specialties && pro.specialties[0]) || 'Barbeiro'}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <div className={`w-2 h-2 rounded-full ${(pro.is_active ?? pro.active) ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-white/20'}`} />
                        <span className="text-xs text-white/55">{(pro.is_active ?? pro.active) ? 'Ativo' : 'Inativo'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(pro)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Editar">
                      <Pencil className="w-3.5 h-3.5 text-white/50 hover:text-[#93C5FD]" />
                    </button>
                    <button onClick={() => handleDelete(pro.id)} className="p-1.5 hover:bg-rose-500/10 rounded-lg transition-colors" title="Excluir">
                      <Trash2 className="w-3.5 h-3.5 text-white/40 hover:text-rose-300" />
                    </button>
                  </div>
                </div>

                {pro.bio && (
                  <p className="relative text-xs text-white/60 mb-2 line-clamp-2">{pro.bio}</p>
                )}

                {(pro.services?.length > 0 || pro.service_ids?.length > 0) && (
                  <div className="relative text-xs text-white/55">
                    {(pro.services || pro.service_ids).length} serviços vinculados
                  </div>
                )}
                {(pro.commission_rate > 0 || pro.commission_value > 0) && (
                  <div className="relative text-xs text-white/55 mt-1">
                    Comissão: <span className="text-white/75 font-semibold">
                      {pro.commission_rate || pro.commission_value}
                      {pro.commission_type === 'percent' ? '%' : ' R$'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <StandardModal
          open={showForm}
          onClose={closeForm}
          title={editing ? 'Editar Profissional' : 'Novo Profissional'}
          size="lg"
          footer={
            <>
              <button
                onClick={closeForm}
                className="flex-1 px-4 py-2.5 border border-white/10 rounded-lg text-sm font-medium text-white/80 bg-white/[0.03] hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name || isSaving}
                className="flex-1 px-4 py-2.5 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white rounded-lg text-sm font-semibold hover:brightness-110 disabled:opacity-50 shadow-[0_8px_24px_rgba(37,99,235,0.4)] ring-1 ring-white/15 transition-all cursor-pointer"
              >
                {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          }
        >
          <div>
            {formError && (
              <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-white/8 -mx-6 mb-4">
              {[
                { id: 'info', label: 'Dados' },
                { id: 'bio', label: 'Biografia' },
                { id: 'specialties', label: 'Especialidades' },
                { id: 'schedule', label: 'Horários' },
                { id: 'services', label: 'Serviços' },
                ...(isMultiUnit ? [{ id: 'units', label: 'Unidades' }] : []),
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 py-2.5 text-sm font-medium transition-all ${
                    tab === t.id ? 'text-[#93C5FD] border-b-2 border-[#60A5FA]' : 'text-white/45 hover:text-white/75'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div>
              {tab === 'info' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-white/60 block mb-1">Nome *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="Ex: Carlos Silva"
                      className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-white/60 block mb-1">Especialidade</label>
                    <input
                      type="text"
                      value={form.specialty}
                      onChange={e => {
                        const val = e.target.value;
                        setForm(p => ({
                          ...p,
                          specialty: val,
                          specialties: val ? val.split(/[,/]/).map(s => s.trim()).filter(Boolean) : [],
                        }));
                      }}
                      placeholder="Ex: Barba & Navalha"
                      className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-white/60 block mb-1">Biografia / Resumo</label>
                    <textarea
                      rows={2}
                      value={form.bio}
                      onChange={e => setForm(p => ({ ...p, bio: e.target.value, bio_short: e.target.value }))}
                      placeholder="Breve descrição da experiência e estilo do profissional..."
                      className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20 resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-white/60 block mb-1">Foto do barbeiro</label>
                    <BarberPhotoStandardizer
                      value={form.photo_url}
                      onChange={(url) => setForm(p => ({ ...p, photo_url: url }))}
                      fallbackText={form.name}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-white/60 block mb-1">Tipo comissão</label>
                      <MobileSelect
                        value={form.commission_type}
                        onChange={v => setForm(p => ({ ...p, commission_type: v }))}
                        className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white focus:outline-none"
                      >
                        <option value="percent">Porcentagem (%)</option>
                        <option value="fixed">Valor fixo (R$)</option>
                      </MobileSelect>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-white/60 block mb-1">
                        Comissão ({form.commission_type === 'percent' ? '%' : 'R$'})
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={form.commission_rate ?? form.commission_value ?? ''}
                        onChange={e => {
                          const val = e.target.value === '' ? '' : Number(e.target.value);
                          setForm(p => ({ ...p, commission_rate: val, commission_value: val }));
                        }}
                        placeholder="Ex: 50"
                        className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer text-white/85 pt-1">
                    <input
                      type="checkbox"
                      checked={Boolean(form.is_active ?? form.active)}
                      onChange={e => setForm(p => ({ ...p, is_active: e.target.checked, active: e.target.checked }))}
                      className="accent-[#60A5FA]"
                    />
                    Profissional ativo
                  </label>
                </div>
              )}

              {tab === 'bio' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-white/60 block mb-1">Biografia Completa</label>
                    <textarea
                      rows={4}
                      value={form.bio}
                      onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
                      placeholder="Histórico, certificações, tempo de experiência..."
                      className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20"
                    />
                  </div>
                  <BarberBioGenerator
                    professionalId={editing?.id}
                    values={{
                      bio_short: form.bio_short,
                      bio_medium: form.bio_medium,
                      bio_full: form.bio_full,
                    }}
                    generatedAt={form.bio_generated_at}
                    onChange={(patch) => {
                      const updatedBio = patch.bio_full || patch.bio_medium || patch.bio_short || form.bio;
                      setForm(p => ({ ...p, ...patch, bio: updatedBio }));
                    }}
                  />
                </div>
              )}

              {tab === 'specialties' && (
                <BarberSpecialtiesAnalyzer
                  professionalId={editing?.id}
                  suggested={form.suggested_specialties || []}
                  analyzedAt={form.specialties_analyzed_at}
                  currentSpecialty={form.specialty}
                  onApplySpecialty={(tag) => {
                    setForm(p => {
                      const existingSpecs = Array.isArray(p.specialties) ? p.specialties : [];
                      const nextSpecs = existingSpecs.includes(tag) ? existingSpecs : [...existingSpecs, tag];
                      return {
                        ...p,
                        specialty: tag,
                        specialties: nextSpecs,
                      };
                    });
                    setTab('info');
                  }}
                />
              )}

              {tab === 'schedule' && (
                <div className="space-y-2">
                  <p className="text-xs text-white/55 mb-3">Configure os dias e horários de atendimento</p>
                  {DAYS.map(({ key, label }) => {
                    const h = form.work_schedule[key] || { open: '09:00', close: '18:00', active: false };
                    return (
                      <div key={key} className="flex items-center gap-2 sm:gap-3">
                        <label className="flex items-center gap-1.5 w-[68px] flex-shrink-0 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={h.active}
                            onChange={e => setSchedule(key, 'active', e.target.checked)}
                            className="accent-[#60A5FA]"
                          />
                          <span className={`text-sm font-semibold ${h.active ? 'text-white' : 'text-white/40'}`}>{label}</span>
                        </label>
                        {h.active ? (
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <input
                              type="time"
                              value={h.open}
                              onChange={e => setSchedule(key, 'open', e.target.value)}
                              className="flex-1 min-w-0 px-2 py-1.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white [color-scheme:dark] focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20"
                            />
                            <span className="text-white/40 text-xs flex-shrink-0">até</span>
                            <input
                              type="time"
                              value={h.close}
                              onChange={e => setSchedule(key, 'close', e.target.value)}
                              className="flex-1 min-w-0 px-2 py-1.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white [color-scheme:dark] focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20"
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-white/35 flex-1">Folga</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {tab === 'units' && isMultiUnit && (
                <div>
                  <p className="text-xs text-white/55 mb-3">
                    Selecione em quais unidades este profissional atende. Se nenhuma for marcada, aparece em todas.
                  </p>
                  <div className="space-y-2">
                    {units.map(u => (
                      <label
                        key={u.id}
                        className="flex items-center gap-3 p-3 rounded-xl border border-white/8 bg-white/[0.025] cursor-pointer hover:bg-white/[0.05] hover:border-white/15 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={form.unit_ids.includes(u.id)}
                          onChange={() => toggleUnit(u.id)}
                          className="accent-[#60A5FA]"
                        />
                        <span className="text-sm font-medium text-white">{u.name}</span>
                        {u.is_default && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-200 border border-amber-400/25 ml-auto">
                            Matriz
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {tab === 'services' && (
                <div>
                  <p className="text-xs text-white/55 mb-3">Selecione os serviços que este profissional realiza</p>
                  {services.length === 0 ? (
                    <p className="text-sm text-white/40">Nenhum serviço cadastrado ainda</p>
                  ) : (
                    <div className="space-y-2">
                      {services.map(s => (
                        <label
                          key={s.id}
                          className="flex items-center gap-3 p-3 rounded-xl border border-white/8 bg-white/[0.025] cursor-pointer hover:bg-white/[0.05] hover:border-white/15 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={form.service_ids.includes(s.id) || form.services.includes(s.id)}
                            onChange={() => toggleService(s.id)}
                            className="accent-[#60A5FA]"
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-white">{s.name}</span>
                            <span className="text-xs text-white/45 ml-2">
                              {s.duration_minutes}min · R${s.price}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </StandardModal>
      </div>
    </AppLayout>
  );
}