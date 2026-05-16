# Device Trust Policy — O Corte SaaS

> Versão: 1.0 | Criado: 2026-05

---

## 1. O que é Device Trust?

O sistema de Device Trust identifica e classifica dispositivos de forma não-invasiva,
usando sinais públicos do navegador para detectar comportamento suspeito sem comprometer
a privacidade dos usuários.

---

## 2. Sinais coletados

| Sinal | Descrição | Invasividade |
|-------|-----------|--------------|
| User-Agent normalizado | Browser/OS sem versão exata | 🟢 Baixa |
| Timezone | Fuso horário do dispositivo | 🟢 Baixa |
| Idioma | Idioma do navegador | 🟢 Baixa |
| Resolução (bucket) | Arredondada para ±400px | 🟢 Baixa |
| Plataforma | Win32, iPhone, Linux | 🟢 Baixa |
| CPU cores | Número de núcleos | 🟢 Baixa |
| Memória (bucket) | low/mid/high (não exato) | 🟢 Baixa |
| Touch support | Suporte a toque | 🟢 Baixa |

### NÃO coletamos:
- ❌ Canvas fingerprint
- ❌ Audio fingerprint
- ❌ WebRTC IPs internos
- ❌ Font enumeration
- ❌ Aceleração de hardware
- ❌ Dados de bateria

---

## 3. Níveis de confiança

| Nível | Critério | Risk Score |
|-------|----------|------------|
| **trusted** | ≥5 logins bem-sucedidos no device OU MFA validado | low |
| **known** | 2-4 logins bem-sucedidos | low |
| **suspicious** | 1 login ou inconsistências menores | medium |
| **unknown** | Primeiro acesso | medium |
| **compromised** | Risk score critical | critical |

---

## 4. Fluxo de detecção

```
Login request
  → generateDeviceTrustId()    # hash leve baseado nos sinais
  → comparar com session.device_id (se sessão ativa)
  → assessDeviceTrust()         # classifica trusted/known/suspicious/unknown
  → assessLoginRisk()           # compõe com IP, UA, concurrent sessions
  → detectImpossibleTravel()    # verifica geograficamente
  → evaluateSessionGuard()      # decide revogar?
  → getPolicyForRisk()          # define resposta (log/captcha/MFA/block)
```

---

## 5. Respostas por nível de risco

| Score | Ação automática |
|-------|-----------------|
| low | Log apenas |
| medium | Log + captcha (quando integrado) |
| high | Log + MFA obrigatório + alerta master |
| critical | Log + MFA + bloquear 30 min + revogar sessão + alerta urgente |

---

## 6. Retenção dos dados de sessão

| Dado | Retenção |
|------|----------|
| UserSession ativa | Até expiração (30 dias) |
| UserSession expirada | Revogada pelo job purgeExpiredSessions |
| SecurityEvent | 90 dias |
| SecurityRateLimit | 30 dias |
| Reset tokens | Limpos após uso ou 1h |

O job `purgeExpiredSessions` executa diariamente às 3h (UTC-3).

---

## 7. Impossível Travel

Usa mapeamento de blocos de IP para regiões (BR, NA, EU, APAC, AF, LATAM).

| Caso | Score | Ação |
|------|-------|------|
| Mesmo /24 | low | Nenhuma |
| Região diferente em < 10 min | critical | Revogar + SecurityEvent |
| Região diferente em < 60 min | high | MFA obrigatório |
| /8 diferente em < 5 min | high | Log + alerta |

---

## 8. Confirmação de ações destrutivas (DangerConfirmModal)

Ações que requerem digitação da palavra-chave + motivo opcional:

**Severity: critical (CONFIRMAR ou palavra customizada)**
- Excluir cliente
- Anonimizar cliente (LGPD)
- Exportar dados (LGPD)
- Cancelar assinatura
- Desconectar Stripe
- Excluir empresa

**Severity: high**
- Excluir agendamento
- Reverter comissão
- Remover membro da equipe
- Alterar permissões
- Excluir lançamento financeiro

---

## 9. Privacidade

O `device_trust_id` é:
- Gerado localmente no navegador (não enviado a terceiros)
- Baseado apenas em dados públicos de hardware/software
- Armazenado no `localStorage` (não em cookies)
- Nunca vinculado a dados pessoais diretamente
- Rotacionado quando o usuário limpa o localStorage