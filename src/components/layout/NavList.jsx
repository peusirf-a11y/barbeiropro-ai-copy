// Lista de navegação reutilizável (App + Demo).
// Destaca item ativo e suporta badge "AI" no item AI Growth.

import { Link, useLocation } from 'react-router-dom';

export default function NavList({ items }) {
  const location = useLocation();
  return (
    <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
      {items.map((item) => {
        const active = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`group relative flex items-center gap-3 px-3 py-3 lg:py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              active
                ? 'bg-[#2563EB] text-white shadow-[0_4px_12px_rgba(37,99,235,0.35)]'
                : 'text-gray-300 hover:bg-white/5 hover:text-white active:bg-white/10'
            }`}
          >
            <item.icon className={`w-[18px] h-[18px] flex-shrink-0 transition-transform ${active ? '' : 'group-hover:scale-110'}`} />
            <span>{item.label}</span>
            {item.badge && (
              <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-md tracking-wide ${active ? 'bg-white/20 text-white' : 'bg-brand-gradient text-white'}`}>
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}