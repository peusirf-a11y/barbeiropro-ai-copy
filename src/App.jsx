import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

// Pages
import LandingPage from './pages/LandingPage';
import Onboarding from './pages/Onboarding';
import MasterPanel from './pages/MasterPanel';
import PublicBooking from './pages/PublicBooking';

// Demo pages
import DemoDashboard from './pages/demo/DemoDashboard';
import DemoAgenda from './pages/demo/DemoAgenda';
import DemoClientes from './pages/demo/DemoClientes';
import DemoServicos from './pages/demo/DemoServicos';
import DemoProfissionais from './pages/demo/DemoProfissionais';
import DemoFinanceiro from './pages/demo/DemoFinanceiro';
import DemoRelatorios from './pages/demo/DemoRelatorios';
import DemoAIGrowth from './pages/demo/DemoAIGrowth';

// App pages
import AppDashboard from './pages/app/AppDashboard';
import AppAgenda from './pages/app/AppAgenda';
import AppClientes from './pages/app/AppClientes';
import AppServicos from './pages/app/AppServicos';
import AppProfissionais from './pages/app/AppProfissionais';
import AppFinanceiro from './pages/app/AppFinanceiro';
import AppRelatorios from './pages/app/AppRelatorios';
import AppAIGrowth from './pages/app/AppAIGrowth';
import AppEquipe from './pages/app/AppEquipe';
import AppConfiguracoes from './pages/app/AppConfiguracoes';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#F8F7F3]">
        <div className="w-8 h-8 border-4 border-[#1B3A4B]/20 border-t-[#1B3A4B] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/master" element={<MasterPanel />} />
      <Route path="/agendar/:slug" element={<PublicBooking />} />

      {/* Demo */}
      <Route path="/demo/dashboard" element={<DemoDashboard />} />
      <Route path="/demo/agenda" element={<DemoAgenda />} />
      <Route path="/demo/clientes" element={<DemoClientes />} />
      <Route path="/demo/servicos" element={<DemoServicos />} />
      <Route path="/demo/profissionais" element={<DemoProfissionais />} />
      <Route path="/demo/financeiro" element={<DemoFinanceiro />} />
      <Route path="/demo/relatorios" element={<DemoRelatorios />} />
      <Route path="/demo/ai-growth" element={<DemoAIGrowth />} />

      {/* Private App */}
      <Route path="/app/dashboard" element={<AppDashboard />} />
      <Route path="/app/agenda" element={<AppAgenda />} />
      <Route path="/app/clientes" element={<AppClientes />} />
      <Route path="/app/servicos" element={<AppServicos />} />
      <Route path="/app/profissionais" element={<AppProfissionais />} />
      <Route path="/app/financeiro" element={<AppFinanceiro />} />
      <Route path="/app/relatorios" element={<AppRelatorios />} />
      <Route path="/app/ai-growth" element={<AppAIGrowth />} />
      <Route path="/app/equipe" element={<AppEquipe />} />
      <Route path="/app/configuracoes" element={<AppConfiguracoes />} />

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;