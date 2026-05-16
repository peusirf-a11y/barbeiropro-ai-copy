import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock } from 'lucide-react';
import LoginCustomerForm from './LoginCustomerForm';
import RegisterCustomerForm from './RegisterCustomerForm';
import ForgotPasswordModal from './ForgotPasswordModal';
import ActivateAccountForm from './ActivateAccountForm';

/**
 * Modal de autenticação obrigatória para finalizar booking.
 *
 * Fluxo:
 *  - Não logado → mostra Login + link para Cadastro
 *  - Clica "Criar conta" → formulário de registro
 *  - Clica "Esqueceu a senha?" → recuperação
 *  - Após sucesso → fecha modal e callback
 *
 * Props:
 *  - isOpen: boolean
 *  - companyId: ID da empresa
 *  - companyName: nome da barbearia
 *  - primaryColor: cor do tema
 *  - onClose(): fecha sem autenticar
 *  - onSuccess(customerId, token): callback após auth
 */
export default function AuthGateModal({
  isOpen,
  companyId,
  companyName,
  primaryColor = '#2563EB',
  onClose,
  onSuccess,
}) {
  const [view, setView] = useState('login'); // 'login' | 'register' | 'forgot' | 'activate'

  // Reseta view ao abrir
  useEffect(() => {
    if (isOpen) {
      setView('login');
    }
  }, [isOpen]);

  // Listener para trocar para view de ativação
  useEffect(() => {
    const handler = () => setView('activate');
    document.addEventListener('switchToActivate', handler);
    return () => document.removeEventListener('switchToActivate', handler);
  }, []);

  const handleSuccess = (customerId, token) => {
    // Aguarda um pouco para animação, depois fecha
    setTimeout(() => {
      onSuccess(customerId, token);
      onClose();
    }, 300);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-6 flex items-center justify-between gap-4 border-b border-blue-200">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Lock className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-gray-600">Acesso seguro</div>
                    <div className="text-sm font-black text-gray-900 truncate">{companyName}</div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="flex-shrink-0 p-2 hover:bg-white/50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                {view === 'login' && (
                  <LoginCustomerForm
                    companyId={companyId}
                    onSuccess={handleSuccess}
                    onGoToRegister={() => setView('register')}
                    onGoToForgotPassword={() => setView('forgot')}
                    primaryColor={primaryColor}
                  />
                )}

                {view === 'register' && (
                  <RegisterCustomerForm
                    companyId={companyId}
                    onSuccess={handleSuccess}
                    onGoToLogin={() => setView('login')}
                    primaryColor={primaryColor}
                  />
                )}

                {view === 'forgot' && (
                  <ForgotPasswordModal
                    companyId={companyId}
                    onBack={() => setView('login')}
                    primaryColor={primaryColor}
                  />
                )}

                {view === 'activate' && (
                  <ActivateAccountForm
                    companyId={companyId}
                    onSuccess={handleSuccess}
                    onGoToLogin={() => setView('login')}
                    primaryColor={primaryColor}
                  />
                )}
              </div>

              {/* Footer — dica de segurança */}
              <div className="bg-blue-50 border-t border-blue-200 px-6 py-4 text-center">
                <p className="text-[11px] text-gray-500">
                  🔒 Seus dados estão protegidos com encriptação SSL
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}