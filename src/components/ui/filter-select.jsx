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
        'px-3 py-2.5 border border-[#E5E7EF] dark:border-white/10 rounded-xl text-sm bg-white dark:bg-[#0D1326] text-[#171827] dark:text-white [color-scheme:light] dark:[color-scheme:dark] backdrop-blur-sm hover:bg-[#F8FAFC] dark:hover:bg-white/[0.06] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] focus:ring-2 focus:ring-[#2563EB]/20 dark:focus:ring-[#60A5FA]/20 transition-colors',
        className
      )}
    >
      {children || (options && options.map(o => (
        <option key={String(o.value)} value={o.value}>{o.label}</option>
      )))}
    </MobileSelect>
  );
}