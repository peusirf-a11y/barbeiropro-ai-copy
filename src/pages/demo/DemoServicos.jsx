/**
 * DemoServicos — Grid de serviços idêntico ao AppServicos.
 */
import DemoLayout from '@/components/layout/DemoLayout';
import { demoServices } from '@/lib/demoData';
import { Clock, Star, Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';

export default function DemoServicos() {
  const handleDemoAction = () =>
    toast.info('Ação disponível na conta real. Crie sua conta grátis!', { duration: 3000 });

  return (
    <DemoLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-[#1B1C1E]">Serviços</h1>
            <p className="text-gray-500 text-sm mt-1">{demoServices.length} serviços cadastrados</p>
          </div>
          <button
            onClick={handleDemoAction}
            className="bg-[#2563EB] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#1d4ed8] transition-colors flex items-center gap-2 shadow-[0_4px_12px_rgba(37,99,235,0.25)]"
          >
            <Plus className="w-4 h-4" />Novo serviço
          </button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {demoServices.map(s => (
            <div
              key={s.id}
              className="bg-white rounded-2xl border border-black/5 p-6 hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer group shadow-[var(--shadow-sm)]"
              onClick={handleDemoAction}
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-[#1B1C1E]">{s.name}</h3>
                <div className="flex items-center gap-1">
                  {s.featured && (
                    <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 font-semibold px-2 py-1 rounded-lg">
                      <Star className="w-3 h-3 fill-yellow-500" />Destaque
                    </span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); handleDemoAction(); }}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-gray-100 transition-all"
                  >
                    <Pencil className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-4">{s.description}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-lg">
                    <Clock className="w-3.5 h-3.5" />
                    {s.duration_minutes} min
                  </div>
                </div>
                <div className="text-xl font-black text-[#2563EB]">R$ {s.price}</div>
              </div>
              <div className="mt-3 pt-3 border-t border-black/5 flex items-center justify-between">
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {s.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DemoLayout>
  );
}