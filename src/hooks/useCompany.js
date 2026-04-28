import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

export function useCompany() {
  const { user } = useAuth();

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['my-company', user?.email],
    queryFn: () => base44.entities.Company.list(),
    enabled: !!user,
  });

  // Fallback via TeamMember (barbeiro/recepção/financeiro não são owners)
  const { data: teamMember } = useQuery({
    queryKey: ['my-team-member', user?.email],
    queryFn: async () => {
      const tm = await base44.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
      return tm?.[0] || null;
    },
    enabled: !!user?.email,
    staleTime: 60_000,
  });

  // Prioridade: owner > team member > primeira disponível
  const ownerCompany = companies.find(c => c.owner_email === user?.email);
  const teamCompany = teamMember ? companies.find(c => c.id === teamMember.company_id) : null;
  const company = ownerCompany || teamCompany || companies[0] || null;

  return { company, companyId: company?.id || null, isLoading };
}