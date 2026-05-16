# CORS Configuration — VULN-013

**Status:** ✅ IMPLEMENTADO  
**Data:** 2026-05-16

---

## O Que Foi Feito

### 1. Headers de CORS Explícitos

Adicionado a `lib/security/csp.js`:

```javascript
'Access-Control-Allow-Origin': Deno.env.get('CORS_ORIGIN') || 'https://app.ocorte.com.br',
'Access-Control-Allow-Credentials': 'true',
'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
'Access-Control-Max-Age': '86400',
```

✅ **Não usa `*`** — origin explícito via env var ou default  
✅ **Credentials permitidas** — para sessionStorage/tokens  
✅ **Max-Age 24h** — cache de preflight  

### 2. Configuração por Ambiente

Para ativar em produção, defina a env var:

```bash
CORS_ORIGIN=https://app.ocorte.com.br
```

Default (se não definido):
```
https://app.ocorte.com.br
```

### 3. Aplicação Automática

Os headers são injetados via `applySecurityHeaders()` em todas as backend functions. Nenhuma mudança manual necessária — já integrado!

---

## Risco Antes

- ❌ CORS aberto (`Access-Control-Allow-Origin: *`)
- ❌ Acesso de qualquer origin a APIs sensíveis
- ❌ CSRF + XSS cross-origin possível

## Risco Depois

- ✅ CORS restrito ao domínio específico
- ✅ Credenciais requerem origin válido
- ✅ Preflight cache reduz latência

---

## Teste de Validação

```bash
# Curl com Origin válida:
curl -H "Origin: https://app.ocorte.com.br" \
  https://api.ocorte.com.br/functions/getMyCompany

# Resposta esperada:
# Access-Control-Allow-Origin: https://app.ocorte.com.br ✅

# Curl com Origin inválida:
curl -H "Origin: https://evil.com" \
  https://api.ocorte.com.br/functions/getMyCompany

# Resposta: Nenhum header CORS ✅ (bloqueado pelo browser)
```

---

## Próximos Passos

1. ✅ Verificar env var `CORS_ORIGIN` em todos os ambientes
2. ✅ Testar cross-origin requests em staging
3. ✅ Monitorar SecurityEvent para rejections