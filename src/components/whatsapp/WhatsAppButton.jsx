// Botão ícone único para "Abrir WhatsApp com mensagem pronta".
// Reutiliza lib/whatsappCompose.js — não duplica templates.
//
// Uso típico (linha de cliente):
//   <WhatsAppButton phone={c.phone} message={msg} title="Enviar mensagem" />
//
// Variantes:
//   - "icon" (default): botão quadrado discreto, fica verde só no hover
//   - "inline": ícone + label curto, para uso dentro de modais
//
// UX:
//   - cinza no idle, verde-WhatsApp no hover/active
//   - toast amigável quando cliente não tem telefone (via window.alert
//     fallback se não houver toast no projeto)
//   - abre em nova aba (wa.me — universal: Web no desktop, app no mobile)
//   - stopPropagation: pode ficar dentro de rows clicáveis sem disparar o click do row

import { MessageCircle } from 'lucide-react';
import { openWhatsApp } from '@/lib/whatsappCompose';
import { useToast } from '@/components/ui/use-toast';

export default function WhatsAppButton({
  phone,
  message,
  title = 'Abrir WhatsApp',
  variant = 'icon',
  label = 'WhatsApp',
  className = '',
  disabled = false,
}) {
  const { toast } = useToast();
  const hasPhone = !!String(phone || '').replace(/\D/g, '');

  const handleClick = (e) => {
    e.stopPropagation?.();
    e.preventDefault?.();
    if (!hasPhone) {
      if (typeof toast === 'function') {
        toast({
          title: 'Cliente sem WhatsApp cadastrado',
          description: 'Adicione um número no cadastro do cliente para enviar mensagens.',
        });
      }
      return;
    }
    openWhatsApp(phone, String(message || ''));
  };

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={handleClick}
        title={title}
        disabled={disabled}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors active:scale-[0.97]
          ${hasPhone
            ? 'text-gray-600 border-black/10 bg-white hover:bg-[#25D366] hover:text-white hover:border-[#25D366]'
            : 'text-gray-300 border-black/5 bg-white cursor-not-allowed'}
          ${className}`}
        aria-label={title}
      >
        <MessageCircle className="w-3.5 h-3.5" />
        {label}
      </button>
    );
  }

  // variant === 'icon' (default)
  return (
    <button
      type="button"
      onClick={handleClick}
      title={hasPhone ? title : 'Cliente sem WhatsApp cadastrado'}
      disabled={disabled}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors active:scale-[0.94]
        ${hasPhone
          ? 'text-gray-400 hover:bg-[#25D366] hover:text-white'
          : 'text-gray-200 cursor-not-allowed'}
        ${className}`}
      aria-label={title}
    >
      <MessageCircle className="w-4 h-4" />
    </button>
  );
}