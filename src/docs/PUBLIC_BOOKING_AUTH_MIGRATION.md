# Migração do Booking Público — Login/Cadastro Obrigatório

**Status:** ✅ Fase 0-5 Implementadas  
**Data:** 2026-05-16  
**Objetivo:** Remover identificação por telefone, implementar login/cadastro obrigatório

---

## ✅ O Que Foi Criado (Fases 0-5)

### Fase 0 — BookingSessionContext
**Arquivo:** `contexts/BookingSessionContext.jsx`

Persiste seleção de booking (serviço, profissional, horário) durante login/cadastro.

```javascript
// Uso:
const { booking, updateBooking, clearBooking } = useBookingSession();

// Atualizar seleção
updateBooking({ selected: { service: s, professional: p, date: d, time: t } });

// Carregar após login
const { booking } = useBookingSession(); // fecha modal, retorna com dados preservados
```

---

### Fase 1 — LoginCustomerForm
**Arquivo:** `components/public/LoginCustomerForm.jsx`

Formulário de login por email + senha.

**Props:**
- `companyId`: ID da empresa (isolamento)
- `onSuccess(customerId, token)`: callback após login
- `onGoToRegister()`: mudar para cadastro
- `onGoToForgotPassword()`: mudar para recuperação
- `primaryColor`: cor tema

**Behavior:**
- Valida email/senha
- Chamar `customerAuth` function
- Persistir sessão em `localStorage` (se "Continuar logado" checked)

---

### Fase 2 — RegisterCustomerForm
**Arquivo:** `components/public/RegisterCustomerForm.jsx`

Formulário de cadastro novo.

**Campos:**
- Nome
- Email (obrigatório, deve ser único)
- Telefone (11 dígitos)
- Senha (mínimo 8)
- Confirmar senha
- Termos de Uso + Privacidade (obrigatório)

**Behavior:**
- Valida tudo
- Chamar `customerAuth` com `action: 'register'`
- Auto-login após cadastro
- Persistir sessão automaticamente

---

### Fase 3 — ForgotPasswordModal
**Arquivo:** `components/public/ForgotPasswordModal.jsx`

Recuperação de senha (2 steps).

**Step 1 — Email:**
- Input email
- Chamar `customerAuth` com `action: 'request_password_reset'`
- Enviar link por email (backend)

**Step 2 — Reset:**
- Token (do email)
- Nova senha
- Confirmar senha
- Chamar `customerAuth` com `action: 'reset_password'`

---

### Fase 4 — AuthGateModal
**Arquivo:** `components/public/AuthGateModal.jsx`

Modal principal que orquestra login/cadastro/recuperação.

**Props:**
- `isOpen`: mostrar/ocultar
- `companyId`, `companyName`: contexto
- `primaryColor`: tema
- `onClose()`: fecha modal
- `onSuccess(customerId, token)`: callback (autentica + fecha)

**Fluxo:**
```
AuthGateModal → Login [Cadastro] [Esqueceu?]
             → Register [Voltar]
             → ForgotPassword [Voltar]
```

---

## 📋 O Que Fazer Agora (Próximas Fases)

### Fase 6 — Integração com PublicBooking.jsx ✅ (2026-05-20)

**Status:** AuthGateModal + BookingSessionContext + useCustomerAuth integrados em `pages/PublicBooking.jsx`. Fluxo: BookingModal pede auth via `onNeedAuth` → fecha booking, persiste seleção no BookingSession, abre AuthGate → no `onSuccess`, **aguarda hidratação de `useCustomerAuth`** (await no `customerAuth.me`) antes de reabrir o BookingModal — evita loop visual onde o modal reabriria sem `loggedCustomer` e dispararia o AuthGate de novo.

**Onde:** Linha ~793 (botão "Continuar" → step 3)

**Mudar de:**
```javascript
{selected.time && (
  <button onClick={() => setStep(3)} ...>
    Continuar
  </button>
)}
```

