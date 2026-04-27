// Aviso usado em ações perigosas que ficam bloqueadas durante impersonação.
import { ShieldAlert } from 'lucide-react';

export default function ImpersonationLockNotice({ message }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
      <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="text-sm">
        <div className="font-semibold text-amber-900">Ação bloqueada em modo impersonação</div>
        <div className="text-amber-800 mt-0.5">
          {message || 'Esta ação só pode ser executada pelo dono da empresa. Encerre a impersonação para continuar com sua conta de super admin.'}
        </div>
      </div>
    </div>
  );
}