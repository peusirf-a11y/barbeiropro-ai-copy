// Modal de upsell exibido quando usuário atinge limite do plano ou tenta acessar feature bloqueada.
// Reusa UpgradePlanCard para listar planos disponíveis.
import { X, Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import UpgradePlanCard from '@/components/billing/UpgradePlanCard';

export default function UpsellModal({ open, onClose, reason, currentPlanId }) {
  if (!open) return null;

  const handleWhatsApp = () => {
    try {
      base44.functions.invoke('trackEvent', {
        event_type: 'upsell_clicked',
        metadata: { reason, channel: 'whatsapp' },
      });
    } catch { /* best effort */ }
    window.open('https://wa.me/5511999999999?text=Quero%20fazer%20upgrade%20do%20BarberTrimly', '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6 border-b border-black/5 flex items-start gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Lock className="w-5 h-5 text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-[#0F172A]">Você atingiu o limite do seu plano</h2>
            <p className="text-sm text-gray-500 mt-1">{reason || 'Faça upgrade para continuar usando esta funcionalidade.'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg flex-shrink-0">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          <UpgradePlanCard currentPlanId={currentPlanId} highlight />

          <div className="border-t border-black/5 pt-4 text-center">
            <p className="text-xs text-gray-500 mb-2">Prefere falar com a gente?</p>
            <button
              onClick={handleWhatsApp}
              className="text-sm font-semibold text-[#2563EB] hover:underline"
            >
              Falar no WhatsApp →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}