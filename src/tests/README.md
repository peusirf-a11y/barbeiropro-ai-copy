# Testes — Foundation Sprint F1

## Por que essa estrutura

A plataforma Base44 tem 2 restrições que moldam essa abordagem:
1. **Não dá acesso à toolchain CI** (sem `package.json` próprio, sem Vitest no deploy).
2. **Não permite local imports em `functions/`** — cada function é deploy isolado.

Por isso o smoke runner real (`functions/runFoundationTests.js`) tem todos os testes **inline** (helpers + casos colados no próprio arquivo). Os arquivos em `tests/unit/` e `tests/integration/` existem como **fonte legível** dos testes — espelho do que está inline, útil para review em IDE e versionamento.

## Como rodar

### Via dashboard (manual)
```
Dashboard → Functions → runFoundationTests → Test (payload vazio)
```
Retorna `{ summary: { passed, failed, total, duration_ms, success }, results: [...] }`.
Validado em 2026-05-11: **34/34 passed em 17ms**.

### Via SDK (programático)
```js
import { base44 } from '@/api/base44Client';
const res = await base44.functions.invoke('runFoundationTests', {});
console.table(res.data.results);
```

**Requer role `admin`** — non-admin recebe 403.

## Estrutura (espelho)

```
tests/
  helpers/
    mockBase44.js          ← stub do SDK (entities in-memory)
  unit/
    lib/
      dates.test.js
      money.test.js
      env.test.js
      errorCodes.test.js
  integration/
    mockBase44.test.js     ← valida o próprio mock
```

```
functions/runFoundationTests.js  ← runner real (tudo inline)
```

## Quando atualizar

Quando algum helper de `lib/` muda:
1. Atualiza `lib/<helper>.js` (fonte da verdade no frontend).
2. Atualiza `tests/unit/lib/<helper>.test.js` (espelho legível).
3. **Re-inline** as funções + testes em `functions/runFoundationTests.js`.
4. Roda o smoke runner via dashboard.

Sim, é duplicação. É o preço da restrição da plataforma. Mas é trabalho de copy-paste, não decisão arquitetural — leva 2min por helper.

## Padrão de teste

Cada arquivo exporta um objeto onde cada chave é um teste:

```js
export const myTests = {
  'descrição clara do que testa': () => {
    if (algoErrado) throw new Error('mensagem específica');
  },
  'teste async': async () => {
    const r = await something();
    if (!r) throw new Error('falhou');
  },
};
```

Convenções:
- Joga `Error` para falhar. Mensagem deve dizer **o que era esperado vs o que veio**.
- Cada teste é **independente** — cria seu próprio `createMockBase44()`.
- Async permitido — o runner aguarda.

## O que NÃO testar aqui

- UI/componentes React (sem DOM no Deno).
- Integração com Stripe real (usar Stripe Test Mode em smoke manual).
- E2E de browser (Playwright fica para depois).
- Performance / load.

## Cobertura atual (2026-05-11)

| Módulo | Testes | Status |
|---|---|---|
| `lib/dates` | 9 | ✅ |
| `lib/money` | 11 | ✅ |
| `lib/errorCodes` | 7 | ✅ |
| `mockBase44` | 7 | ✅ |
| **Total** | **34** | **34/34 pass** |

Próximas adições candidatas: `lib/env`, `lib/csvSafe`, `lib/scheduling` (conflict checks), smoke flows (booking público, RBAC cross-tenant).