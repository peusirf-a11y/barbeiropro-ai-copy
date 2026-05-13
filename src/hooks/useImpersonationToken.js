// useImpersonationToken — retorna o token de impersonação ativo (ou null).
//
// Uso nas páginas/hooks que precisam injetar o token nos payloads BFF:
//
//   const impToken = useImpersonationToken();
//   base44.functions.invoke('listAppointments', {
//     active_unit_id: ...,
//     ...(impToken && { impersonation_token: impToken }),
//   });

import { useImpersonationContext } from '@/contexts/ImpersonationContext';

export function useImpersonationToken() {
  const { isImpersonating, impersonationToken } = useImpersonationContext();
  return isImpersonating ? impersonationToken : null;
}

// Utilitário: monta o patch de impersonação para spread em payloads.
// Retorna {} quando não está impersonando, { impersonation_token: "..." } quando sim.
export function useImpersonationPatch() {
  const token = useImpersonationToken();
  return token ? { impersonation_token: token } : {};
}