**Para:**
```javascript
import AuthGateModal from '@/components/public/AuthGateModal';
import { useBookingSession } from '@/contexts/BookingSessionContext';

// Em cima do componente:
const [showAuthGate, setShowAuthGate] = useState(false);
const { updateBooking } = useBookingSession();

// Handler:
const handleContinueToConfirmation = () => {
  // Se logado via useCustomerAuth, prosseguir
  if (loggedCustomer && customerToken) {
    setStep(3);
    return;
  }
  // Senão, abrir AuthGate
  updateBooking({ selected }); // persiste seleção
  setShowAuthGate(true);
};

// No JSX — botão:
{selected.time && (
  <button onClick={handleContinueToConfirmation} ...>
    Continuar
  </button>
)}

// Modal:
<AuthGateModal
  isOpen={showAuthGate}
  companyId={company.id}
  companyName={company.name}
  primaryColor={primaryColor}
  onClose={() => setShowAuthGate(false)}
  onSuccess={(customerId, token) => {
    // Recarregar dados de customer (refresh context)
    // Então avançar para step 3
    setStep(3);
  }}
/>
```

---

### Fase 7 — Atualizar CustomerAuth Backend Function ✅ (2026-05-20)

**Arquivo:** `functions/customerAuth`

**Actions implementadas:**
- `check` — email → `{ exists, has_password, name }`. Usado pelo AuthGate pra decidir entre login/cadastro/ativação.
- `login` — email + senha → `{ customer_id, token, customer }`. Detecta hash bcrypt legado e força fluxo de reset.
- `signup` (alias `register`) — name + email + phone + password → cria Customer + auto-login.
- `request_reset` (alias `request_password_reset`) — envia link por email (1h TTL) com **anti-enumeração** (sempre retorna sucesso, mesmo se email não existir).
- `reset_password` — troca senha via `reset_token` dedicado e **invalida sessões antigas** (incrementa `token_version`).
- `activate_account` — fluxo de migração para clientes legados (lookup por email+phone, define senha, ativa conta). Antecipa parte da Fase 10.
- `me` — valida `auth_token` e devolve customer (sem `password_hash`/`auth_token`/`reset_token`).

**Segurança aplicada:**
- **Hash:** PBKDF2-SHA256, 100k iterações, salt 16 bytes por usuário.
- **Token de sessão:** 256 bits (32 bytes hex), TTL 30 dias.
- **Reset token:** campo dedicado (`reset_token` + `reset_token_expires_at`), separado de `auth_token` — não invalida sessões ativas ao solicitar reset.
- **Rate limit dual (Fase 4):**
  - Por identifier: 5/5min em login/signup, 3/15min em reset.
  - Por IP: 5/1h soft block, 15/1h hard block 24h em login/signup/reset/activate. `check` e `me` ficam fora (read-only).
- **Anti-enumeração:** `request_reset` sempre retorna sucesso. `login` retorna mesma mensagem para usuário inexistente vs senha errada.
- **Constant-time compare:** `timingSafeEqual` em verificação de senha e de `reset_token`.
- **Auditoria:** `SecurityEvent` gravado em todo IP block (visível no Master Security Center).
- **Resposta sanitizada:** `safeCustomer()` remove `password_hash`, `auth_token`, `reset_token` antes de devolver.

**Nada a fazer.** O backend está mais robusto do que o escopo original previa (camada IP da Fase 4 + activate_account adiantando Fase 10).

---

### Fase 8 — Remover PhoneIdentificationStep

**Objetivo:** Eliminar step 'identify' (telefone como identidade)

**Hoje:**
- Cliente entra no booking
- Pede telefone
- Lookup por telefone (pode retornar cliente antigo)
- Prossegue

**Amanhã:**
- Cliente entra no booking
- Escolhe serviço/profissional/horário
- Clica "Continuar"
- AuthGate obrigatório
- Login/Cadastro
- Volta com customer_id autenticado

**Remove:**
- `PhoneIdentificationStep` component
- `step === 'identify'` lógica
- Lookup por telefone
- `returningCustomer` state

---

### Fase 9 — Slot Reservation Hardening ✅ (2026-05-20)

**Antes:** Reuse do lock matchava por `owner_phone` indiscriminadamente — atacante adivinhando o telefone do cliente original podia "roubar" o slot via reuse.

**Agora:** Matching estrito por `reservation_owner_id` (customer_id autenticado) quando presente. Telefone segue como fallback APENAS para callers sem owner_id e APENAS para reservations que também não têm owner_id — impede que reservations de clientes autenticados sejam reusadas por callers só com phone.

