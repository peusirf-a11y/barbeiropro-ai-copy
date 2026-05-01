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
import SystemHealth from '@/components/master/SystemHealth';
import PlansManager from '@/components/master/PlansManager';

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
    <div className="min-h-screen bg-[#F7F8FB] font-inter">
      {/* Header — gradient premium */}
      <header className="bg-gradient-to-r from-[#0B1020] via-[#1d4ed8] to-[#2563EB] text-white px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex items-center justify-between gap-3 shadow-[0_8px_24px_rgba(15,23,42,0.10)]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur ring-1 ring-white/20 flex items-center justify-center overflow-hidden">
            <Logo size={36} />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm sm:text-base truncate tracking-tight">BarberTrimly — Master</div>
            <div className="text-[11px] sm:text-xs text-white/70 truncate font-medium">Painel Super Admin</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowForm(true)}
            className="text-xs font-semibold bg-white text-[#2563EB] hover:bg-white/90 px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.15)] active:scale-[0.98] transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Nova empresa
          </button>
          <Link to="/" className="text-xs text-white/70 hover:text-white hidden sm:inline px-2 py-1 rounded-lg hover:bg-white/10 transition-colors">← LP</Link>
          <Link to="/app/dashboard" className="text-xs text-white/70 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors">App →</Link>
        </div>
      </header>

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-[1400px] mx-auto animate-fade-in">
        <MasterMetrics />
        <SystemAlertsList />
        <SystemHealth />
        <CompaniesTable />
        <PlansManager />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FeatureFlagsManager />
          <AuditLogList />
        </div>
      </div>

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