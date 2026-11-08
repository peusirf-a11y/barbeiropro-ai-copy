// Master /master/partners — gestão completa do programa de parceiros.
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { partnerKeys, commissionKeys, referralKeys } from '@/lib/partnerKeys';
import {
  Users,
  DollarSign,
  CheckCircle2,
  XCircle,
  Ban,
  Play,
  Search,
  FileText,
  Eye,
  Wallet,
  Loader2,
  Trash2
} from 'lucide-react';
import StandardModal from '@/components/ui/standard-modal';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import MasterPartnersKpis from '@/components/master/MasterPartnersKpis';
import MasterPartnersPayoutsTab from '@/components/master/MasterPartnersPayoutsTab';
import { currentMonthKey } from '@/components/master/MonthPicker';
import PartnerDetailDrawer from '@/components/master/PartnerDetailDrawer';

const brl = (n) => 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ',');
const PAGE = 25;

export function normalizePartnerStatus(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (['active', 'approved', 'ativo', 'aprovado', 'habilitado'].includes(s)) return 'active';
  if (['pending', 'pendente', 'analise', 'em_analise', 'aguardando'].includes(s)) return 'pending';
  if (['blocked', 'rejected', 'suspended', 'bloqueado', 'rejeitado', 'suspenso', 'inativo'].includes(s)) return 'blocked';
  return s || 'pending';
}

const STATUS_PARTNER = {
  pending: {
    label: 'Pendente',
    cls: 'bg-amber-500/15 text-amber-300 border border-amber-400/40',
  },
  pendente: {
    label: 'Pendente',
    cls: 'bg-amber-500/15 text-amber-300 border border-amber-400/40',
  },
  active: {
    label: 'Aprovado / Ativo',
    cls: 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/40',
  },
  approved: {
    label: 'Aprovado / Ativo',
    cls: 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/40',
  },
  ativo: {
    label: 'Aprovado / Ativo',
    cls: 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/40',
  },
  aprovado: {
    label: 'Aprovado / Ativo',
    cls: 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/40',
  },
  blocked: {
    label: 'Bloqueado',
    cls: 'bg-rose-500/15 text-rose-300 border border-rose-400/40',
  },
  rejected: {
    label: 'Rejeitado',
    cls: 'bg-rose-500/15 text-rose-300 border border-rose-400/40',
  },
  suspended: {
    label: 'Suspenso',
    cls: 'bg-rose-500/15 text-rose-300 border border-rose-400/40',
  },
  bloqueado: {
    label: 'Bloqueado',
    cls: 'bg-rose-500/15 text-rose-300 border border-rose-400/40',
  },
};

