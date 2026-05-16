# ENTERPRISE_SECURITY.md — O Corte SaaS

> Versão: 1.0 | Data: 2026-05 | Nível: Enterprise

---

## 1. Visão Geral da Arquitetura de Segurança

### Camadas de Defesa (Defense in Depth)

```
┌─────────────────────────────────────────────┐
│  CAMADA 1: Perímetro                         │
│  - CSP (Content Security Policy)            │
│  - Security Headers (HSTS, X-Frame, etc.)   │
│  - Rate Limiting persistente (banco)        │
│  - GeoIP + Network Trust Score              │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│  CAMADA 2: Autenticação                      │
│  - PBKDF2-SHA256 (100k iterações)           │
│  - Token 256-bit seguro                     │
│  - Constant-time comparison                 │
│  - Session rotation no login                │
│  - Device Trust ID (fingerprint leve)       │
│  - Impossible Travel Detection              │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│  CAMADA 3: Sessão                            │
│  - Device-bound sessions (UserSession)      │
│  - Risk Engine (assessLoginRisk)            │
│  - Session Guard (auto-revogação)           │
│  - Impersonation com TTL + countdown        │
│  - Session Activity Stream                  │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│  CAMADA 4: Dados e Multi-tenant             │
│  - company_id NUNCA do payload             │
│  - resolveTenantAccess em toda function     │
│  - sanitizeEntity (nunca expõe tokens)     │
│  - DLP Scanner (remove secrets de logs)    │
│  - sanitizeHtml + sanitizeText              │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│  CAMADA 5: Detecção e Resposta              │
│  - SecurityEvent (eventos de ataque)        │
│  - AdminAuditLog (ações críticas)          │
│  - Impossible Travel Detection             │
│  - Financial Anomaly Detection             │
│  - Bot Signals Detection                   │
│  - Honeypot (campos invisíveis)            │
│  - Webhook Guard (replay protection)       │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│  CAMADA 6: Compliance e LGPD               │
│  - Data Retention Policy                   │
│  - PrivacyAuditLog                         │
│  - CustomerConsent                         │
│  - LGPD Export + Anonymization             │
│  - Cookie Consent (LGPD Art. 7)           │
│  - purgeExpiredSessions (job diário)       │
└─────────────────────────────────────────────┘
```

---

## 2. Fluxo de Risco Completo

### Login Request

```
1. Recebe request → extrai IP, UA, device_id
2. resolveGeoIP(ip) → networkTrustScore, networkType
3. checkHoneypot(body) → isBot?
4. checkRateLimit(key) → permitido?
5. verifyPassword(timing-safe) → ok?
6. assessLoginRisk({ip, ua, device, sessions}) → score
7. detectImpossibleTravel({ip, lastIp, lastSeen}) → detected?
8. assessDeviceTrust({deviceId, sessions}) → level
9. getPolicyForRisk(score) → policy (captcha/MFA/block)
10. Se shouldRevoke → endSession() + SecurityEvent(critical)
11. Se shouldWarn → SecurityEvent(high) + alerta
12. Sucesso → rotateSession() + novo token
```

### Ação Destrutiva

```
1. DangerConfirmModal → usuário digita palavra-chave
2. Se critical → exige motivo escrito
3. Backend: resolveTenantAccess() → company real
4. sanitizeEntity() → remove tokens antes de retornar
5. AdminAuditLog.create({before, after, actor, ip})
6. SecurityEvent.create() se anomalia detectada
7. dlpScanner.sanitizeObject(metadata) antes de persistir
```

---

## 3. Eventos de Segurança (SecurityEvent)

| event_type | Severidade | Quando |
|------------|-----------|--------|
| brute_force_attempt | high | 5+ falhas de login em 5 min |
| rate_limit_exceeded | high | Limite de requests ultrapassado |
| cross_tenant_attempt | critical | Tentativa de acessar dados de outro tenant |
| invalid_token | medium | Token inválido ou expirado |
| impersonation_abuse | critical | Impersonação fora do TTL ou inválida |
| lgpd_export | info | Exportação de dados LGPD |
| lgpd_anonymization | warning | Anonimização de cliente |
| suspicious_payload | high | Payload com injeção detectada |
| privilege_escalation_attempt | critical | Tentativa de elevar privilégios |
| mass_export_attempt | high | Mais de 5 exportações em 24h |
| login_failure | low | Falha de login individual |
| password_reset_abuse | high | Abuso de reset de senha |
| webhook_replay_attempt | high | Nonce duplicado em webhook |
| impossible_travel | critical | Login em locais incompatíveis em < 10 min |
| bot_detected | high | Sinais de automação detectados |
| financial_anomaly | high | Anomalia financeira detectada |
| honeypot_triggered | high | Campo honeypot preenchido |

---

## 4. GeoIP e Network Trust

### Tipos de Rede e Trust Score

| Tipo | Score | Resposta |
|------|-------|----------|
| residential | 80 | Normal |
| mobile | 75 | Normal |
| datacenter | 30 | Captcha |
| vpn | 25 | Captcha + log |
| proxy | 15 | MFA obrigatório |
| tor | 5 | MFA + SecurityEvent |
| private | 70 | Normal (rede interna) |

### Detecção de VPN

Baseada em ISP name matching contra lista de provedores VPN conhecidos.
Complementada por ASN de datacenter.

---

## 5. Bot Detection

Sinais coletados (não invasivos):

