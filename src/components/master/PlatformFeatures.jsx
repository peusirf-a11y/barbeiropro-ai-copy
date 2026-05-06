// Lista de funcionalidades reais da plataforma O CORTE, agrupadas por categoria.
// Exibido no Master Dashboard para refletir o poder atual do produto.
import {
  Calendar, MoveHorizontal, UserPlus, Building2,
  CreditCard, Wallet, Sparkles,
  TrendingUp, Repeat2, Award, Layers, Scale,
  Zap, CalendarOff, Lock, Clock4, Shield,
} from 'lucide-react';

const groups = [
  {
    title: 'Agenda',
    icon: Calendar,
    color: 'text-[#2563EB] bg-[#EFF6FF] ring-[#DBEAFE]',
    items: [
      { icon: Calendar, label: 'Agendamento online' },
      { icon: MoveHorizontal, label: 'Drag-and-drop entre barbeiros' },
      { icon: UserPlus, label: 'Cadastro automático de clientes' },
      { icon: Building2, label: 'Multi-unidade por empresa' },
      { icon: CalendarOff, label: 'Bloqueios recorrentes (dias e horários)' },
      { icon: Lock, label: 'Link público com login (e-mail + senha)' },
    ],
  },
  {
    title: 'Pagamentos',
    icon: CreditCard,
    color: 'text-emerald-700 bg-emerald-50 ring-emerald-100',
    items: [
      { icon: CreditCard, label: 'Pagamento Pix e cartão (Stripe)' },
      { icon: Wallet, label: 'Planos de assinatura para clientes' },
      { icon: Sparkles, label: 'Sugestão inteligente de preços (IA)' },
      { icon: Clock4, label: 'Planos off-peak (janela restrita)' },
    ],
  },
  {
    title: 'Analytics',
    icon: TrendingUp,
    color: 'text-amber-700 bg-amber-50 ring-amber-100',
    items: [
      { icon: Clock4, label: 'Horários de pico mais agendados' },
      { icon: Repeat2, label: 'Retenção (retorno em até 60 dias)' },
      { icon: Award, label: 'Ranking de barbeiros (retenção e perda)' },
      { icon: Layers, label: 'Performance de upsell de serviços' },
      { icon: Scale, label: 'Comparativo: assinatura vs avulso' },
    ],
  },
  {
    title: 'Crescimento',
    icon: Zap,
    color: 'text-purple-700 bg-purple-50 ring-purple-100',
    items: [
      { icon: Zap, label: 'Preenchimento automático de horários vazios' },
      { icon: Shield, label: 'Painel Master (empresas, planos e acessos)' },
    ],
  },
];

export default function PlatformFeatures() {
  return (
    <div className="bg-white rounded-2xl border border-black/5 p-4 sm:p-6 shadow-[var(--shadow-sm)]">
      <div className="mb-5">
        <h2 className="font-bold text-[#111827] text-lg tracking-tight">Funcionalidades da plataforma</h2>
        <p className="text-xs text-[#6B7280] mt-0.5 font-medium">
          O que o O CORTE entrega hoje para barbearias modernas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {groups.map((g) => {
          const GIcon = g.icon;
          return (
            <div key={g.title} className="rounded-xl border border-black/5 bg-[#FAFBFC] p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ring-1 ${g.color}`}>
                  <GIcon className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-[#111827] tracking-tight">{g.title}</h3>
              </div>
              <ul className="space-y-2">
                {g.items.map((it) => {
                  const Icon = it.icon;
                  return (
                    <li key={it.label} className="flex items-start gap-2.5 text-[13px] text-[#374151] leading-snug">
                      <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[#6B7280]" />
                      <span>{it.label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}