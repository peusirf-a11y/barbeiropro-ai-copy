// Seção de exclusão de conta nas Configurações.
// Duas operações distintas:
//   1) "Sair desta conta" — logout do Base44 (preserva todos os dados da barbearia).
//      Útil para o user atual remover o próprio acesso ao app.
//   2) "Excluir barbearia" — apaga Company + dados (apenas para o owner/admin).
//      Usa a função backend `deleteCompany` que já existe.
//
// UX: dois cards vermelhos separados, cada um com modal de confirmação por digitação.

import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, LogOut, Trash2, X, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function DeleteAccountSection({ company, isOwner }) {
  const [confirmType, setConfirmType] = useState(null); // 'logout' | 'company'
  const [confirmText, setConfirmText] = useState('');
  const { toast } = useToast();

  const deleteCompanyMutation = useMutation({
    mutationFn: () => base44.functions.invoke('deleteCompany', { company_id: company.id }),
    onSuccess: () => {
      toast({ title: 'Barbearia excluída', description: 'Você será desconectado.' });
      setTimeout(() => base44.auth.logout('/'), 1500);
    },
    onError: (err) => {
      toast({ title: 'Erro ao excluir', description: err?.message || 'Tente novamente.', variant: 'destructive' });
    },
  });

  const requiredText = confirmType === 'company' ? (company?.name || '') : 'SAIR';
  const matchesRequired = confirmText.trim().toUpperCase() === requiredText.toUpperCase();

  const handleConfirm = () => {
    if (!matchesRequired) return;
    if (confirmType === 'logout') {
      base44.auth.logout('/');
    } else if (confirmType === 'company') {
      deleteCompanyMutation.mutate();
    }
  };

  const closeModal = () => {
    if (deleteCompanyMutation.isPending) return;
    setConfirmType(null);
    setConfirmText('');
  };

  return (
    <>
      <div className="mt-8 bg-white rounded-2xl border border-red-200 p-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="font-bold text-red-700">Zona de risco</h2>
            <p className="text-xs text-gray-500 mt-0.5">Estas ações não podem ser desfeitas.</p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Sair desta conta */}
          <div className="flex items-start justify-between gap-3 p-4 rounded-xl border border-black/5 bg-gray-50/50 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="font-semibold text-sm text-[#111827] flex items-center gap-2">
                <LogOut className="w-4 h-4 text-gray-500" />
                Sair desta conta
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Desconecta seu acesso ao app. Todos os dados da barbearia continuam intactos.
              </p>
            </div>
            <button
              onClick={() => { setConfirmType('logout'); setConfirmText(''); }}
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all"
            >
              Sair
            </button>
          </div>

          {/* Excluir barbearia (apenas owner) */}
          {isOwner && (
            <div className="flex items-start justify-between gap-3 p-4 rounded-xl border border-red-200 bg-red-50/50 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="font-semibold text-sm text-red-700 flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  Excluir barbearia permanentemente
                </div>
                <p className="text-xs text-red-600/80 mt-1">
                  Apaga {company?.name || 'a barbearia'}, todos os agendamentos, clientes, profissionais e pagamentos. Esta ação é definitiva.
                </p>
              </div>
              <button
                onClick={() => { setConfirmType('company'); setConfirmText(''); }}
                className="text-xs font-semibold px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] transition-all"
              >
                Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de confirmação */}
      {confirmType && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
          onClick={closeModal}
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl animate-fade-in-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[#111827]">
                {confirmType === 'logout' ? 'Sair da conta' : 'Excluir barbearia'}
              </h3>
              <button onClick={closeModal} disabled={deleteCompanyMutation.isPending} className="p-1 -mr-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className={`rounded-xl p-3 mb-4 ${confirmType === 'company' ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
              <p className="text-sm leading-relaxed">
                {confirmType === 'logout' ? (
                  <>Você será desconectado e precisará fazer login novamente para acessar o app.</>
                ) : (
                  <>
                    <strong className="text-red-700">Atenção:</strong> esta ação apaga permanentemente sua barbearia e todos os dados associados (agendamentos, clientes, profissionais, pagamentos). <strong>Não há como reverter.</strong>
                  </>
                )}
              </p>
            </div>

            <label className="text-xs font-semibold text-gray-600 block mb-1.5">
              {confirmType === 'logout'
                ? <>Para confirmar, digite <strong className="text-[#111827]">SAIR</strong></>
                : <>Para confirmar, digite o nome da barbearia: <strong className="text-red-700">{company?.name}</strong></>}
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              autoFocus
              disabled={deleteCompanyMutation.isPending}
              className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 mb-4"
              placeholder={requiredText}
            />

            <div className="flex gap-2">
              <button
                onClick={closeModal}
                disabled={deleteCompanyMutation.isPending}
                className="flex-1 px-4 py-2.5 border border-black/10 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={!matchesRequired || deleteCompanyMutation.isPending}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                  confirmType === 'company' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-[#111827] text-white hover:bg-black'
                }`}
              >
                {deleteCompanyMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {confirmType === 'logout' ? 'Confirmar saída' : 'Excluir definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}