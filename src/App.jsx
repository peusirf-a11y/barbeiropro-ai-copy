import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ThemeProvider } from '@/theme/ThemeProvider';
import CookieConsentProvider from '@/components/cookies/CookieConsentProvider';
import RootRedirect from '@/components/RootRedirect';
import { ActiveUnitProvider } from '@/hooks/useActiveUnit';
import { ImpersonationProvider } from '@/contexts/ImpersonationContext';
import { BookingSessionProvider } from '@/contexts/BookingSessionContext';

// Guards
import PrivateRoute from '@/components/guards/PrivateRoute';
import SuperAdminRoute from '@/components/guards/SuperAdminRoute';
import OnboardingGuard from '@/components/guards/OnboardingGuard';
import TotpGate from '@/components/guards/TotpGate';
import RoleRoute from '@/components/guards/RoleRoute';

// Public pages
import LandingPage from './pages/LandingPage';
import PublicBooking from './pages/PublicBooking';
import Onboarding from './pages/Onboarding';
import Checkout from './pages/Checkout';
import CheckoutSuccess from './pages/CheckoutSuccess';

// Master pages (super admin)
import MasterLayout from './components/master/MasterLayout';
import MasterDashboard from './pages/master/MasterDashboard';
import MasterBarbearias from './pages/master/MasterBarbearias';
import MasterCompanyDetail from './pages/master/MasterCompanyDetail';
import MasterFuncionalidades from './pages/master/MasterFuncionalidades';
import MasterAssinaturas from './pages/master/MasterAssinaturas';
import MasterFinanceiro from './pages/master/MasterFinanceiro';
import MasterUsuarios from './pages/master/MasterUsuarios';
import MasterConfiguracoes from './pages/master/MasterConfiguracoes';
import MasterAudit from './pages/master/MasterAudit';
import MasterLGPD from './pages/master/MasterLGPD';
import MasterCompliance from './pages/master/MasterCompliance';
import MasterSecurityCenter from './pages/master/MasterSecurityCenter';
import MasterObservability from './pages/master/MasterObservability';
import DemoDataManager from './pages/master/DemoDataManager';

// Demo pages (public)
import DemoDashboard from './pages/demo/DemoDashboard.jsx';
import DemoAgenda from './pages/demo/DemoAgenda.jsx';
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
import AppCRM from './pages/app/AppCRM';
import AppAssinatura from './pages/app/AppAssinatura';
import AppBloqueios from './pages/app/AppBloqueios';
import AppCaixa from './pages/app/AppCaixa.jsx';
import AppCaixaRelatorios from './pages/app/AppCaixaRelatorios.jsx';
import AppCaixaAuditoria from './pages/app/AppCaixaAuditoria.jsx';
import AppCombos from './pages/app/AppCombos';
import AppPlanos from './pages/app/AppPlanos';
import AppComissoes from './pages/app/AppComissoes';
import AppAvaliacoes from './pages/app/AppAvaliacoes';
import AppIndicacoes from './pages/app/AppIndicacoes';
import AppUnidades from './pages/app/AppUnidades.jsx';
import AppPagamentos from './pages/app/AppPagamentos.jsx';
import AppPrivacidade from './pages/app/AppPrivacidade.jsx';
import AppSeguranca from './pages/app/AppSeguranca.jsx';
import AssinaturaBloqueada from './pages/AssinaturaBloqueada';
import TermosDeUso from './pages/legal/TermosDeUso';
import PoliticaDePrivacidade from './pages/legal/PoliticaDePrivacidade';
import ConfirmAppointment from './pages/public/ConfirmAppointment';
import ReviewAppointment from './pages/public/ReviewAppointment';
import CustomerLoginPage from './pages/public/CustomerLoginPage.jsx';
import CustomerDashboard from './pages/public/CustomerDashboard.jsx';
import CustomerPlans from './pages/public/CustomerPlans.jsx';
import PlanInviteRedeem from './pages/public/PlanInviteRedeem.jsx';
import CustomerPlanInviteRedeem from './pages/public/CustomerPlanInviteRedeem.jsx';
import { Navigate } from 'react-router-dom';

