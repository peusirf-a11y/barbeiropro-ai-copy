# RETENTION_POLICY.md — Política de Retenção de Dados

> Versão: 1.0 | Data: 2026-05 | Base Legal: LGPD

---

## Tabela de Retenção

| Tipo de Dado | TTL | Ação | Base Legal |
|-------------|-----|------|-----------|
| UserSession | 30 dias | Delete | Execução do contrato (Art. 7, V) |
| Reset Token | 24 horas | Clear | Legítimo interesse (segurança) |
| Confirm Token | 3 dias | Clear | Execução do contrato |
| Review Token | 30 dias | Clear | Legítimo interesse |
| SecurityEvent (low/medium) | 90 dias | Delete | Legítimo interesse (Art. 7, IX) |
| SecurityEvent (high/critical) | 365 dias | Delete | Obrigação legal |
| AdminAuditLog crítico | Permanente | Retain | Obrigação legal de auditoria |
| AdminAuditLog info | 180 dias | Delete | Legítimo interesse |
| SecurityRateLimit | 30 dias | Delete | Legítimo interesse |
| CookieConsentLog | 2 anos | Retain | Prova de consentimento (Art. 8) |
| PrivacyAuditLog | 365 dias | Retain | Prova de conformidade (Art. 6) |
| WhatsAppMessage | 90 dias | Delete | Legítimo interesse |
| EmailLog | 90 dias | Delete | Legítimo interesse |

---

## Job de Purge

O job `purgeExpiredSessions` executa **diariamente às 3h UTC-3** e realiza:

1. Marcar como `is_active: false` UserSessions expiradas
2. Deletar SecurityRateLimit com `window_end` > 30 dias
3. Deletar SecurityEvents com mais de 90 dias (low/medium)
4. Limpar `reset_token` de Customers expirados

---

## Compliance Score

Calculado por `generateRetentionReport()` com base em:
- Quantas políticas estão configuradas e ativas
- Volume atual de registros vs threshold esperado
- Riscos identificados (volumes excessivos)

Score 0-100. Score < 80 gera alerta no Security Center.

---

## Direitos dos Titulares (LGPD Art. 18)

| Direito | Implementação |
|---------|--------------|
| Acesso | `exportCustomerData` → JSON completo |
| Retificação | Edição via painel ou API |
| Anonimização | `anonymizeCustomer` (irreversível) |
| Portabilidade | Export JSON via AppPrivacidade |
| Eliminação | Anonimização (dados fiscais mantidos) |
| Revogação de consentimento | `manageConsent { action: 'revoke' }` |

---

## Auditoria de Retenção

Toda execução do job de purge gera `AdminAuditLog`:
```json
{
  "action": "LGPD_ACTION",
  "actor": "system",
  "severity": "info",
  "metadata": {
    "job": "purgeExpiredSessions",
    "results": { "sessions_purged": 42, "security_events_purged": 150 }
  }
}
``