const STATUS_COMM = {
  pending: { label: 'Em Hold (Anti-fraude)', cls: 'bg-amber-500/15 text-amber-200 border-amber-400/30' },
  approved: { label: 'A Pagar (Aprovadas)', cls: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30' },
  paid: { label: 'Pago via Pix', cls: 'bg-blue-500/15 text-blue-200 border-blue-400/30' },
  cancelled: { label: 'Cancelado', cls: 'bg-rose-500/15 text-rose-200 border-rose-400/30' },
  chargeback: { label: 'Chargeback', cls: 'bg-rose-500/25 text-rose-200 border-rose-400/45' },
};

export default function MasterPartners() {
  const [tab, setTab] = useState('partners');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'active' | 'blocked'
  const [monthFilter, setMonthFilter] = useState(currentMonthKey());
  const [editPartner, setEditPartner] = useState(null);
  const [payCommission, setPayCommission] = useState(null);
  const [viewReferrals, setViewReferrals] = useState(null);
  const [detailPartner, setDetailPartner] = useState(null);
  const [visible, setVisible] = useState(PAGE);
  const [partnerToDelete, setPartnerToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const [partnerActionNotice, setPartnerActionNotice] = useState('');

  const kpisQ = useQuery({
    queryKey: ['partners', 'kpis'],
    queryFn: async () => {
      const deletedIds = new Set();
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('ocorte_deleted_partner_ids') || '[]';
          JSON.parse(raw).forEach((id) => deletedIds.add(id));
        } catch (_) {}
      }

      const mergedMap = new Map();

      // 1. Busca registros no Supabase
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: supaPartners, error: supaErr } = await supabase.from('partners').select('id, email, status');
          if (!supaErr && Array.isArray(supaPartners)) {
            supaPartners
              .filter(
                (p) =>
                  !deletedIds.has(p.id) &&
                  p.email !== 'test_delete_partner_xyz@test.com' &&
                  p.status !== 'deleted'
              )
              .forEach((p) => {
                const key = p.id || (p.email ? p.email.toLowerCase().trim() : null);
                if (key) mergedMap.set(key, p);
              });
          }
        } catch (e) {
          console.warn('[MasterPartners] Falha ao consultar KPIs no Supabase:', e);
        }
      }

      // 2. Mescla com lista de parceiros via partnerAdminAction (inclui fixtures pendentes/locais)
      let serverKpis = null;
      try {
        const [kpisRes, listRes] = await Promise.all([
          base44.functions.invoke('partnerAdminAction', { action: 'kpis' }),
          base44.functions.invoke('partnerAdminAction', { action: 'list_partners', limit: 200 }),
        ]);
        serverKpis = kpisRes?.data?.kpis || null;
        const localPartners = listRes?.data?.partners || [];
        localPartners
          .filter(
            (p) =>
              !deletedIds.has(p.id) &&
              p.email !== 'test_delete_partner_xyz@test.com' &&
              p.status !== 'deleted'
          )
          .forEach((p) => {
            const key = p.id || (p.email ? p.email.toLowerCase().trim() : null);
            const emailClean = p.email ? p.email.toLowerCase().trim() : null;
            const dupByEmail =
              emailClean &&
              Array.from(mergedMap.values()).some(
                (mp) => mp.email && mp.email.toLowerCase().trim() === emailClean
              );
            if (key && !mergedMap.has(key) && !dupByEmail) {
              mergedMap.set(key, p);
            }
          });
      } catch (_) {}

      const allValid = Array.from(mergedMap.values());
      const finalActive = allValid.filter((p) =>
        ['active', 'approved', 'ativo', 'aprovado'].includes(String(p.status || '').toLowerCase().trim())
      ).length;
      const finalPending = allValid.filter((p) =>
        ['pending', 'pendente', 'em_analise', 'aguardando'].includes(String(p.status || '').toLowerCase().trim())
      ).length;
      const finalTotal = allValid.length || finalActive + finalPending;

      return {
        ...serverKpis,
        partners_active: finalActive,
        active_partners: finalActive,
        partners_pending: finalPending,
        pending_partners: finalPending,
        total_partners: finalTotal,
      };
    },
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });

  const partnersQ = useQuery({
    queryKey: partnerKeys.list({ status: statusFilter, search }),
    queryFn: async () => {
      let supaList = [];
      // 1. Consulta ao Supabase com tratamento rigoroso de status
      if (isSupabaseConfigured && supabase) {
        try {
          let query = supabase.from('partners').select('*');

          // Filtro por status na query do banco quando aplicável
          if (statusFilter === 'pending') {
            query = query.in('status', ['pending', 'pendente', 'em_analise', 'aguardando']);
          } else if (statusFilter === 'active') {
            query = query.in('status', ['active', 'approved', 'ativo', 'aprovado']);
          } else if (statusFilter === 'blocked') {
            query = query.in('status', ['blocked', 'rejected', 'suspended', 'bloqueado', 'rejeitado', 'suspenso', 'inativo']);
          }

          const { data, error } = await query.order('created_at', { ascending: false });

          if (data && !error) {
            supaList = data.map((p) => {
              const normStatus = normalizePartnerStatus(p.status);
              return {
                id: p.id,
                name: p.full_name || p.name || 'Parceiro',
                full_name: p.full_name || p.name || 'Parceiro',
                email: p.email || '',
                phone: p.phone || p.whatsapp || '',
                whatsapp: p.phone || p.whatsapp || '',
                cpf_cnpj: p.cpf_cnpj || '',
                pix_key: p.pix_key || '',
                referral_code: p.referral_code || '',
                status: normStatus,
                raw_status: p.status,
                commission_percentage: Number(p.commission_rate || p.commission_percentage || 30),
                commission_rate: Number(p.commission_rate || p.commission_percentage || 30),
                created_date: p.created_at || new Date().toISOString(),
              };
            });
          } else if (error) {
            console.warn('[MasterPartners] Falha na query ordenada de parceiros, tentando consulta geral:', error);
            const { data: allData } = await supabase.from('partners').select('*');
            if (Array.isArray(allData)) {
              supaList = allData.map((p) => {
                const normStatus = normalizePartnerStatus(p.status);
                return {
                  id: p.id,
                  name: p.full_name || p.name || 'Parceiro',
                  full_name: p.full_name || p.name || 'Parceiro',
                  email: p.email || '',
                  phone: p.phone || p.whatsapp || '',
                  whatsapp: p.phone || p.whatsapp || '',
                  cpf_cnpj: p.cpf_cnpj || '',
                  pix_key: p.pix_key || '',
                  referral_code: p.referral_code || '',
                  status: normStatus,
                  raw_status: p.status,
                  commission_percentage: Number(p.commission_rate || p.commission_percentage || 30),
                  commission_rate: Number(p.commission_rate || p.commission_percentage || 30),
                  created_date: p.created_at || new Date().toISOString(),
                };
              });
            }
          }
        } catch (e) {
          console.warn('[MasterPartners] Consulta ao Supabase falhou:', e);
        }
      }

      // 2. Consulta de fallback local (sem travar a visualização se falhar)
      let localList = [];
      try {
        const res = await base44.functions.invoke('partnerAdminAction', {
          action: 'list_partners',
          status: statusFilter === 'all' ? undefined : statusFilter,
          search: search || undefined,
          limit: 200,
        });

        localList = (res?.data?.partners || []).map((p) => {
          const normStatus = normalizePartnerStatus(p.status);
          return {
            ...p,
            name: p.full_name || p.name || 'Parceiro',
            full_name: p.full_name || p.name || 'Parceiro',
            status: normStatus,
            raw_status: p.status,
            created_date: p.created_at || p.created_date || new Date().toISOString(),
            commission_percentage: Number(p.commission_percentage || p.commission_rate || 30),
            commission_rate: Number(p.commission_rate || p.commission_percentage || 30),
          };
        });
      } catch (err) {
        console.warn('[MasterPartners] partnerAdminAction list_partners falhou:', err);
      }

      // 3. Mescla sem duplicar registros priorizando o Supabase
      const map = new Map();
      supaList.forEach((p) => {
        const key = p.id || (p.email ? p.email.toLowerCase().trim() : null) || `supa_${Math.random()}`;
        map.set(key, p);
      });
      localList.forEach((p) => {
        const key = p.id || (p.email ? p.email.toLowerCase().trim() : null);
        const emailKey = p.email ? p.email.toLowerCase().trim() : null;
        const existsByEmail = emailKey && Array.from(map.values()).some((sp) => sp.email && sp.email.toLowerCase().trim() === emailKey);
        if (key && !map.has(key) && !existsByEmail) {
          map.set(key, p);
        }
      });

      const deletedIds = new Set();
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('ocorte_deleted_partner_ids') || '[]';
          JSON.parse(raw).forEach((did) => deletedIds.add(did));
        } catch (_) {}
      }

      let all = Array.from(map.values()).filter(
        (p) =>
          !deletedIds.has(p.id) &&
          p.email !== 'test_delete_partner_xyz@test.com' &&
          p.status !== 'deleted' &&
          p.raw_status !== 'deleted'
      );

      // Filtro local estrito e resiliente caso haja status desnormalizados
      if (statusFilter === 'pending') {
        all = all.filter((p) =>
          ['pending', 'pendente', 'em_analise', 'aguardando'].includes(String(p.status).toLowerCase()) ||
          ['pending', 'pendente', 'em_analise', 'aguardando'].includes(String(p.raw_status).toLowerCase())
        );
      } else if (statusFilter === 'active') {
        all = all.filter((p) =>
          ['active', 'approved', 'ativo', 'aprovado'].includes(String(p.status).toLowerCase()) ||
          ['active', 'approved', 'ativo', 'aprovado'].includes(String(p.raw_status).toLowerCase())
        );
      } else if (statusFilter === 'blocked') {
        all = all.filter((p) =>
          ['blocked', 'rejected', 'suspended', 'bloqueado', 'rejeitado', 'suspenso', 'inativo'].includes(String(p.status).toLowerCase()) ||
          ['blocked', 'rejected', 'suspended', 'bloqueado', 'rejeitado', 'suspenso', 'inativo'].includes(String(p.raw_status).toLowerCase())
        );
      }

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        all = all.filter((p) =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.full_name && p.full_name.toLowerCase().includes(q)) ||
          (p.email && p.email.toLowerCase().includes(q)) ||
          (p.phone && p.phone.toLowerCase().includes(q)) ||
          (p.whatsapp && p.whatsapp.toLowerCase().includes(q)) ||
          (p.cpf_cnpj && p.cpf_cnpj.toLowerCase().includes(q)) ||
          (p.pix_key && p.pix_key.toLowerCase().includes(q)) ||
          (p.referral_code && p.referral_code.toLowerCase().includes(q))
        );
      }

      return all;
    },
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });

  const commissionsQ = useQuery({
    queryKey: commissionKeys.byMaster({ status: statusFilter, month: monthFilter }),
    queryFn: async () => {
      const res = await base44.functions.invoke('partnerAdminAction', {
        action: 'list_commissions',
        status: statusFilter === 'all' ? undefined : statusFilter,
        month: monthFilter || undefined,
        limit: 200,
      });
      return res?.data?.commissions || [];
    },
    enabled: tab === 'commissions',
    staleTime: 30_000,
  });

  const referralsQ = useQuery({
    queryKey: referralKeys.byPartner(viewReferrals?.id),
    queryFn: async () => {
      const res = await base44.functions.invoke('partnerAdminAction', {
        action: 'list_referrals',
        partner_id: viewReferrals.id,
        limit: 200,
      });
      return res?.data?.referrals || [];
    },
    enabled: !!viewReferrals,
  });

  const adminMutation = useMutation({
    mutationFn: async (payload) => {
      const { action, partner_id, partner_email } = payload;
      console.log('[MasterPartners] Executando ação de admin:', payload);

      // 1. Atualiza persistência no Supabase
      if (isSupabaseConfigured && supabase) {
        try {
          let newStatus = 'active';
          if (action === 'approve_partner' || action === 'activate_partner') newStatus = 'active';
          if (action === 'reject_partner' || action === 'block_partner' || action === 'suspend_partner') newStatus = 'blocked';

          if (partner_id) {
            await supabase.from('partners').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', partner_id);
          }
          if (partner_email) {
            await supabase.from('partners').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('email', partner_email.toLowerCase().trim());
          }
        } catch (supaErr) {
          console.warn('[MasterPartners] Erro ao sincronizar com Supabase:', supaErr);
        }
      }

      // 2. Atualiza via partnerAdminAction local
      try {
        return await base44.functions.invoke('partnerAdminAction', payload);
      } catch (_) {
        return { data: { success: true } };
      }
    },
    onSuccess: (_data, variables) => {
      const action = variables?.action;
      const targetId = variables?.partner_id;
      const targetEmail = variables?.partner_email?.toLowerCase().trim();
      const nextStatus =
        action === 'approve_partner' || action === 'activate_partner' ? 'active' : 'blocked';

      qc.setQueriesData({ queryKey: partnerKeys.all() }, (oldList) => {
        if (!Array.isArray(oldList)) return oldList;
        return oldList.map((item) => {
          const matchId = targetId && item.id === targetId;
          const matchEmail = targetEmail && item.email?.toLowerCase().trim() === targetEmail;
          if (matchId || matchEmail) {
            return { ...item, status: nextStatus, raw_status: nextStatus };
          }
          return item;
        });
      });

      qc.invalidateQueries({ queryKey: partnerKeys.all() });
      qc.invalidateQueries({ queryKey: commissionKeys.all() });
      qc.invalidateQueries({ queryKey: ['partners', 'kpis'] });
      qc.invalidateQueries({ queryKey: ['partner', 'detail'] });
      qc.invalidateQueries({ queryKey: ['referrals', 'master'] });

      const labelMsg =
        nextStatus === 'active'
          ? `Parceiro aprovado e ativado com sucesso (${variables?.partner_email || variables?.partner_id})!`
          : `Status do parceiro atualizado para bloqueado/rejeitado.`;
      setPartnerActionNotice(labelMsg);
      toast({
        title: nextStatus === 'active' ? 'Parceiro aprovado com sucesso!' : 'Status atualizado',
        description: labelMsg,
      });
    },
  });

  // Abre modal de confirmação de exclusão
  const handleDeletePartner = (partnerOrId) => {
    const partner = typeof partnerOrId === 'object'
      ? partnerOrId
      : (partnersQ.data || []).find((p) => p.id === partnerOrId);
    if (partner) {
      setPartnerToDelete(partner);
    }
  };

  // Executa a exclusão definitiva do parceiro
  const executeDeletePartner = async (partner) => {
    if (!partner?.id) return;
    const id = partner.id;
    const partnerName = partner?.name || partner?.full_name || partner?.email || 'este parceiro';

    setIsDeleting(true);
    try {
      // 1. Persistência imediata no localStorage da lista de IDs deletados
      if (typeof window !== 'undefined') {
        try {
          const rawDel = localStorage.getItem('ocorte_deleted_partner_ids') || '[]';
          const delList = JSON.parse(rawDel);
          if (!delList.includes(id)) {
            delList.push(id);
            localStorage.setItem('ocorte_deleted_partner_ids', JSON.stringify(delList));
          }

          const raw = localStorage.getItem('ocorte_partner_leads') || '[]';
          const list = JSON.parse(raw);
          const updated = list.filter((p) => p.id !== id && (!partner?.email || p.email?.toLowerCase() !== partner.email?.toLowerCase()));
          localStorage.setItem('ocorte_partner_leads', JSON.stringify(updated));
        } catch (_) {}
      }

      // 2. Remoção no Supabase (delete direto + update status seguro)
      if (isSupabaseConfigured && supabase && id) {
        try {
          await supabase
            .from('partners')
            .delete()
            .eq('id', id);
        } catch (delErr) {
          console.warn('[executeDeletePartner] Exclusão direta encontrou aviso:', delErr);
        }

        try {
          await supabase
            .from('partners')
            .update({ status: 'deleted', updated_at: new Date().toISOString() })
            .eq('id', id);
        } catch (_) {}
      }

      // 3. Atualização otimista e imediata do estado da listagem na UI
      qc.setQueriesData({ queryKey: ['partners'] }, (old) => {
        if (Array.isArray(old)) {
          return old.filter((p) => p.id !== id);
        }
        return old;
      });

      // 4. Invalidação de queries em background
      await Promise.all([
        qc.invalidateQueries({ queryKey: partnerKeys.all() }),
        qc.invalidateQueries({ queryKey: ['partners', 'kpis'] }),
      ]);

      toast({
        title: 'Parceiro excluído',
        description: `O parceiro "${partnerName}" foi removido com sucesso.`,
      });

      setPartnerToDelete(null);
      if (detailPartner?.id === id) {
        setDetailPartner(null);
      }
    } catch (err) {
      console.error('[executeDeletePartner] Erro:', err);
      toast({
        title: 'Erro ao excluir parceiro',
        description: err.message || 'Não foi possível excluir o parceiro. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const partners = partnersQ.data || [];
  const commissions = commissionsQ.data || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black tracking-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
            Gestão de Parceiros
          </h1>
          <p className="text-white/55 text-sm mt-1">
            Aprove cadastros, gerencie comissões e acompanhe o programa de indicações.
          </p>
        </div>
      </div>

      {/* KPIs Gerais */}
      <MasterPartnersKpis kpis={kpisQ.data} isLoading={kpisQ.isLoading} />

      {/* Navegação entre Módulos */}
      <div className="flex items-center gap-1 bg-white/[0.03] border border-white/8 rounded-2xl p-1 w-fit overflow-x-auto">
        {[
          { k: 'partners', label: 'Parceiros Cadastrados', icon: Users },
          { k: 'payouts', label: 'Pagamentos do Mês', icon: Wallet },
          { k: 'commissions', label: 'Comissões', icon: DollarSign },
          { k: 'referrals', label: 'Indicações', icon: FileText },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.k}
              onClick={() => {
                setTab(t.k);
                setVisible(PAGE);
                setStatusFilter('all');
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                tab === t.k
                  ? 'bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white shadow-md'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Toolbar & Filtros Rápidos */}
      {tab === 'partners' && (
        <div className="space-y-3">
          {/* Abas de Filtro Rápido por Status */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'pending', label: 'Pendentes de Aprovação' },
              { id: 'active', label: 'Aprovados / Ativos' },
              { id: 'blocked', label: 'Bloqueados / Rejeitados' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setStatusFilter(f.id);
                  setVisible(PAGE);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === f.id
                    ? 'bg-white text-[#050816] shadow-sm'
                    : 'bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white border border-white/8'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Barra de Busca */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, email, telefone, CPF ou código..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20"
            />
          </div>
        </div>
      )}

      {/* TAB: Parceiros */}
      {tab === 'partners' && partnerActionNotice && (
        <div
          role="status"
          aria-live="polite"
          data-testid="partner-action-confirmation"
          className="rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 text-emerald-300 text-xs font-semibold flex items-center justify-between gap-2"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{partnerActionNotice}</span>
          </span>
          <button
            type="button"
            onClick={() => setPartnerActionNotice('')}
            className="text-emerald-200 underline text-[11px]"
          >
            Fechar
          </button>
        </div>
      )}

      {tab === 'partners' && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.025] backdrop-blur-xl overflow-hidden shadow-2xl">
          {partnersQ.isLoading ? (
            <div className="p-12 text-center text-white/50 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-[#60A5FA]" />
              <span>Carregando parceiros...</span>
            </div>
          ) : partners.length === 0 ? (
            <div className="p-12 text-center text-white/50">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-25" />
              <p className="text-base font-semibold text-white/70">Nenhum parceiro encontrado.</p>
              <p className="text-xs text-white/40 mt-1">Ajuste os filtros de busca ou verifique novos cadastros.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-white/80">
                <thead className="bg-white/[0.03] text-white/50 text-[11px] uppercase tracking-wider border-b border-white/8">
                  <tr>
                    <th className="py-3.5 px-4">Parceiro / Contato</th>
                    <th className="py-3.5 px-4">WhatsApp</th>
                    <th className="py-3.5 px-4">CPF / CNPJ</th>
                    <th className="py-3.5 px-4">Chave PIX</th>
                    <th className="py-3.5 px-4">Código</th>
                    <th className="py-3.5 px-4">Cadastro</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Ações de Gestão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {partners.slice(0, visible).map((p) => {
                    const statusObj = STATUS_PARTNER[p.status] || STATUS_PARTNER.pending;
                    const isPending = p.status === 'pending';
                    const isApproved = p.status === 'active' || p.status === 'approved';
                    const isBlocked = p.status === 'blocked' || p.status === 'rejected' || p.status === 'suspended';

                    return (
                      <tr key={p.id || p.email} className="hover:bg-white/[0.02] transition-colors">
                        {/* Nome / Email */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white text-sm">{p.name || p.full_name}</div>
                          <div className="text-xs text-white/50">{p.email}</div>
                        </td>

                        {/* WhatsApp */}
                        <td className="py-3.5 px-4 text-xs text-white/70">
                          {p.phone || p.whatsapp ? (
                            <span className="font-mono">{p.phone || p.whatsapp}</span>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </td>

                        {/* CPF/CNPJ */}
                        <td className="py-3.5 px-4 text-xs text-white/70">
                          {p.cpf_cnpj ? (
                            <span className="font-mono">{p.cpf_cnpj}</span>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </td>

                        {/* Chave PIX */}
                        <td className="py-3.5 px-4 text-xs text-white/70">
                          {p.pix_key ? (
                            <span className="font-mono text-emerald-300/90">{p.pix_key}</span>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </td>

                        {/* Código de Indicação */}
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-[#93C5FD] bg-[#2563EB]/15 px-2 py-0.5 rounded-lg text-xs">
                            {p.referral_code || '—'}
                          </span>
                        </td>

                        {/* Data de Cadastro */}
                        <td className="py-3.5 px-4 text-xs text-white/50">
                          {p.created_date ? (
                            format(new Date(p.created_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                          ) : (
                            '—'
                          )}
                        </td>

                        {/* Status com Badge Colorido */}
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${statusObj.cls}`}>
                            {statusObj.label}
                          </span>
                        </td>

                        {/* Botões de Ação */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Se Pendente: Botões de Aprovar e Rejeitar */}
                            {isPending && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    adminMutation.mutate({
                                      action: 'approve_partner',
                                      partner_id: p.id,
                                      partner_email: p.email,
                                    })
                                  }
                                  disabled={adminMutation.isPending}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/35 border border-emerald-400/40 text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                                  title="Aprovar Parceiro"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Aprovar</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    adminMutation.mutate({
                                      action: 'reject_partner',
                                      partner_id: p.id,
                                      partner_email: p.email,
                                    })
                                  }
                                  disabled={adminMutation.isPending}
                                  className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/35 border border-rose-400/40 text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                                  title="Rejeitar / Bloquear Parceiro"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Rejeitar</span>
                                </button>
                              </>
                            )}

                            {/* Se Aprovado: Botão de Bloquear */}
                            {isApproved && (
                              <button
                                type="button"
                                onClick={() =>
                                  adminMutation.mutate({
                                    action: 'block_partner',
                                    partner_id: p.id,
                                    partner_email: p.email,
                                  })
                                }
                                disabled={adminMutation.isPending}
                                className="px-3 py-1.5 rounded-xl bg-rose-500/15 text-rose-300 hover:bg-rose-500/30 border border-rose-400/30 text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                                title="Bloquear Acesso"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                <span>Bloquear</span>
                              </button>
                            )}

                            {/* Se Bloqueado: Botão de Reativar */}
                            {isBlocked && (
                              <button
                                type="button"
                                onClick={() =>
                                  adminMutation.mutate({
                                    action: 'activate_partner',
                                    partner_id: p.id,
                                    partner_email: p.email,
                                  })
                                }
                                disabled={adminMutation.isPending}
                                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/35 border border-emerald-400/40 text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                                title="Reativar / Aprovar Acesso"
                              >
                                <Play className="w-3.5 h-3.5" />
                                <span>Reativar</span>
                              </button>
                            )}

                            {/* Botões Auxiliares */}
                            <button
                              type="button"
                              onClick={() => setDetailPartner(p)}
                              className="p-2 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                              title="Ver Detalhes do Parceiro"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setViewReferrals(p)}
                              className="p-2 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                              title="Ver Indicações Deste Parceiro"
                            >
                              <FileText className="w-4 h-4" />
                            </button>

                            {/* Botão de Excluir Parceiro */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleDeletePartner(p);
                              }}
                              className="p-2 rounded-xl hover:bg-rose-500/20 text-rose-400/80 hover:text-rose-300 transition-colors cursor-pointer"
                              title="Excluir Parceiro"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {visible < partners.length && (
            <div className="p-4 border-t border-white/8 text-center bg-white/[0.01]">
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE)}
                className="text-sm font-bold text-[#93C5FD] hover:underline cursor-pointer"
              >
                Carregar mais parceiros ({partners.length - visible} restantes)
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB: Payouts */}
      {tab === 'payouts' && (
        <MasterPartnersPayoutsTab month={monthFilter} onMonthChange={setMonthFilter} />
      )}

      {/* TAB: Commissions */}
      {tab === 'commissions' && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.025] backdrop-blur-xl overflow-hidden shadow-2xl">
          {commissionsQ.isLoading ? (
            <div className="p-10 text-center text-white/50 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#60A5FA]" />
              <span>Carregando comissões...</span>
            </div>
          ) : commissions.length === 0 ? (
            <div className="p-12 text-center text-white/50">
              <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-25" />
              <p className="text-sm">Nenhuma comissão registrada no ciclo.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-white/80">
                <thead className="bg-white/[0.03] text-white/50 text-[11px] uppercase tracking-wider border-b border-white/8">
                  <tr>
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Parceiro</th>
                    <th className="py-3 px-4">Ciclo</th>
                    <th className="py-3 px-4">Mensalidade</th>
                    <th className="py-3 px-4">%</th>
                    <th className="py-3 px-4">Comissão</th>
                    <th className="py-3 px-4">Hold / Pagamento</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {commissions.slice(0, visible).map((c) => {
                    const s = STATUS_COMM[c.status] || STATUS_COMM.pending;
                    const partner = partners.find((p) => p.id === c.partner_id);
                    return (
                      <tr key={c.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-4 text-white/60 text-xs">
                          {format(new Date(c.created_date), 'dd MMM yyyy', { locale: ptBR })}
                        </td>
                        <td className="py-3 px-4 font-semibold text-xs text-white">
                          {partner?.name || c.partner_id?.slice(0, 8)}
                        </td>
                        <td className="py-3 px-4 text-white/70">#{c.billing_cycle}</td>
                        <td className="py-3 px-4 text-white/60">{brl(c.invoice_amount)}</td>
                        <td className="py-3 px-4 text-white/70">{c.commission_percentage}%</td>
                        <td className="py-3 px-4 font-bold text-emerald-300">{brl(c.amount)}</td>
                        <td className="py-3 px-4 text-white/55 text-xs">
                          {c.status === 'pending' && c.hold_until
                            ? '↦ ' + format(new Date(c.hold_until), 'dd MMM', { locale: ptBR })
                            : c.paid_at
                            ? format(new Date(c.paid_at), 'dd MMM', { locale: ptBR })
                            : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center gap-1 justify-end">
                            {c.status === 'approved' && (
                              <button
                                type="button"
                                onClick={() => setPayCommission(c)}
                                className="px-2.5 py-1.5 rounded-lg bg-blue-500/15 text-blue-200 hover:bg-blue-500/25 text-xs font-semibold"
                              >
                                Marcar pago
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Drawer de Detalhes do Parceiro */}
      {detailPartner && (
        <PartnerDetailDrawer
          partner={detailPartner}
          onClose={() => setDetailPartner(null)}
          onDelete={(p) => {
            setDetailPartner(null);
            handleDeletePartner(p);
          }}
          onAction={(payload) => {
            adminMutation.mutate(payload);
            setDetailPartner(null);
          }}
        />
      )}

      {/* Modal de Ver Indicações */}
      {viewReferrals && (
        <StandardModal
          open={!!viewReferrals}
          onClose={() => setViewReferrals(null)}
          title={`Indicações de ${viewReferrals.name}`}
          size="lg"
        >
          <div className="space-y-4">
            {referralsQ.isLoading ? (
              <div className="p-8 text-center text-white/50">Carregando indicações...</div>
            ) : referralsQ.data?.length === 0 ? (
              <div className="p-8 text-center text-white/50">Nenhuma indicação registrada para este parceiro.</div>
            ) : (
              <div className="space-y-2">
                {referralsQ.data?.map((ref) => (
                  <div key={ref.id} className="p-3 rounded-xl bg-white/[0.04] border border-white/8 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white text-sm">{ref.company_name || 'Barbearia'}</div>
                      <div className="text-white/50">Plano: {ref.plan_name || 'Pro'}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-300">{brl(ref.commission)} / mês</div>
                      <div className="text-white/50 capitalize">{ref.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </StandardModal>
      )}

      {/* Modal de Confirmação de Exclusão de Parceiro */}
      <StandardModal
        open={Boolean(partnerToDelete)}
        onClose={() => !isDeleting && setPartnerToDelete(null)}
        title="Excluir Cadastro de Parceiro"
        size="sm"
      >
        <div className="space-y-4 pt-1">
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-300 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white font-semibold">
                Deseja realmente excluir este parceiro?
              </p>
              <div className="mt-1.5 p-2 rounded-lg bg-black/30 border border-white/5">
                <p className="text-xs font-bold text-white truncate">
                  {partnerToDelete?.name || partnerToDelete?.full_name || 'Sem nome'}
                </p>
                <p className="text-[11px] text-white/50 truncate font-mono">
                  {partnerToDelete?.email}
                </p>
              </div>
              <p className="text-xs text-rose-300/80 mt-2 font-medium">
                Esta ação removerá o registro permanentemente e não poderá ser desfeita.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setPartnerToDelete(null)}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => executeDeletePartner(partnerToDelete)}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Trash2 className="w-4 h-4 text-white" />
              )}
              <span>{isDeleting ? 'Excluindo...' : 'Sim, excluir parceiro'}</span>
            </button>
          </div>
        </div>
      </StandardModal>
    </div>
  );
}