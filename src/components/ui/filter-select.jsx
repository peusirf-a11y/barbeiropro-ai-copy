// FilterSelect — wrapper sobre o MobileSelect com o estilo padrão usado no
// header do Financeiro (filtro "Este mês"). Use em todos os filtros de página.
//
// API:
//   <FilterSelect value={v} onChange={setV} options={[{value:'a', label:'A'}, ...]} />
//   ou usando children <option>:
//   <FilterSelect value={v} onChange={setV}>
//     <option value="a">A</option>
//   </FilterSelect>

import MobileSelect from '@/components/ui/mobile-select';
import { cn } from '@/lib/utils';

export default function FilterSelect({
  value,
  onChange,
  options,
  children,
  placeholder,
  className = '',
  disabled = false,
  'aria-label': ariaLabel,
}) {
  return (
    <MobileSelect
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'px-3 py-2.5 border border-black/10 rounded-xl text-sm bg-white focus:outline-none shadow-[var(--shadow-xs)]',
        className
      )}
    >
      {children || (options && options.map(o => (
        <option key={String(o.value)} value={o.value}>{o.label}</option>
      )))}
    </MobileSelect>
  );
}