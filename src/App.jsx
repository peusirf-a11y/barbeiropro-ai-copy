import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ErrorBoundary from '@/components/ErrorBoundary';

// Guards
import PrivateRoute from '@/components/guards/PrivateRoute';
import SuperAdminRoute from '@/components/guards/SuperAdminRoute';
import OnboardingGuard from '@/components/guards/OnboardingGuard';
import TotpGate from '@/components/guards/TotpGate';

// Public pages
import LandingPage from './pages/LandingPage';
import PublicBooking from './pages/PublicBooking';
import Onboarding from './pages/Onboarding';
import MasterPanel from './pages/MasterPanel';
import Checkout from './pages/Checkout';
import CheckoutSuccess from './pages/CheckoutSuccess';

// Demo pages (public)
import DemoDashboard from './pages/demo/DemoDashboard';
import DemoAgenda from './pages/demo/DemoAgenda';
import DemoClientes from './pages/demo/DemoClientes';
import DemoServicos from './pages/demo/DemoServicos';
import DemoProfissionais from './pages/demo/DemoProfissionais';
import DemoFinanceiro from './pages/demo/DemoFinanceiro';
import DemoRelatorios from './pages/demo/DemoRelatorios';
import DemoAIGrowth from './pages/demo/DemoAIGrowth';

// Private app pages
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
import AppRetencao from './pages/app/AppRetencao';
import AppAssinatura from './pages/app/AppAssinatura';
import AppBloqueios from './pages/app/AppBloqueios';
import AppCaixa from './pages/app/AppCaixa';
import AppCombos from './pages/app/AppCombos';
import AppComissoes from './pages/app/AppComissoes';
import AppAvaliacoes from './pages/app/AppAvaliacoes';
import AssinaturaBloqueada from './pages/AssinaturaBloqueada';
import TermosDeUso from './pages/legal/TermosDeUso';
import PoliticaDePrivacidade from './pages/legal/PoliticaDePrivacidade';
import ConfirmAppointment from './pages/public/ConfirmAppointment';
import ReviewAppointment from './pages/public/ReviewAppointment';

function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Routes>
            {/* ── PUBLIC ROUTES ── */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/agendar/:slug" element={<PublicBooking />} />
            <Route path="/confirma/:token" element={<ConfirmAppointment />} />
            <Route path="/avaliar/:token" element={<ReviewAppointment />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/checkout/sucesso" element={<CheckoutSuccess />} />
            <Route path="/termos-de-uso" element={<TermosDeUso />} />
            <Route path="/politica-de-privacidade" element={<PoliticaDePrivacidade />} />

            {/* ── DEMO ROUTES (public, no login required) ── */}
            <Route path="/demo/dashboard" element={<DemoDashboard />} />
            <Route path="/demo/agenda" element={<DemoAgenda />} />
            <Route path="/demo/clientes" element={<DemoClientes />} />
            <Route path="/demo/servicos" element={<DemoServicos />} />
            <Route path="/demo/profissionais" element={<DemoProfissionais />} />
            <Route path="/demo/financeiro" element={<DemoFinanceiro />} />
            <Route path="/demo/relatorios" element={<DemoRelatorios />} />
            <Route path="/demo/ai-growth" element={<DemoAIGrowth />} />

            {/* ── ONBOARDING (authenticated, not yet completed) ── */}
            <Route path="/onboarding" element={
              <OnboardingGuard>
                <Onboarding />
              </OnboardingGuard>
            } />

            {/* ── MASTER PANEL (super admin only) ── */}
            <Route path="/master" element={
              <SuperAdminRoute>
                <TotpGate>
                  <MasterPanel />
                </TotpGate>
              </SuperAdminRoute>
            } />

            {/* ── PRIVATE APP ROUTES (authenticated users only) ── */}
            <Route path="/app/dashboard" element={<PrivateRoute><AppDashboard /></PrivateRoute>} />
            <Route path="/app/agenda" element={<PrivateRoute><AppAgenda /></PrivateRoute>} />
            <Route path="/app/clientes" element={<PrivateRoute><AppClientes /></PrivateRoute>} />
            <Route path="/app/servicos" element={<PrivateRoute><AppServicos /></PrivateRoute>} />
            <Route path="/app/profissionais" element={<PrivateRoute><AppProfissionais /></PrivateRoute>} />
            <Route path="/app/financeiro" element={<PrivateRoute><AppFinanceiro /></PrivateRoute>} />
            <Route path="/app/bloqueios" element={<PrivateRoute><AppBloqueios /></PrivateRoute>} />
            <Route path="/app/caixa" element={<PrivateRoute><AppCaixa /></PrivateRoute>} />
            <Route path="/app/combos" element={<PrivateRoute><AppCombos /></PrivateRoute>} />
            <Route path="/app/comissoes" element={<PrivateRoute><AppComissoes /></PrivateRoute>} />
            <Route path="/app/avaliacoes" element={<PrivateRoute><AppAvaliacoes /></PrivateRoute>} />
            <Route path="/app/relatorios" element={<PrivateRoute><AppRelatorios /></PrivateRoute>} />
            <Route path="/app/ai-growth" element={<PrivateRoute><AppAIGrowth /></PrivateRoute>} />
            <Route path="/app/retencao" element={<PrivateRoute><AppRetencao /></PrivateRoute>} />
            <Route path="/app/equipe" element={<PrivateRoute><AppEquipe /></PrivateRoute>} />
            <Route path="/app/configuracoes" element={<PrivateRoute><AppConfiguracoes /></PrivateRoute>} />
            <Route path="/app/configuracoes/assinatura" element={<PrivateRoute><AppAssinatura /></PrivateRoute>} />
            <Route path="/app/assinatura-bloqueada" element={<PrivateRoute><AssinaturaBloqueada /></PrivateRoute>} />

            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;