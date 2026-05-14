// Tokens centrais de status de agendamento — fonte única da verdade.
// Usado em: Agenda (cards e colunas pro), Dashboard (lista de hoje), Relatórios.
//
// Padrão visual obrigatório:
//   🟩 confirmado     → Verde
//   🟨 agendado       → Amarelo (pendente)
//   🟥 cancelado      → Vermelho
//   ⬜ concluido      → Cinza (bloqueado)
//   ⬜ faltou         → Cinza (bloqueado)
//   🟨 em_atendimento → Amarelo (em curso)
//   🔲 sem customer_id → borda tracejada (cliente sem preferência/novo)

export const STATUS_TOKENS = {
  agendado: {
    label: 'Agendado',
    // Pill (badge) — usado em listas/dashboard
    pill: 'bg-amber-50 text-amber-700 border-amber-200',
    // Card grande — usado nas colunas da agenda pro
    cardBg: 'bg-amber-50',
    cardBorder: 'border-amber-300',
    cardText: 'text-amber-800',
    // Faixa lateral — usado no card compacto da agenda
    leftBar: 'border-l-amber-400 bg-amber-50',
    accent: '#F59E0B',
  },
  confirmado: {
    label: 'Confirmado',
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    cardBg: 'bg-emerald-50',
    cardBorder: 'border-emerald-300',
    cardText: 'text-emerald-800',
    leftBar: 'border-l-emerald-500 bg-emerald-50',
    accent: '#10B981',
  },
  em_atendimento: {
    label: 'Em atendimento',
    pill: 'bg-amber-100 text-amber-800 border-amber-300',
    cardBg: 'bg-amber-100',
    cardBorder: 'border-amber-400',
    cardText: 'text-amber-900',
    leftBar: 'border-l-amber-500 bg-amber-100',
    accent: '#F59E0B',
  },
  concluido: {
    label: 'Concluído',
    pill: 'bg-gray-100 text-gray-600 border-gray-200',
    cardBg: 'bg-gray-100',
    cardBorder: 'border-gray-300',
    cardText: 'text-gray-600',
    leftBar: 'border-l-gray-400 bg-gray-100',
    accent: '#6B7280',
  },
  cancelado: {
    label: 'Cancelado',
    pill: 'bg-red-50 text-red-700 border-red-200',
    cardBg: 'bg-red-50',
    cardBorder: 'border-red-300',
    cardText: 'text-red-700',
    leftBar: 'border-l-red-500 bg-red-50',
    accent: '#EF4444',
  },
  faltou: {
    label: 'Faltou',
    pill: 'bg-gray-100 text-gray-600 border-gray-200',
    cardBg: 'bg-gray-100',
    cardBorder: 'border-gray-300',
    cardText: 'text-gray-600',
    leftBar: 'border-l-gray-400 bg-gray-100',
    accent: '#6B7280',
  },
};

const FALLBACK = STATUS_TOKENS.agendado;

export function getStatusToken(status) {
  return STATUS_TOKENS[status] || FALLBACK;
}

// Helper: cliente "sem preferência de profissional" → borda tracejada na agenda.
// Tracejado = não escolheu um profissional específico (flexível, pode trocar de barbeiro).
// Sólido = escolheu um profissional específico ao agendar (vinculado, não troca de barbeiro).
//
// Prioridade de detecção (do mais explícito ao mais implícito):
// 1. is_flexible_assignment = true  → sem preferência (campo explícito)
// 2. is_flexible_assignment = false → com preferência (campo explícito)
// 3. Walk-in sem customer_id        → sem preferência
// 4. Online com "Qualquer disponível" no nome → sem preferência (legado)
export function isClientWithoutPreference(appt) {
  // Campo explícito tem prioridade máxima
  if (appt?.is_flexible_assignment === true) return true;
  if (appt?.is_flexible_assignment === false) return false;
  // Walk-in sem cliente vinculado
  if (!appt?.customer_id) return true;
  // Agendamento online onde o cliente escolheu "Qualquer disponível" (legado)
  if (appt?.source === 'online' && appt?.professional_name === 'Qualquer disponível') return true;
  return false;
}