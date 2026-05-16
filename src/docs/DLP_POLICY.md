# DLP_POLICY.md — Data Loss Prevention Policy

> Versão: 1.0 | Data: 2026-05

---

## O que é DLP?

Data Loss Prevention (DLP) previne que dados sensíveis vazem através de:
- Logs de debug/error
- Exports e relatórios
- SecurityEvent.metadata e AdminAuditLog.metadata
- Respostas de erro ao frontend
- Exportações LGPD

---

## Dados Classificados como Sensíveis

| Categoria | Exemplos | Nível |
|-----------|---------|-------|
| Autenticação | password_hash, auth_token, reset_token | CRÍTICO |
| Pagamento | sk_live_*, cartão de crédito, CVV | CRÍTICO |
| Identidade | CPF (com/sem pontuação) | ALTO |
| Tokens de sessão | JWT, Bearer tokens, hex 64+ chars | CRÍTICO |
| Chaves de API | AWS keys, API secrets | CRÍTICO |

---

## Onde o DLP é Aplicado

### Backend (Deno functions)

```javascript
import { sanitizeObject, safeLog } from '../lib/security/dlpScanner.js';

// Antes de persistir metadata
const safeMetadata = sanitizeObject(rawMetadata);
await sdk.entities.AdminAuditLog.create({ ..., metadata: safeMetadata });

// Em lugar de console.error direto
safeLog('[minhaFuncao]', errorData);
```

### Exports LGPD

```javascript
import { validateLGPDExport } from '../lib/security/dlpScanner.js';

const { clean, issues } = validateLGPDExport(exportData);
if (!clean) throw new Error(`Export bloqueado: ${issues.join(', ')}`);
```

---

## Campos Sempre Redactados

Os seguintes campos são automaticamente substituídos por `[REDACTED]` em `sanitizeObject()`:
- `password`, `password_hash`
- `auth_token`, `reset_token`
- `stripe_secret_key`, `api_key`, `secret`, `private_key`
- `token_version`, `pin`, `cvv`, `card_number`

---

## Resposta a Detecção DLP

1. Log sanitizado antes de persistir
2. Campo substituído por `[X REDACTED]`
3. `findings[]` retornado para diagnóstico interno
4. Se em export LGPD: bloqueio do export + SecurityEvent