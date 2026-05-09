// MobileSelect — Select que vira Bottom Sheet (Drawer) no mobile.
// API drop-in (compatível com <select> nativo):
//   <MobileSelect value={v} onChange={setV} placeholder="Escolha...">
//     <option value="a">A</option>
//     <option value="b">B</option>
//   </MobileSelect>
//
// • Mobile (<768px): abre Drawer estilo iOS bottom-sheet.
// • Desktop (>=768px): renderiza um <select> nativo estilizado (mesmo comportamento que o app já tem).
//
// Mantém compatibilidade com `name`, `disabled`, `className`, `aria-label`.

import { Children, useMemo, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

function extractOptions(children) {
  const opts = [];
  Children.forEach(children, (child) => {
    if (!child || typeof child !== 'object') return;
    if (child.type === 'option') {
      const label = typeof child.props.children === 'string'
        ? child.props.children
        : String(child.props.children ?? '');
      opts.push({
        // Fallback: se <option> não tem value explícito, usa o próprio label
        // (espelha comportamento do <select> nativo do HTML).
        value: child.props.value ?? label,
        label,
        disabled: !!child.props.disabled,
      });
    } else if (child.type === 'optgroup' && child.props.children) {
      Children.forEach(child.props.children, (sub) => {
        if (sub && sub.type === 'option') {
          const subLabel = typeof sub.props.children === 'string'
            ? sub.props.children
            : String(sub.props.children ?? '');
          opts.push({
            value: sub.props.value ?? subLabel,
            label: subLabel,
            disabled: !!sub.props.disabled,
            group: child.props.label,
          });
        }
      });
    }
  });
  return opts;
}

export default function MobileSelect({
  value,
  onChange,
  placeholder = 'Selecionar',
  children,
  className = '',
  disabled = false,
  name,
  'aria-label': ariaLabel,
  title,
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const options = useMemo(() => extractOptions(children), [children]);
  const current = options.find((o) => String(o.value) === String(value));

  // Desktop / fallback: <select> nativo
  if (!isMobile) {
    return (
      <select
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        name={name}
        aria-label={ariaLabel}
        className={cn(
          'w-full px-3 py-2 border border-black/10 rounded-xl text-sm bg-white',
          className
        )}
      >
        {children}
      </select>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-label={ariaLabel || title || placeholder}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-3 py-2 border border-black/10 rounded-xl text-sm bg-white text-left text-[#111827]',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        <span className={cn('truncate', current ? 'text-[#111827]' : 'text-gray-400')}>
          {current?.label || placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader>
            <DrawerTitle>{title || placeholder}</DrawerTitle>
          </DrawerHeader>
          <div
            className="overflow-y-auto pb-[env(safe-area-inset-bottom,16px)] px-2"
            style={{ overscrollBehavior: 'contain' }}
          >
            {options.map((opt) => {
              const selected = String(opt.value) === String(value);
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => {
                    onChange?.(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between gap-3 px-4 py-4 rounded-xl text-left text-[15px] transition-colors',
                    'active:bg-gray-100',
                    selected ? 'bg-blue-50 text-[#2563EB] font-semibold' : 'text-[#0F172A]',
                    opt.disabled && 'opacity-40 pointer-events-none'
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {selected && <Check className="w-5 h-5 flex-shrink-0" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}