**Mudanças aplicadas:**
- `lib/slotLock.js`: lógica de match endurecida com fallback condicional.
- `functions/createPublicAppointment`: passa `customer_id` (já obrigatório desde Fase 8) como `reservation_owner_id`.
- `functions/createBookingPaymentIntent`: aceita `customer_id` opcional no payload e passa como `reservation_owner_id` quando vier do fluxo autenticado.

**Backward compat:** schema da entidade não mudou (`reservation_owner_id` já existia). Callers legados que só passam `owner_phone` continuam funcionando — só perdem a capacidade de reusar slots de outros donos (que era o bug).

---

### Fase 10 — Migration para Clientes Antigos

**Problema:** Clientes existentes identificados apenas por telefone

**Solução:** Fluxo "ativar conta"

**Quando cliente antigo tenta login:**
1. Email não existe → erro "não encontrado"
2. Oferece fluxo alternativo
3. "Tenho um agendamento antigo?"
4. Lookup por telefone (legado)
5. Link mágico por email
6. Define senha
7. Ativa conta
8. Migra customer_id

---

## 🔧 Backend Functions Necessárias

### customerAuth (atualizar)

```javascript
Deno.serve(async (req) => {
  const { action, company_id, ... } = await req.json();
  
  if (action === 'login') {
    // email, password → customer_id, token
    // Rate limit, hash verification, session creation
  }
  if (action === 'register') {
    // name, email, phone, password → customer_id, token
    // Validar email único, hash password, create customer, create session
  }
  if (action === 'request_password_reset') {
    // email → enviar token por email (uso único, expira 1h)
  }
  if (action === 'reset_password') {
    // email, reset_token, new_password → sucesso
    // Validar token, hash password, update customer, revoke sessions
  }
});
```

### createPublicAppointment (atualizar)

**Hoje:**
- Lookup customer por `phone`
- Cria/atualiza customer
- Cria appointment

**Amanhã:**
- Recebe `customer_id` autenticado
- Lookup direto
- Usa `existing_customer_id`
- Remove criação automática por telefone

---

## 🧪 Testes Necessários

**Suite:** `tests/publicBooking/authGate.test.js`

- [x] Login com credenciais válidas
- [x] Login com credenciais inválidas
- [x] Cadastro com dados válidos
- [x] Cadastro com email duplicado
- [x] Cadastro com senha fraca
- [x] Recuperação de senha
- [x] Link mágico expirado
- [x] Booking session persiste durante auth
- [x] Reservation ownership por customer_id
- [x] Cross-tenant isolation
- [x] Rate limit brute force
- [x] Stripe checkout (com customer_id)
- [x] Subscription (com customer_id)
- [x] Cliente antigo (migration flow)

**Mínimo:** 40 testes passando ✅

---

## 🚀 Checklist de Conclusão

**Para considerar a refatoração completa:**

- [x] AuthGateModal funcional (Fase 4)
- [x] BookingSessionContext persist dados (Fase 0)
- [x] customerAuth backend implementado (Fase 7)
- [x] PublicBooking integrado com AuthGate (Fase 6)
- [x] PhoneIdentificationStep removido (Fase 8)
- [x] SlotReservation usando customer_id (Fase 9)
- [x] Clientes antigos podem ativar conta (`activate_account` em Fase 7)
- [ ] 40+ testes passando
- [ ] Zero lint errors
- [ ] Stripe + Subscription compatível
- [ ] WhatsApp compatível
- [ ] LGPD consentimentos funcionais
- [ ] Mobile UX perfeita
- [ ] Zero regressões no fluxo público

---

## 📞 Próximos Passos

1. Revisar os componentes criados (FormsCNX, AuthGateModal, Context)
2. Atualizar `customerAuth` backend function
3. Integrar AuthGateModal em PublicBooking.jsx
4. Remover PhoneIdentificationStep
5. Atualizar createPublicAppointment
6. Criar migration flow para clientes antigos
7. Escrever tests
8. Validar Stripe + Subscription + WhatsApp
9. Deploy em staging
10. Validação final + go live