// RootRedirect — rota "/".
//
// A Landing é 100% pública. NUNCA redireciona, nem para login nem para o painel.
// Mesmo usuários autenticados permanecem na Landing — eles vão para o painel
// apenas quando clicarem explicitamente em "Entrar" / "Acessar painel".
//
// Isso garante que / funcione como um site público de vendas para qualquer
// visitante (anônimo ou logado).

import LandingPage from '@/pages/LandingPage';

export default function RootRedirect() {
  return <LandingPage />;
}