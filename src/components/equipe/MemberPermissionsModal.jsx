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
          <button onClick={onClose} className="flex-1 min-h-[48px] px-4 border border-black/10 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex-1 min-h-[48px] px-4 bg-[#2563EB] text-white rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 inline-flex items-center justify-center gap-2"
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
            <h4 className="font-bold text-sm text-[#111827] mb-1">Acesso a unidades</h4>
            <p className="text-xs text-[#6B7280] mb-3">
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
                      checked ? 'bg-blue-50 border-blue-300' : 'bg-white border-black/10 hover:border-[#2563EB]/30'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleUnit(u.id)}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-[#111827]">{u.name}</span>
                  </label>
                );
              })}
            </div>
          </section>
        )}

        {/* Permissões do Caixa */}
        <section>
          <h4 className="font-bold text-sm text-[#111827] mb-3">Permissões do Caixa</h4>
          <CashPermissionsEditor role={member.role} value={cashPerms} onChange={setCashPerms} />
        </section>
      </div>
    </StandardModal>
  );
}