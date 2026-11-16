// AllUnitsNotice — banner exibido em páginas que têm operações de criação,
// avisando o usuário que está na visão "Todas as unidades" e que para criar
// um novo registro precisa selecionar uma unidade específica no topo do app.

import { Layers, Info } from 'lucide-react';

export default function AllUnitsNotice({ message }) {
  return (
    <div className="bg-[#EFF6FF] dark:bg-blue-500/10 border border-[#DBEAFE] dark:border-blue-400/25 rounded-2xl p-4 mb-5 flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-[#2563EB] flex items-center justify-center flex-shrink-0 shadow-[0_4px_12px_rgba(37,99,235,0.25)]">
        <Layers className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[#2563EB] dark:text-[#60A5FA] font-bold text-sm mb-0.5">
          <Info className="w-3.5 h-3.5" />
          Visão consolidada
        </div>
        <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
          {message || 'Você está visualizando dados de todas as unidades. Para criar novos registros, selecione uma unidade específica no topo do app.'}
        </p>
      </div>
    </div>
  );
}