# VULN-015 Migration Guide — QueryKey Tenant Isolation

**Status:** ✅ 2 páginas principais migradas (`AppClientes`, `AppAgenda`)  
**Remaining:** Componentes e outras páginas com `useQuery` legados

---

## O Que Fazer

Substituir todos os `useQuery` com `queryKey` simples por `buildTenantQueryKey` para isolamento seguro por tenant.

### Antes (VULNERÁVEL):
```javascript
const { data } = useQuery({
  queryKey: ['customers', companyId],  // ← Simples, não-isolado
  queryFn: () => base44.entities.Customer.list(),
});

// Invalidate também vulnerável:
queryClient.invalidateQueries({ queryKey: ['customers'] });
```

### Depois (SEGURO):
```javascript
import { buildTenantQueryKey } from '@/lib/query/buildTenantQueryKey';

const { data } = useQuery({
  queryKey: buildTenantQueryKey({ entity: 'customers', companyId }),
  queryFn: () => base44.entities.Customer.list(),
});

// Invalidate seguro:
queryClient.invalidateQueries({ 
  queryKey: buildTenantQueryKey({ entity: 'customers', companyId }) 
});
```

---

## Checklist de Migração

- [x] `pages/app/AppClientes` — queryKeys: customers, appointments, subscriptions
- [x] `pages/app/AppAgenda` — queryKeys: appointments, professionals, services, customers, blocked-times, subscriptions, customer-plans
- [ ] `pages/app/AppFinanceiro` — queryKeys: financial, financial-entries, cash-register, commissions
- [ ] `pages/app/AppCaixa` — queryKeys: cash-register, financial-entries
- [ ] `pages/app/AppCRM` — queryKeys: customers, appointments, whatsapp-messages
- [ ] `pages/app/AppDashboard` — queryKeys: appointments, commissions, customers, financial, dashboard
- [ ] `components/clientes/*` — check all useQuery calls
- [ ] `components/agenda/*` — check all useQuery calls
- [ ] `components/dashboard/*` — check all useQuery calls

---

## Padrão de Migração

### 1. Import
```javascript
import { buildTenantQueryKey } from '@/lib/query/buildTenantQueryKey';
```

### 2. useQuery
```javascript
const { data: customersData } = useQuery({
  queryKey: buildTenantQueryKey({ 
    entity: 'customers', 
    companyId,
    filters: { activeUnitId, status: 'active' }  // opcional
  }),
  queryFn: async () => { ... },
});
```

### 3. Mutation Invalidate
```javascript
const createMutation = useMutation({
  mutationFn: (data) => { ... },
  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: buildTenantQueryKey({ entity: 'customers', companyId })
    });
  },
});
```

### 4. OnMutate (Optimistic Updates)
```javascript
onMutate: async (variables) => {
  const key = buildTenantQueryKey({ entity: 'customers', companyId });
  await queryClient.cancelQueries({ queryKey: key });
  const previous = queryClient.getQueriesData({ queryKey: key });
  queryClient.setQueriesData({ queryKey: key }, (old) => { ... });
  return { previous };
},
```

---

## Entity Names

Use esses nomes (de `TENANT_ISOLATED_ENTITIES` em `lib/query/buildTenantQueryKey.js`):

```
customers
appointments
financial_entries
team_members
professionals
services
cash_registers
commissions
subscriptions
reviews
whatsapp_messages
audit_logs
blocked_times
units
plans
customer_plans
```

---

## Risco se NÃO Migrar

- 🔴 **Cross-tenant cache leakage** durante impersonação
- 🔴 **Stale cache** após logout/login
- 🔴 **Dados sensíveis** de outro tenant podem ser exibidos

---

## Impacto

Após migração completa, cache React Query terá **zero risco de leakage** entre tenants. ✅