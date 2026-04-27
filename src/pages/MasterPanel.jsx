import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import Logo from '@/components/Logo';
import { Link } from 'react-router-dom';
import MasterMetrics from '@/components/master/MasterMetrics';
import CompaniesTable from '@/components/master/CompaniesTable';
import FeatureFlagsManager from '@/components/master/FeatureFlagsManager';
import AuditLogList from '@/components/master/AuditLogList';
import SystemAlertsList from '@/components/master/SystemAlertsList';

export default function MasterPanel() {
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
    <div className="min-h-screen bg-[#F8F7F3] font-inter">
      {/* Header */}
      <header className="bg-[#2563EB] text-white px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Logo size={36} />
          <div className="min-w-0">
            <div className="font-bold text-sm sm:text-base truncate">BarberTrimly — Master</div>
            <div className="text-[11px] sm:text-xs text-white/60 truncate">Painel Super Admin</div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setShowForm(true)}
            className="text-xs font-semibold bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Nova
          </button>
          <Link to="/" className="text-xs text-white/60 hover:text-white hidden sm:inline">← LP</Link>
          <Link to="/app/dashboard" className="text-xs text-white/60 hover:text-white">App →</Link>
        </div>
      </header>

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
        <MasterMetrics />
        <SystemAlertsList />
        <CompaniesTable />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FeatureFlagsManager />
          <AuditLogList />
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-[#1B1C1E]">Nova Empresa Cliente</h3>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Nome da barbearia *', key: 'name', type: 'text' },
                { label: 'E-mail do responsável', key: 'owner_email', type: 'email' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Plano</label>
                <select
                  value={form.plan_name}
                  onChange={e => setForm(p => ({ ...p, plan_name: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm"
                >
                  <option>Starter</option>
                  <option>Pro</option>
                  <option>Enterprise</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 border border-black/10 rounded-lg text-sm font-medium">Cancelar</button>
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.name || createMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#2563EB]/90 disabled:opacity-50"
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