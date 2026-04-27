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
            className={`group flex items-center gap-3 px-3 py-3 lg:py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              active
                ? 'bg-[#2563EB]/10 text-[#2563EB]'
                : 'text-gray-600 hover:bg-[#F7F8FB] hover:text-[#0F172A] active:bg-gray-100'
            }`}
          >
            <item.icon className={`w-[18px] h-[18px] flex-shrink-0 transition-transform ${active ? '' : 'group-hover:scale-110'}`} />
            <span>{item.label}</span>
            {item.badge && (
              <span className="ml-auto text-[10px] bg-brand-gradient text-white font-bold px-1.5 py-0.5 rounded-md tracking-wide">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}