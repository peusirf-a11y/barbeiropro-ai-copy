// Indicador discreto de ORIGEM do agendamento.
// Renderizado nos cards da agenda (desktop + mobile).
//
// Mapeamento de Appointment.source → ícone + tooltip:
//   online        → Smartphone   (link público — cliente agendou sozinho)
//   manual        → MousePointer2 (criado internamente pela equipe)
//   interno       → MousePointer2 (alias legado de "manual")
//   whatsapp      → MessageCircle (futuro)
//   instagram     → Instagram     (futuro)
//   subscription  → Repeat        (futuro — assinatura recorrente)
//   api           → Code2         (futuro — integração externa)
//
// Visual: ícone 12px, opacity 0.6, sem fundo. Tooltip nativo via title.
// Mantém o card limpo e premium.

import { Smartphone, MousePointer2, MessageCircle, Instagram, Repeat, Code2 } from 'lucide-react';

const SOURCE_MAP = {
  online:       { Icon: Smartphone,    label: 'Agendamento online' },
  public:       { Icon: Smartphone,    label: 'Agendamento online' },
  manual:       { Icon: MousePointer2, label: 'Agendamento manual' },
  interno:      { Icon: MousePointer2, label: 'Agendamento manual' },
  whatsapp:     { Icon: MessageCircle, label: 'Recebido via WhatsApp' },
  instagram:    { Icon: Instagram,     label: 'Recebido via Instagram' },
  subscription: { Icon: Repeat,        label: 'Assinatura recorrente' },
  api:          { Icon: Code2,         label: 'Criado via API' },
};

export default function AppointmentSourceIcon({ source, className = 'w-3 h-3 opacity-60' }) {
  const cfg = SOURCE_MAP[source] || SOURCE_MAP.manual;
  const { Icon, label } = cfg;
  return (
    <span title={label} className="inline-flex items-center" aria-label={label}>
      <Icon className={className} />
    </span>
  );
}