function App() {
  return (
    <ErrorBoundary>
    <ThemeProvider>
    <CookieConsentProvider>
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
       <ImpersonationProvider>
       <BookingSessionProvider>
       <ActiveUnitProvider>
         <Router>
          <Routes>
            {/* ── PUBLIC ROUTES ── */}
            {/* "/" = login automático (app/APK abre direto no login).
                Landing pública continua acessível em /landing. */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/agendar/:slug" element={<PublicBooking />} />
            <Route path="/cliente/:slug/login" element={<CustomerLoginPage />} />
            <Route path="/cliente/:slug/planos/convite/:token" element={<CustomerPlanInviteRedeem />} />
            <Route path="/cliente/:slug/planos" element={<CustomerPlans />} />
            <Route path="/cliente/:slug" element={<CustomerDashboard />} />
            <Route path="/planos/convite/:token" element={<PlanInviteRedeem />} />
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

            {/* ── MASTER PANEL (super admin only) — sidebar + rotas aninhadas ── */}
            <Route path="/master" element={
              <SuperAdminRoute>
                <TotpGate>
                  <MasterLayout />
                </TotpGate>
              </SuperAdminRoute>
            }>
              <Route index element={<Navigate to="/master/dashboard" replace />} />
              <Route path="dashboard" element={<MasterDashboard />} />
              <Route path="barbearias" element={<MasterBarbearias />} />
              <Route path="barbearias/:id" element={<MasterCompanyDetail />} />
              <Route path="funcionalidades" element={<MasterFuncionalidades />} />
              <Route path="assinaturas" element={<MasterAssinaturas />} />
              <Route path="financeiro" element={<MasterFinanceiro />} />
              <Route path="usuarios" element={<MasterUsuarios />} />
              <Route path="configuracoes" element={<MasterConfiguracoes />} />
              <Route path="auditoria" element={<MasterAudit />} />
              <Route path="lgpd" element={<MasterLGPD />} />
              <Route path="compliance" element={<MasterCompliance />} />
              <Route path="security" element={<MasterSecurityCenter />} />
              <Route path="observability" element={<MasterObservability />} />
              <Route path="dados-demo" element={<DemoDataManager />} />
            </Route>

            {/* ── PRIVATE APP ROUTES (authenticated users only) ── */}
            <Route path="/app" element={<Navigate to="/landing" replace />} />
            <Route path="/app/dashboard" element={<PrivateRoute><AppDashboard /></PrivateRoute>} />
            <Route path="/app/agenda" element={<PrivateRoute><AppAgenda /></PrivateRoute>} />
            <Route path="/app/clientes" element={<PrivateRoute><AppClientes /></PrivateRoute>} />
            <Route path="/app/servicos" element={<PrivateRoute><AppServicos /></PrivateRoute>} />
            <Route path="/app/profissionais" element={<PrivateRoute><AppProfissionais /></PrivateRoute>} />
            <Route path="/app/financeiro" element={<PrivateRoute><RoleRoute roles={['admin','financeiro']}><AppFinanceiro /></RoleRoute></PrivateRoute>} />
            <Route path="/app/bloqueios" element={<PrivateRoute><RoleRoute roles={['admin','recepcao']}><AppBloqueios /></RoleRoute></PrivateRoute>} />
            <Route path="/app/caixa" element={<PrivateRoute><RoleRoute roles={['admin','financeiro']}><AppCaixa /></RoleRoute></PrivateRoute>} />
            <Route path="/app/caixa/relatorios" element={<PrivateRoute><RoleRoute roles={['admin','financeiro']}><AppCaixaRelatorios /></RoleRoute></PrivateRoute>} />
            <Route path="/app/caixa/auditoria" element={<PrivateRoute><RoleRoute roles={['admin','financeiro']}><AppCaixaAuditoria /></RoleRoute></PrivateRoute>} />
            <Route path="/app/combos" element={<PrivateRoute><RoleRoute roles={['admin','recepcao']}><AppCombos /></RoleRoute></PrivateRoute>} />
            <Route path="/app/planos" element={<PrivateRoute><RoleRoute roles={['admin','recepcao','financeiro']}><AppPlanos /></RoleRoute></PrivateRoute>} />
            <Route path="/app/comissoes" element={<PrivateRoute><RoleRoute roles={['admin','financeiro','barbeiro']}><AppComissoes /></RoleRoute></PrivateRoute>} />
            <Route path="/app/avaliacoes" element={<PrivateRoute><RoleRoute roles={['admin','recepcao']}><AppAvaliacoes /></RoleRoute></PrivateRoute>} />
            <Route path="/app/indicacoes" element={<PrivateRoute><RoleRoute roles={['admin']}><AppIndicacoes /></RoleRoute></PrivateRoute>} />
            <Route path="/app/relatorios" element={<PrivateRoute><RoleRoute roles={['admin','financeiro']}><AppRelatorios /></RoleRoute></PrivateRoute>} />
            <Route path="/app/ai-growth" element={<PrivateRoute><RoleRoute roles={['admin']}><AppAIGrowth /></RoleRoute></PrivateRoute>} />
            <Route path="/app/crm" element={<PrivateRoute><RoleRoute roles={['admin','recepcao']}><AppCRM /></RoleRoute></PrivateRoute>} />
            {/* Compat: rota antiga /app/retencao redireciona para a central unificada */}
            <Route path="/app/retencao" element={<Navigate to="/app/crm" replace />} />
            <Route path="/app/equipe" element={<PrivateRoute><RoleRoute roles={['admin']}><AppEquipe /></RoleRoute></PrivateRoute>} />
            <Route path="/app/configuracoes" element={<PrivateRoute><RoleRoute roles={['admin']}><AppConfiguracoes /></RoleRoute></PrivateRoute>} />
            <Route path="/app/configuracoes/unidades" element={<PrivateRoute><RoleRoute roles={['admin']}><AppUnidades /></RoleRoute></PrivateRoute>} />
            <Route path="/app/configuracoes/pagamentos" element={<PrivateRoute><RoleRoute roles={['admin']}><AppPagamentos /></RoleRoute></PrivateRoute>} />
            <Route path="/app/configuracoes/privacidade" element={<PrivateRoute><RoleRoute roles={['admin']}><AppPrivacidade /></RoleRoute></PrivateRoute>} />
            <Route path="/app/configuracoes/seguranca" element={<PrivateRoute><RoleRoute roles={['admin']}><AppSeguranca /></RoleRoute></PrivateRoute>} />
            <Route path="/app/configuracoes/assinatura" element={<PrivateRoute><RoleRoute roles={['admin']}><AppAssinatura /></RoleRoute></PrivateRoute>} />
            <Route path="/app/assinatura-bloqueada" element={<PrivateRoute><AssinaturaBloqueada /></PrivateRoute>} />

            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Router>
        <Toaster />
       </ActiveUnitProvider>
       </BookingSessionProvider>
       </ImpersonationProvider>
      </QueryClientProvider>
    </AuthProvider>
    </CookieConsentProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;