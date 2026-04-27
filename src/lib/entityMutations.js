// Wrapper de mutações que respeita impersonação.
// Quando há impersonação ativa, redireciona para a backend function `impersonatedMutation`
// (que valida token, isola por company_id e registra AuditLog).
// Caso contrário, usa o SDK normalmente (fluxo do dono da empresa).
//
// Uso: import { entityCreate, entityUpdate, entityDelete } from '@/lib/entityMutations';
//      await entityCreate('Customer', { name: 'João', phone: '...' }, company_id);

import { base44 } from '@/api/base44Client';
import { getImpersonation } from '@/lib/impersonation';

async function viaImpersonation(entity, op, payload) {
  const imp = getImpersonation();
  if (!imp?.active || !imp.token) throw new Error('Sessão de impersonação inválida');
  const res = await base44.functions.invoke('impersonatedMutation', {
    token: imp.token,
    company_id: imp.company_id,
    entity,
    op,
    ...payload,
  });
  if (!res.data?.success) throw new Error(res.data?.error || `Falha em ${op} ${entity}`);
  return res.data.data;
}

export async function entityCreate(entity, data, company_id) {
  const imp = getImpersonation();
  if (imp?.active) return viaImpersonation(entity, 'create', { data });
  // Fluxo normal
  const payload = entity === 'Company' ? data : { ...data, company_id };
  return base44.entities[entity].create(payload);
}

export async function entityUpdate(entity, id, data) {
  const imp = getImpersonation();
  if (imp?.active) return viaImpersonation(entity, 'update', { id, data });
  return base44.entities[entity].update(id, data);
}

export async function entityDelete(entity, id) {
  const imp = getImpersonation();
  if (imp?.active) return viaImpersonation(entity, 'delete', { id });
  return base44.entities[entity].delete(id);
}