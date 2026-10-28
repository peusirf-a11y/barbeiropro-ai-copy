import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { LogOut, User } from 'lucide-react';

export default function DeleteAccountSection({ company }) {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    if (typeof logout === 'function') {
      await logout();
    } else {
      base44.auth.logout('/');
    }
  };

  const displayEmail = user?.email || company?.owner_email || '';
  const displayName = user?.full_name || user?.name || company?.name || 'Minha Conta';

  return (
    <div className="mt-6 sm:mt-8 rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-4 sm:p-6 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-white/70" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-white text-sm sm:text-base truncate">
              Conta & Sessão
            </h2>
            <p className="text-xs text-white/55 truncate mt-0.5">
              {displayEmail
                ? `Conectado como ${displayEmail}`
                : `${displayName} — encerre sua sessão neste dispositivo quando desejar.`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl bg-white/5 text-white/85 ring-1 ring-white/15 hover:bg-white/10 hover:text-white active:scale-[0.98] transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sair da conta
        </button>
      </div>
    </div>
  );
}