| Sinal | Peso |
|-------|------|
| navigator.webdriver | 40 pts |
| __nightmare / _phantom | 40 pts |
| HeadlessChrome UA | 40 pts |
| Zero plugins | 15 pts |
| Zero outer dimensions | 15 pts |
| No languages | 20 pts |
| Chrome sem chrome object | 20 pts |
| Form fill < 800ms | (via checkFormFillTiming) |

**isBot** quando `botProbability >= 60`.

### Captcha Adaptativo

| botProbability | riskScore | Modo |
|---------------|-----------|------|
| 0-19 | low | none |
| 20-39 | medium | invisible |
| 40-69 | high | checkbox |
| 70+ | any | challenge |
| any | critical | challenge |

---

## 6. Webhook Security

Todos os webhooks devem:
1. Validar timestamp (tolerância ±5 min)
2. Verificar assinatura HMAC-SHA256
3. Validar nonce para anti-replay
4. Registrar `webhook_replay_attempt` em SecurityEvent quando replay detectado

```javascript
// Exemplo de uso:
const result = await validateWebhook({
  payload: rawBody,
  signature: req.headers.get('x-signature'),
  secret: WEBHOOK_SECRET,
  timestamp: req.headers.get('x-timestamp'),
  nonce: req.headers.get('x-nonce'),
  recentEvents,
});
```

---

## 7. Security Score Enterprise

### Categorias (total: 100 pts)

| Categoria | Peso | O que avalia |
|-----------|------|-------------|
| Autenticação | 20 | Falhas de login, brute force, tokens inválidos |
| MFA | 15 | Impersonações inválidas, admins configurados |
| Incidentes | 20 | Eventos críticos, cross-tenant, high severity |
| Sessões | 10 | Sessões críticas ativas, excesso por usuário |
| Exports LGPD | 10 | Volume de exportações e anonimizações |
| Risco Financeiro | 10 | financialRiskScore (anomalias detectadas) |
| Hardening | 15 | Features de segurança ativas, nº de admins |

### Badges

| Score | Badge | Cor |
|-------|-------|-----|
| 90-100 | Enterprise 🛡️ | Verde |
| 75-89 | Avançado 🔐 | Azul |
| 55-74 | Padrão ⚠️ | Âmbar |
| 30-54 | Básico 🔓 | Laranja |
| 0-29 | Crítico 🚨 | Vermelho |

---

## 8. DLP — Data Loss Prevention

### Padrões detectados automaticamente

- CPF (com e sem pontuação)
- Cartão de crédito (13-19 dígitos)
- Stripe Secret Key (sk_live_, sk_test_)
- JWT tokens
- Bearer tokens
- Hashes hex longos (tokens de sessão)
- Authorization headers
- AWS Access Keys
- Campos "password" em JSON
- Hashes PBKDF2

### Onde é aplicado

- `sanitizeObject()` antes de persistir em AdminAuditLog.metadata
- `sanitizeObject()` antes de persistir em SecurityEvent.details  
- `validateLGPDExport()` antes de retornar export ao frontend
- `safeLog()` em lugar de `console.error` em funções críticas

---

## 9. Anti-Enumeração

Todas as respostas sensíveis usam `SAFE_MESSAGES` de `constantTime.js`:

```javascript
// Login — nunca revela se email existe
"Credenciais inválidas"

// Reset — nunca revela se email existe  
"Se existir uma conta com este e-mail, enviaremos as instruções de redefinição."

// Booking — nunca revela dados de outros clientes
"Este horário não está disponível. Por favor, escolha outro."
```

**Timing equalizado** via `withMinDelay(fn, 200ms)` no login para evitar
timing oracle que revela se o email existe pelo tempo de resposta.

---

## 10. OWASP Top 10 Mapping

| OWASP | Mitigação implementada |
|-------|----------------------|
| A01 Broken Access Control | resolveTenantAccess(), company_id nunca do payload |
| A02 Cryptographic Failures | PBKDF2 100k iter, token 256-bit, HTTPS, HSTS |
| A03 Injection | sanitizeText(), sanitizeHtml(), ORM sem raw queries |
| A04 Insecure Design | Defense in depth, threat model documentado |
| A05 Security Misconfiguration | Security headers, CSP, strict mode |
| A06 Vulnerable Components | Dependências mínimas, sem npm no frontend crítico |
| A07 XSS | CSP, sanitizeHtml, Trusted Types |
| A08 Integrity Failures | HMAC em webhooks, constant-time comparison |
| A09 Logging & Monitoring | SecurityEvent, AdminAuditLog, MasterSecurityCenter |
| A10 SSRF | Sem fetch de URLs fornecidas pelo usuário no backend |

---

## 11. Incident Response

### Severidade Critical

1. Verificar SecurityEvent no `/master/security`
2. Identificar `company_id`, `actor_email`, `ip_address`
3. Se cross-tenant: revogar sessões do ator + AdminAuditLog
4. Se brute force: verificar SecurityRateLimit, estender bloqueio
5. Se token comprometido: `manageSessions { action: 'revoke_all' }`
6. Notificar dono da empresa por email
7. Documentar em AdminAuditLog com `severity: 'critical'`

### Impossible Travel

1. SecurityEvent com `event_type: 'impossible_travel'` gerado automaticamente
2. Session Guard avalia se deve revogar automaticamente
3. Se `shouldRevoke`: logout forçado + novo login exigido
4. Se apenas `shouldWarn`: alerta no painel + MFA obrigatório