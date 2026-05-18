// Tokens centrais de status de agendamento — fonte única da verdade.
// Refatorado para tema DARK premium: cards/pills com glass + tint do tom,
// borders translúcidas e texto claro. Mantém a mesma API (cardBg, cardBorder,
// cardText, leftBar, pill, label, accent) para zero impacto em consumidores.

export const STATUS_TOKENS = {
  agendado: {
    label: 'Agendado',
    pill: 'bg-amber-400/15 text-amber-200 border-amber-400/30',
    cardBg: 'bg-amber-400/10',
    cardBorder: 'border-amber-400/35',
    cardText: 'text-amber-100',
    leftBar: 'border-l-amber-400 bg-amber-400/10',
    accent: '#FBBF24',
  },
  confirmado: {
    label: 'Confirmado',
    pill: 'bg-emerald-400/15 text-emerald-200 border-emerald-400/30',
    cardBg: 'bg-emerald-400/10',
    cardBorder: 'border-emerald-400/35',
    cardText: 'text-emerald-100',
    leftBar: 'border-l-emerald-400 bg-emerald-400/10',
    accent: '#34D399',
  },
  em_atendimento: {
    label: 'Em atendimento',
    pill: 'bg-amber-400/25 text-amber-100 border-amber-400/45',
    cardBg: 'bg-amber-400/20',
    cardBorder: 'border-amber-400/50',
    cardText: 'text-amber-50',
    leftBar: 'border-l-amber-300 bg-amber-400/20',
    accent: '#FBBF24',
  },
  concluido: {
    label: 'Concluído',
    pill: 'bg-white/8 text-white/60 border-white/15',
    cardBg: 'bg-white/[0.04]',
    cardBorder: 'border-white/15',
    cardText: 'text-white/65',
    leftBar: 'border-l-white/30 bg-white/[0.04]',
    accent: '#94A3B8',
  },
  cancelado: {
    label: 'Cancelado',
    pill: 'bg-rose-400/15 text-rose-200 border-rose-400/30',
    cardBg: 'bg-rose-400/10',
    cardBorder: 'border-rose-400/35',
    cardText: 'text-rose-100',
    leftBar: 'border-l-rose-400 bg-rose-400/10',
    accent: '#FB7185',
  },
  faltou: {
    label: 'Faltou',
    pill: 'bg-white/8 text-white/55 border-white/15',
    cardBg: 'bg-white/[0.04]',
    cardBorder: 'border-white/15',
    cardText: 'text-white/60',
    leftBar: 'border-l-white/30 bg-white/[0.04]',
    accent: '#94A3B8',
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
  // 1. Campo explícito tem prioridade máxima
  if (appt?.is_flexible_assignment === true) return true;
  if (appt?.is_flexible_assignment === false) return false;
  // 2. Legado: agendamento online onde o cliente escolheu "Qualquer disponível"
  if (appt?.source === 'online' && appt?.professional_name === 'Qualquer disponível') return true;
  // 3. Sem o campo explícito → assume fixo (não troca de barbeiro)
  return false;
}