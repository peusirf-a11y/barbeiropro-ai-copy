/**
 * DemoContext — Injetor de dados demo para as páginas reais do /app.
 *
 * Ao envolver uma página com <DemoProvider>, os hooks useCompany, useTeamRole
 * e as queries do React Query são interceptadas para retornar dados demo em
 * vez de chamar o backend real.
 *
 * As páginas reais (/app/*) NÃO precisam saber que estão em modo demo —
 * toda a mágica acontece aqui.
 */

import { createContext, useContext, useState } from 'react';
import {
  demoCompany,
  demoServices,
  demoProfessionals,
  demoCustomers,
  demoAppointments,
  demoFinancial,
  demoAIInsights,
  demoReviews,
  demoSubscriptions,
  demoTeamMembers,
  demoCommissions,
} from '@/lib/demoData';
import { useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';

// ─── Contexto ─────────────────────────────────────────────────────────────────
const DemoContext = createContext(null);

export function useDemoContext() {
  return useContext(DemoContext);
}

// ─── QueryClient isolado para a demo ──────────────────────────────────────────
// Evita contaminar o cache do app real com dados demo.
const demoQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: false,
    },
  },
});

// ─── Estado demo em memória (mutations temporárias) ────────────────────────────
let _demoAppointments = [...demoAppointments];
let _demoCustomers = [...demoCustomers];
let _demoFinancial = [...demoFinancial];

export function resetDemoState() {
  _demoAppointments = [...demoAppointments];
  _demoCustomers = [...demoCustomers];
  _demoFinancial = [...demoFinancial];
}

export function getDemoAppointments() { return _demoAppointments; }
export function getDemoCustomers() { return _demoCustomers; }
export function getDemoFinancial() { return _demoFinancial; }

// ─── Bloqueio de ações destrutivas ────────────────────────────────────────────
export function demoBlocker(actionName = 'Esta ação') {
  toast.info(`${actionName} está desativada no modo demonstração.`, { duration: 2500 });
}

// ─── DemoProvider ─────────────────────────────────────────────────────────────
export function DemoProvider({ children }) {
  const [sessionId] = useState(() => Math.random().toString(36).slice(2));

  const value = {
    isDemo: true,
    sessionId,
    company: demoCompany,
    companyId: demoCompany.id,
    services: demoServices,
    professionals: demoProfessionals,
    customers: demoCustomers,
    appointments: demoAppointments,
    financial: demoFinancial,
    aiInsights: demoAIInsights,
    reviews: demoReviews,
    subscriptions: demoSubscriptions,
    teamMembers: demoTeamMembers,
    commissions: demoCommissions,
    block: demoBlocker,
  };

  return (
    <DemoContext.Provider value={value}>
      <QueryClientProvider client={demoQueryClient}>
        {children}
      </QueryClientProvider>
    </DemoContext.Provider>
  );
}