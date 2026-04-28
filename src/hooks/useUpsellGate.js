// useUpsellGate — Hook que gerencia o modal de upsell.
//
// Uso:
//   const { open, reason, trigger, close, currentPlanId } = useUpsellGate();
//   trigger('Comissões estão disponíveis no plano Pro+');
//
// Renderize <UpsellModal open={open} onClose={close} reason={reason} currentPlanId={currentPlanId} />
//
// Também loga UserEvent 'upsell_shown' (best-effort).

import { useState, useCallback } from 'react';
import { useCompany } from '@/hooks/useCompany';
import { base44 } from '@/api/base44Client';

export function useUpsellGate() {
  const { company } = useCompany();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  const trigger = useCallback((reasonText) => {
    setReason(reasonText || '');
    setOpen(true);
    try {
      base44.functions.invoke('trackEvent', {
        event_type: 'upsell_shown',
        metadata: { reason: reasonText || '' },
      });
    } catch { /* best effort */ }
  }, []);

  const close = useCallback(() => setOpen(false), []);

  return {
    open,
    reason,
    trigger,
    close,
    currentPlanId: company?.plan_id || null,
  };
}