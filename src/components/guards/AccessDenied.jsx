import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function AccessDenied({
  title = '403 · Acesso Restrito e Bloqueado',
  message = 'O seu perfil de utilizador não possui permissão (RBAC) para aceder a esta rota administrativa ou financeira.',
  fallbackPath = '/app/dashboard',
  fallbackLabel = 'Voltar para Área Permitida',
  roleName = '',
}) {
  const navigate = useNavigate();

  return (
    <div
      data-testid="rbac-forbidden-403"
      data-http-status="403"
      role="alert"
      className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-[#070D1E] text-slate-900 dark:text-white p-6"
    >
      <div className="max-w-md w-full rounded-2xl border border-red-200 dark:border-red-500/30 bg-white dark:bg-red-500/10 backdrop-blur-xl p-6 sm:p-8 text-center shadow-xl dark:shadow-[0_20px_60px_rgba(0,0,0,0.6)] space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-500/20 border border-red-200 dark:border-red-400/30 flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-500/20 border border-red-200 dark:border-red-400/30 text-[11px] font-bold text-red-700 dark:text-red-300 uppercase tracking-wider">
          <Lock className="w-3 h-3" /> HTTP 403 Forbidden · RBAC Policy
        </div>

        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          {title}
        </h1>

        <p className="text-xs sm:text-sm text-slate-600 dark:text-white/70 leading-relaxed">
          {message}
          {roleName ? (
            <span className="block mt-1.5 text-red-700 dark:text-red-300 font-semibold">
              Perfil atual: {roleName}
            </span>
          ) : null}
        </p>

        <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-xs font-bold text-slate-800 dark:text-white transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </button>
          <Link
            to={fallbackPath}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-bold text-white transition-colors inline-flex items-center justify-center shadow-lg shadow-blue-600/30"
          >
            {fallbackLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
