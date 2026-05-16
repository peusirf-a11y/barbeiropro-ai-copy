# CSP Enforcement — VULN-019

**Status:** ✅ ENFORCEMENT ATIVADO  
**Data:** 2026-05-16  
**Mode:** Enforcement (bloqueio ativo)

---

## O Que Mudou

### Antes (Report-Only)
```javascript
// main.jsx
initCSP({ reportOnly: true, reportUri: null })  // ← Apenas monitora
```

### Depois (Enforcement)
```javascript
// main.jsx
initCSP({ reportOnly: false, reportUri: '/api/cspReport' })  // ← Bloqueia + reporta
```

---

## Política CSP Ativa

```
default-src 'self';
script-src 'self' https://js.stripe.com https://maps.googleapis.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: https: blob:;
connect-src 'self' https://api.stripe.com https://*.base44.com wss://*.base44.com;
frame-src https://js.stripe.com https://hooks.stripe.com;
worker-src 'self' blob:;
object-src 'none';
base-uri 'self';
form-action 'self';
upgrade-insecure-requests;
```

---

## O Que Será Bloqueado

❌ Scripts inline (sem `<script type="module">`):
```javascript
<script>alert('injected')</script>  // bloqueado
```

❌ Styles inline:
```html
<div style="color: red;">Test</div>  <!-- bloqueado -->
```

❌ External scripts não-permitidos:
```html
<script src="https://evil.com/tracker.js"></script>  <!-- bloqueado -->
```

❌ Eval:
```javascript
eval('alert("xss")')  // bloqueado
```

---

## O Que Continua Funcionando

✅ React (SPA bundles autorizados)  
✅ Stripe Checkout (https://js.stripe.com autorizados)  
✅ Google Maps (https://maps.googleapis.com autorizado)  
✅ Google Fonts (https://fonts.gstatic.com autorizado)  
✅ Base44 API (https://*.base44.com autorizado)  
✅ WebSockets (wss://*.base44.com autorizado)  

---

## Monitoramento de Violações

Violações são reportadas para `/api/cspReport` (função existente):

```javascript
POST /api/cspReport
{
  "document_uri": "https://app.ocorte.com.br/app/agenda",
  "violated_directive": "script-src",
  "effective_directive": "script-src",
  "blocked_uri": "https://analytics.evil.com/tracker.js",
  "source_file": "https://app.ocorte.com.br/src/main.js",
  "line_number": 42
}
```

Armazenadas em `SecurityEvent` para análise.

---

## Se Houver Problema

1. **Recurso legítimo bloqueado?**  
   → Adicionar a `CSP_DIRECTIVES` em `lib/security/csp.js`  
   → Exemplo: novo CDN de analytics autorizado

2. **Muitas violações?**  
   → Reverter para Report-Only:  
   ```javascript
   initCSP({ reportOnly: true })
   ```
   → Investigar em /master/security

3. **Erro em production?**  
   → CSP apenas bloqueia no browser, não quebra servidor  
   → Usuário vê conteúdo sem o recurso bloqueado

---

## Timeline

- ✅ 2026-05-16: CSP Enforcement ativado
- ⏳ 2026-05-23: Análise de violations (1 semana)
- ⏳ 2026-05-30: Ajustes finais se necessário
- ✅ 2026-06-06: Documentação no SECURITY.md v3.1

---

## Referência

- [MDN CSP Docs](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [SECURITY.md — Seção 2](./SECURITY.md#2-content-security-policy-csp)
- [PENTEST_REMEDIATIONS_2026.md — VULN-019](./PENTEST_REMEDIATIONS_2026.md)