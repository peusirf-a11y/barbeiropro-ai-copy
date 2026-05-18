// Modal de configuração de permissões e unidades de um TeamMember (Fase 4).
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import StandardModal from '@/components/ui/standard-modal';
import { Loader2 } from 'lucide-react';
import { useCompany } from '@/hooks/useCompany';
import CashPermissionsEditor from '@/components/equipe/CashPermissionsEditor';

const CROSS_UNIT_ROLES = ['admin', 'financeiro'];

export default function MemberPermissionsModal({ open, onClose, member }) {
  const { companyId } = useCompany();
  const queryClient = useQueryClient();
  const [cashPerms, setCashPerms] = useState({});
  const [unitIds, setUnitIds] = useState([]);

  useEffect(() => {
    if (member) {
      setCashPerms(member.cash_permissions || {});
      setUnitIds(member.unit_ids || []);
    }
  }, [member]);

  const { data: units = [] } = useQuery({
    queryKey: ['units-perm', companyId],
    queryFn: () => base44.entities.Unit.filter({ company_id: companyId }, 'sort_order', 50),
    enabled: !!companyId && open,
  });

  const isCrossUnit = member && CROSS_UNIT_ROLES.includes(member.role);

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.TeamMember.update(member.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', companyId] });
      onClose();
    },
  });

  const toggleUnit = (id) => {
    setUnitIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSave = () => {
    saveMutation.mutate({
      cash_permissions: Object.keys(cashPerms).length ? cashPerms : null,
      unit_ids: unitIds,
    });
  };

  if (!member) return null;

  return (
    <StandardModal
      open={open}
      onClose={onClose}
      title={`Permissões · ${member.name}`}
      size="xl"
      footer={
        <>
          <button onClick={onClose} className="flex-1 min-h-[48px] px-4 border border-white/12 bg-white/[0.04] text-white/80 rounded-xl text-sm font-medium hover:bg-white/[0.08] transition-colors">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex-1 min-h-[48px] px-4 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white rounded-xl text-sm font-semibold ring-1 ring-white/15 hover:brightness-110 disabled:opacity-50 inline-flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(37,99,235,0.4)] transition-all"
          >
            {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Unidades */}
        {units.length > 0 && (
          <section>
            <h4 className="font-bold text-sm text-white mb-1">Acesso a unidades</h4>
            <p className="text-xs text-white/55 mb-3">
              {isCrossUnit
                ? 'Admin e Financeiro veem todas as unidades por padrão. A configuração abaixo é informativa.'
                : 'Selecione as unidades às quais este membro tem acesso. Vazio = todas (compatibilidade).'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {units.map(u => {
                const checked = unitIds.includes(u.id);
                return (
                  <label
                    key={u.id}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      checked
                        ? 'bg-blue-400/15 border-blue-400/40 ring-1 ring-blue-400/20'
                        : 'bg-white/[0.04] border-white/10 hover:border-blue-400/30 hover:bg-white/[0.06]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleUnit(u.id)}
                      className="rounded accent-[#2563EB]"
                    />
                    <span className="text-sm font-medium text-white">{u.name}</span>
                  </label>
                );
              })}
            </div>
          </section>
        )}

        {/* Permissões do Caixa */}
        <section>
          <h4 className="font-bold text-sm text-white mb-3">Permissões do Caixa</h4>
          <CashPermissionsEditor role={member.role} value={cashPerms} onChange={setCashPerms} />
        </section>
      </div>
    </StandardModal>
  );
}