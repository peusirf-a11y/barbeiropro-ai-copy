// Passo de seleção de unidade no fluxo público de agendamento.
// Renderizado apenas quando a barbearia tem multi-unidade ativa e 2+ unidades.

import { MapPin, ChevronRight } from 'lucide-react';

export default function UnitPicker({ units, primaryColor, onSelect }) {
  return (
    <div>
      <h2 className="text-xl font-black text-[#1B1C1E] mb-2">Escolha a unidade</h2>
      <p className="text-sm text-gray-500 mb-6">Em qual unidade você quer ser atendido?</p>
      <div className="grid gap-3">
        {units.map(u => (
          <button
            key={u.id}
            onClick={() => onSelect(u)}
            className="bg-white rounded-2xl border border-black/8 p-5 text-left hover:shadow-md transition-all flex items-center gap-4 group"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0"
              style={{ backgroundColor: primaryColor }}
            >
              <MapPin className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[#1B1C1E]">{u.name}</div>
              {u.address && (
                <div className="text-xs text-gray-400 truncate">{u.address}</div>
              )}
              {u.phone && !u.address && (
                <div className="text-xs text-gray-400">{u.phone}</div>
              )}
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#1B3A4B] flex-shrink-0 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}