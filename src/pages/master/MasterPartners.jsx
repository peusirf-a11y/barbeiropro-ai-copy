// Master /master/partners — gestão completa do programa de parceiros.
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { partnerKeys, commissionKeys, referralKeys } from '@/lib/partnerKeys';
import { Users, DollarSign, CheckCircle2, Pause, Play, Search, Pencil, FileText, Eye } from 'lucide-react';
import FilterSelect from '@/components/ui/filter-select';
import StandardModal from '@/components/ui/standard-modal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import MasterPartnersKpis from '@/components/master/MasterPartnersKpis';
import MasterPartnersReferralsTab from '@/components/master/MasterPartnersReferralsTab';
import PartnerDetailDrawer from '@/components/master/PartnerDetailDrawer';

const brl = (n) => 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ',');
const PAGE = 25;

const STATUS_PARTNER = {
  pending: { label: 'Pendente', cls: 'bg-amber-500/15 text-amber-200 border-amber-400/30' },
  active: { label: 'Ativo', cls: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30' },
  suspended: { label: 'Suspenso', cls: 'bg-rose-500/15 text-rose-200 border-rose-400/30' },
};
const STATUS_COMM = {
  pending: { label: 'Hold', cls: 'bg-amber-500/15 text-amber-200 border-amber-400/30' },
  approved: { label: 'Aprovado', cls: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30' },
  paid: { label: 'Pago', cls: 'bg-blue-500/15 text-blue-200 border-blue-400/30' },
  cancelled: { label: 'Cancelado', cls: 'bg-rose-500/15 text-rose-200 border-rose-400/30' },
  chargeback: { label: 'Chargeback', cls: 'bg-rose-500/25 text-rose-200 border-rose-400/45' },
};

export default function MasterPartners() {
  const [tab, setTab] = useState('partners');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editPartner, setEditPartner] = useState(null);
  const [payCommission, setPayCommission] = useState(null);
  const [viewReferrals, setViewReferrals] = useState(null);
  const [detailPartnerId, setDetailPartnerId] = useState(null);
  const [visible, setVisible] = useState(PAGE);
  const qc = useQueryClient();

  const kpisQ = useQuery({
    queryKey: ['partners', 'kpis'],
    queryFn: async () => {
      const res = await base44.functions.invoke('partnerAdminAction', { action: 'kpis' });
      return res?.data?.kpis || null;
    },
    staleTime: 60_000,
  });

  const partnersQ = useQuery({
    queryKey: partnerKeys.list({ status: statusFilter, search }),
    queryFn: async () => {
      const res = await base44.functions.invoke('partnerAdminAction', {
        action: 'list_partners',
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search || undefined,
        limit: 200,
      });
      return res?.data?.partners || [];
    },
    staleTime: 30_000,
  });

  const commissionsQ = useQuery({
    queryKey: commissionKeys.byMaster({ status: statusFilter }),
    queryFn: async () => {
      const res = await base44.functions.invoke('partnerAdminAction', {
        action: 'list_commissions',
        status: statusFilter === 'all' ? undefined : statusFilter,
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
        action: 'list_referrals', partner_id: viewReferrals.id, limit: 200,
      });
      return res?.data?.referrals || [];
    },
    enabled: !!viewReferrals,
  });

  const adminMutation = useMutation({
    mutationFn: (payload) => base44.functions.invoke('partnerAdminAction', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: partnerKeys.all() });
      qc.invalidateQueries({ queryKey: commissionKeys.all() });
      qc.invalidateQueries({ queryKey: ['partners', 'kpis'] });
      qc.invalidateQueries({ queryKey: ['partner', 'detail'] });
      qc.invalidateQueries({ queryKey: ['referrals', 'master'] });
    },
  });

  const partners = partnersQ.data || [];
  const commissions = commissionsQ.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black tracking-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">Parceiros</h1>
        <p className="text-white/55 text-sm mt-1">Aprove cadastros, gerencie comissões e monitore o programa de indicações.</p>
      </div>

      {/* KPIs */}
      <MasterPartnersKpis kpis={kpisQ.data} isLoading={kpisQ.isLoading} />

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white/[0.03] border border-white/8 rounded-xl p-1 w-fit overflow-x-auto">
        {[
          { k: 'partners', label: 'Parceiros', icon: Users },
          { k: 'commissions', label: 'Comissões', icon: DollarSign },
          { k: 'referrals', label: 'Indicações', icon: FileText },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button key={t.k} onClick={() => { setTab(t.k); setVisible(PAGE); setStatusFilter('all'); }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t.k ? 'bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white' : 'text-white/60 hover:text-white'}`}>
              <Icon className="w-4 h-4" />{t.label}
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2">
        {tab === 'partners' && (
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome, email ou código..."
              className="w-full pl-9 pr-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20"
            />
          </div>
        )}
        <FilterSelect value={statusFilter} onChange={(v) => { setStatusFilter(v); setVisible(PAGE); }}>
          <option value="all">Todos os status</option>
          {tab === 'partners' && (
            <>
              <option value="pending">Pendentes (aprovação)</option>
              <option value="active">Ativos</option>
              <option value="suspended">Suspensos</option>
            </>
          )}
          {tab === 'commissions' && (
            <>
              <option value="pending">Em hold</option>
              <option value="approved">Aprovado · pagar</option>
              <option value="paid">Pago</option>
              <option value="cancelled">Cancelado</option>
              <option value="chargeback">Chargeback</option>
            </>
          )}
          {tab === 'referrals' && (
            <>
              <option value="pending">Clicou</option>
              <option value="converted">Convertido (trial)</option>
              <option value="active">Pagando</option>
              <option value="cancelled">Cancelado</option>
              <option value="fraud">Fraude</option>
            </>
          )}
        </FilterSelect>
      </div>

      {/* Conteúdo */}
      {tab === 'partners' && (
        <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md overflow-x-auto">
          {partnersQ.isLoading ? (
            <div className="p-8 text-center text-white/50">Carregando...</div>
          ) : partners.length === 0 ? (
            <div className="p-10 text-center text-white/50"><Users className="w-10 h-10 mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhum parceiro encontrado.</p></div>
          ) : (
            <table className="ds-table min-w-[800px]">
              <thead><tr>
                <th>Nome / Email</th><th>Código</th><th>Comissão</th><th>Cadastro</th><th>Status</th><th className="text-right">Ações</th>
              </tr></thead>
              <tbody>
                {partners.slice(0, visible).map(p => {
                  const s = STATUS_PARTNER[p.status] || STATUS_PARTNER.pending;
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-xs text-white/50">{p.email}</div>
                      </td>
                      <td><span className="font-mono font-bold text-[#93C5FD]">{p.referral_code}</span></td>
                      <td className="font-semibold">{p.commission_percentage}%</td>
                      <td className="text-white/55 text-xs">{format(new Date(p.created_date), 'dd MMM yyyy', { locale: ptBR })}</td>
                      <td><span className={`ds-badge ${s.cls}`}>{s.label}</span></td>
                      <td>
                        <div className="flex items-center gap-1 justify-end">
                          {p.status === 'pending' && (
                            <button onClick={() => adminMutation.mutate({ action: 'approve_partner', partner_id: p.id })}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 text-xs font-semibold inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />Aprovar
                            </button>
                          )}
                          {p.status === 'active' && (
                            <button onClick={() => { const reason = prompt('Motivo da suspensão:'); if (reason !== null) adminMutation.mutate({ action: 'suspend_partner', partner_id: p.id, reason }); }}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 text-xs font-semibold inline-flex items-center gap-1">
                              <Pause className="w-3 h-3" />Suspender
                            </button>
                          )}
                          {p.status === 'suspended' && (
                            <button onClick={() => adminMutation.mutate({ action: 'activate_partner', partner_id: p.id })}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 text-xs font-semibold inline-flex items-center gap-1">
                              <Play className="w-3 h-3" />Reativar
                            </button>
                          )}
                          <button onClick={() => setDetailPartnerId(p.id)} className="p-1.5 rounded-lg hover:bg-white/8 text-white/60" title="Ver detalhe"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditPartner(p)} className="p-1.5 rounded-lg hover:bg-white/8 text-white/60" title="Editar comissão"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setViewReferrals(p)} className="p-1.5 rounded-lg hover:bg-white/8 text-white/60" title="Ver indicações"><FileText className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {visible < partners.length && (
            <div className="p-3 border-t border-white/8 text-center">
              <button onClick={() => setVisible(v => v + PAGE)} className="text-sm font-semibold text-[#93C5FD] hover:underline">Carregar mais</button>
            </div>
          )}
        </div>
      )}

      {tab === 'commissions' && (
        <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md overflow-x-auto">
          {commissionsQ.isLoading ? (
            <div className="p-8 text-center text-white/50">Carregando...</div>
          ) : commissions.length === 0 ? (
            <div className="p-10 text-center text-white/50"><DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhuma comissão.</p></div>
          ) : (
            <table className="ds-table min-w-[900px]">
              <thead><tr>
                <th>Data</th><th>Parceiro</th><th>Ciclo</th><th>Invoice</th><th>%</th><th>Comissão</th><th>Hold/Pago</th><th>Status</th><th className="text-right">Ação</th>
              </tr></thead>
              <tbody>
                {commissions.slice(0, visible).map(c => {
                  const s = STATUS_COMM[c.status] || STATUS_COMM.pending;
                  const partner = partners.find(p => p.id === c.partner_id);
                  return (
                    <tr key={c.id}>
                      <td className="text-white/60 text-xs">{format(new Date(c.created_date), 'dd MMM yyyy', { locale: ptBR })}</td>
                      <td><div className="font-semibold text-xs">{partner?.name || c.partner_id?.slice(0, 8)}</div></td>
                      <td className="text-white/70">#{c.billing_cycle}</td>
                      <td className="text-white/60">{brl(c.invoice_amount)}</td>
                      <td className="text-white/70">{c.commission_percentage}%</td>
                      <td className="font-bold">{brl(c.amount)}</td>
                      <td className="text-white/55 text-xs">{c.status === 'pending' && c.hold_until ? '↦ ' + format(new Date(c.hold_until), 'dd MMM', { locale: ptBR }) : c.paid_at ? format(new Date(c.paid_at), 'dd MMM', { locale: ptBR }) : '—'}</td>
                      <td><span className={`ds-badge ${s.cls}`}>{s.label}</span></td>
                      <td>
                        <div className="flex items-center gap-1 justify-end">
                          {c.status === 'approved' && (
                            <button onClick={() => setPayCommission(c)}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-500/15 text-blue-200 hover:bg-blue-500/25 text-xs font-semibold">Marcar pago</button>
                          )}
                          {['pending', 'approved'].includes(c.status) && (
                            <button onClick={() => { const reason = prompt('Motivo do cancelamento:'); if (reason !== null) adminMutation.mutate({ action: 'cancel_commission', commission_id: c.id, reason }); }}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 text-xs font-semibold">Cancelar</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {visible < commissions.length && (
            <div className="p-3 border-t border-white/8 text-center">
              <button onClick={() => setVisible(v => v + PAGE)} className="text-sm font-semibold text-[#93C5FD] hover:underline">Carregar mais</button>
            </div>
          )}
        </div>
      )}

      {tab === 'referrals' && (
        <MasterPartnersReferralsTab
          statusFilter={statusFilter}
          partners={partners}
          visible={visible}
          onLoadMore={() => setVisible(v => v + PAGE)}
        />
      )}

      {/* Drawer: detalhe completo do parceiro */}
      <PartnerDetailDrawer
        partnerId={detailPartnerId}
        onClose={() => setDetailPartnerId(null)}
        onEdit={(p) => { setDetailPartnerId(null); setEditPartner(p); }}
        onAction={(payload) => adminMutation.mutate(payload)}
      />

      {/* Modal: editar comissão/notas */}
      <EditPartnerModal partner={editPartner} onClose={() => setEditPartner(null)} onSave={(patch) => { adminMutation.mutate({ action: 'update_partner', partner_id: editPartner.id, ...patch }); setEditPartner(null); }} />

      {/* Modal: pagar comissão */}
      <PayCommissionModal commission={payCommission} onClose={() => setPayCommission(null)}
        onConfirm={(ref) => { adminMutation.mutate({ action: 'mark_commission_paid', commission_id: payCommission.id, payment_reference: ref }); setPayCommission(null); }} />

      {/* Modal: ver indicações do parceiro */}
      <StandardModal open={!!viewReferrals} onClose={() => setViewReferrals(null)} title={`Indicações · ${viewReferrals?.name || ''}`} size="xl">
        {referralsQ.isLoading ? <p className="text-white/55">Carregando...</p> : (referralsQ.data || []).length === 0 ? <p className="text-white/55">Nenhuma indicação.</p> : (
          <table className="ds-table">
            <thead><tr><th>Barbearia</th><th>Status</th><th>Data</th><th>Fraude?</th></tr></thead>
            <tbody>
              {(referralsQ.data || []).map(r => (
                <tr key={r.id}>
                  <td>{r.referred_company_name || <span className="text-white/40 italic">Pendente</span>}</td>
                  <td><span className={`ds-badge ${STATUS_PARTNER[r.status]?.cls || 'bg-white/8'}`}>{r.status}</span></td>
                  <td className="text-white/55 text-xs">{format(new Date(r.created_date), 'dd MMM yyyy', { locale: ptBR })}</td>
                  <td className="text-xs">{r.fraud_reasons?.length ? <span className="text-rose-300">{r.fraud_reasons.join(', ')}</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </StandardModal>
    </div>
  );
}

function EditPartnerModal({ partner, onClose, onSave }) {
  const [pct, setPct] = useState(partner?.commission_percentage || 20);
  const [notes, setNotes] = useState(partner?.notes || '');
  if (!partner) return null;
  return (
    <StandardModal open={!!partner} onClose={onClose} title={`Editar · ${partner.name}`} size="md"
      footer={
        <>
          <button onClick={onClose} className="flex-1 min-h-[44px] px-4 border border-white/10 rounded-xl text-sm font-medium text-white/80 bg-white/[0.03] hover:bg-white/[0.06]">Cancelar</button>
          <button onClick={() => onSave({ commission_percentage: Number(pct), notes })} className="flex-1 min-h-[44px] px-4 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white rounded-xl text-sm font-semibold">Salvar</button>
        </>
      }>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-white/60 block mb-1">Comissão (%)</label>
          <input type="number" min="0" max="100" step="0.5" value={pct} onChange={e => setPct(e.target.value)}
            className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white" />
        </div>
        <div>
          <label className="text-xs font-semibold text-white/60 block mb-1">Notas internas</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
            className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white" />
        </div>
      </div>
    </StandardModal>
  );
}

function PayCommissionModal({ commission, onClose, onConfirm }) {
  const [ref, setRef] = useState('');
  if (!commission) return null;
  return (
    <StandardModal open={!!commission} onClose={onClose} title="Marcar comissão como paga" size="md"
      footer={
        <>
          <button onClick={onClose} className="flex-1 min-h-[44px] px-4 border border-white/10 rounded-xl text-sm font-medium text-white/80 bg-white/[0.03] hover:bg-white/[0.06]">Cancelar</button>
          <button onClick={() => onConfirm(ref)} className="flex-1 min-h-[44px] px-4 bg-gradient-to-br from-emerald-600 to-emerald-500 text-white rounded-xl text-sm font-semibold">Confirmar pagamento</button>
        </>
      }>
      <div className="space-y-3">
        <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 text-sm">
          <div><span className="text-white/55">Valor:</span> <span className="font-bold">{brl(commission.amount)}</span></div>
          <div><span className="text-white/55">Ciclo:</span> #{commission.billing_cycle}</div>
        </div>
        <div>
          <label className="text-xs font-semibold text-white/60 block mb-1">Referência do PIX (E2E ou comprovante)</label>
          <input value={ref} onChange={e => setRef(e.target.value)} placeholder="Ex: E12345678..."
            className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white" />
        </div>
        <p className="text-[11px] text-white/40">Faça o PIX manualmente para a chave do parceiro e registre a referência aqui.</p>
      </div>
    </StandardModal>
  );
}