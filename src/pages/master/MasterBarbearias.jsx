// Barbearias — listagem completa com ações (visualizar, bloquear, excluir, impersonar) e criação manual.
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, X } from 'lucide-react';
import CompaniesTable from '@/components/master/CompaniesTable';

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
          <h2 className="text-2xl font-black text-[#111827] tracking-tight">Barbearias</h2>
          <p className="text-sm text-[#6B7280] mt-1">Todas as empresas cadastradas no sistema.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="text-xs font-semibold bg-[#2563EB] text-white hover:bg-[#1d4ed8] px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-[0_4px_12px_rgba(37,99,235,0.25)] active:scale-[0.98] transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Nova empresa
        </button>
      </div>

      <CompaniesTable />

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-[var(--shadow-xl)]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-[#111827] text-lg tracking-tight">Nova Empresa Cliente</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Nome da barbearia *', key: 'name', type: 'text' },
                { label: 'E-mail do responsável', key: 'owner_email', type: 'email' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-semibold text-[#6B7280] block mb-1.5">{f.label}</label>
                  <input
                    type={f.type}
                    value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-black/10 rounded-xl text-sm"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold text-[#6B7280] block mb-1.5">Plano</label>
                <select
                  value={form.plan_name}
                  onChange={e => setForm(p => ({ ...p, plan_name: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-black/10 rounded-xl text-sm"
                >
                  <option>Starter</option>
                  <option>Pro</option>
                  <option>Enterprise</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 border border-black/10 rounded-xl text-sm font-semibold text-[#111827] hover:bg-gray-50 transition-colors">Cancelar</button>
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.name || createMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 shadow-[0_4px_12px_rgba(37,99,235,0.25)] active:scale-[0.98] transition-all"
              >
                {createMutation.isPending ? 'Criando…' : 'Criar empresa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}