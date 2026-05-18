// Barbearias — listagem completa com ações (visualizar, bloquear, excluir, impersonar) e criação manual.
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus } from 'lucide-react';
import CompaniesTable from '@/components/master/CompaniesTable';
import StandardModal from '@/components/ui/standard-modal';

export default function MasterBarbearias() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', owner_email: '', plan_name: 'Starter', status: 'active' });
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Company.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-companies'] });
      queryClient.invalidateQueries({ queryKey: ['master-metrics'] });
      setShowForm(false);
      setForm({ name: '', owner_email: '', plan_name: 'Starter', status: 'active' });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-black text-foreground tracking-tight">Barbearias</h2>
          <p className="text-sm text-muted-foreground mt-1">Todas as empresas cadastradas no sistema.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="text-xs font-semibold bg-[#2563EB] text-white hover:bg-[#1d4ed8] px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-[0_4px_12px_rgba(37,99,235,0.25)] active:scale-[0.98] transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Nova empresa
        </button>
      </div>

      <CompaniesTable />

      <StandardModal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Nova Empresa Cliente"
        footer={
          <>
            <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.name || createMutation.isPending}
              className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 shadow-[0_4px_12px_rgba(37,99,235,0.25)] active:scale-[0.98] transition-all"
            >
              {createMutation.isPending ? 'Criando…' : 'Criar empresa'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {[
            { label: 'Nome da barbearia *', key: 'name', type: 'text' },
            { label: 'E-mail do responsável', key: 'owner_email', type: 'email' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">{f.label}</label>
              <input
                type={f.type}
                value={form[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background text-foreground"
              />
            </div>
          ))}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Plano</label>
            <select
              value={form.plan_name}
              onChange={e => setForm(p => ({ ...p, plan_name: e.target.value }))}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background text-foreground"
            >
              <option>Starter</option>
              <option>Pro</option>
              <option>Enterprise</option>
            </select>
          </div>
        </div>
      </StandardModal>
    </div>
  );
}