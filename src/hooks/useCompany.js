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

  // Pick the company this user owns or the first one available
  const company = companies.find(c => c.owner_email === user?.email) || companies[0] || null;

  return { company, companyId: company?.id || null, isLoading };
}