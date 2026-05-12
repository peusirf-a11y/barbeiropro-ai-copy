// Action sheet contextual disparado ao clicar em "Confirmado/Concluído/Cancelado/Faltou"
// dentro do EditAppointmentModal. Pergunta se deseja só alterar o status ou
// também enviar uma mensagem manual de WhatsApp com template pronto.
//
// Regras (importantes):
//  - NÃO altera status sozinho — devolve a escolha do usuário (apenas mudar / mudar + WA)
//    para o parent, que segue o fluxo existente (set form + salvar).
//  - O parent é quem chama mutate. Nunca o action sheet.
//  - Se não há telefone do cliente, oculta o botão de WhatsApp e mostra hint sutil.
//
// UX:
//  - Mobile: bottom-sheet (StandardModal já cuida)
//  - Desktop: card centralizado (mesmo modal)
//  - ESC + click fora fecham via StandardModal

import { MessageCircle, Check, X as XIcon } from 'lucide-react';
import StandardModal from '@/components/ui/standard-modal';

const COPY = {
  confirmado: {
    title: 'Confirmar agendamento',
    onlyLabel: 'Confirmar apenas',
    whatsappLabel: 'Confirmar + enviar WhatsApp',
  },
  concluido: {
    title: 'Concluir atendimento',
    onlyLabel: 'Marcar concluído apenas',
    whatsappLabel: 'Concluir + pedir avaliação',
  },
  cancelado: {
    title: 'Cancelar agendamento',
    onlyLabel: 'Cancelar apenas',
    whatsappLabel: 'Cancelar + avisar no WhatsApp',
  },
  faltou: {
    title: 'Marcar como falta',
    onlyLabel: 'Marcar falta apenas',
    whatsappLabel: 'Marcar falta + enviar WhatsApp',
  },
};

export default function StatusActionSheet({
  open,
  statusKey,            // 'confirmado' | 'concluido' | 'cancelado' | 'faltou'
  hasPhone,             // boolean
  onChooseOnly,         // () => void
  onChooseWithWhatsApp, // () => void
  onClose,              // () => void
}) {
  if (!open || !statusKey) return null;
  const copy = COPY[statusKey];
  if (!copy) return null;

  return (
    <StandardModal
      open={open}
      onClose={onClose}
      title={copy.title}
      size="sm"
      footer={null}
    >
      <div className="space-y-2.5 pb-1">
        <button
          type="button"
          onClick={onChooseOnly}
          aria-label={copy.onlyLabel}
          className="w-full flex items-center gap-3 min-h-[56px] px-4 rounded-xl border border-black/10 bg-white hover:bg-gray-50 active:bg-gray-100 text-left transition-colors"
        >
          <span className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            <Check className="w-4 h-4 text-gray-700" />
          </span>
          <span className="text-sm font-semibold text-[#111827]">{copy.onlyLabel}</span>
        </button>

        {hasPhone && (
          <button
            type="button"
            onClick={onChooseWithWhatsApp}
            aria-label={copy.whatsappLabel}
            className="w-full flex items-center gap-3 min-h-[56px] px-4 rounded-xl border border-[#25D366] bg-[#25D366] hover:bg-[#1fae54] active:bg-[#1a9c4a] text-left transition-colors text-white shadow-[0_4px_12px_rgba(37,211,102,0.25)]"
          >
            <span className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-4 h-4 text-white" />
            </span>
            <span className="text-sm font-semibold">{copy.whatsappLabel}</span>
          </button>
        )}

        {!hasPhone && (
          <div className="text-[12px] text-gray-500 bg-gray-50 border border-black/5 rounded-lg px-3 py-2">
            Cliente sem WhatsApp cadastrado — só é possível alterar o status.
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          aria-label="Cancelar"
          className="w-full flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors mt-1"
        >
          <XIcon className="w-4 h-4" />
          Cancelar
        </button>
      </div>
    </StandardModal>
  );
}