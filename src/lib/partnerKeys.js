// Query keys do módulo Partners. Padroniza tenant-awareness e shape consistente.
// Uso:
//   useQuery({ queryKey: partnerKeys.detail(partnerId), ... })
//   useQuery({ queryKey: partnerKeys.list({ status: 'active' }), ... })

const ROOT = 'partners';

export const partnerKeys = {
  all: () => [ROOT],
  list: (filters = {}) => [ROOT, 'list', filters],
  detail: (id) => [ROOT, 'detail', id],
  me: () => [ROOT, 'me'],
};

export const referralKeys = {
  all: () => ['referrals'],
  byPartner: (partnerId, filters = {}) => ['referrals', 'byPartner', partnerId, filters],
  byCompany: (companyId) => ['referrals', 'byCompany', companyId],
  detail: (id) => ['referrals', 'detail', id],
};

export const commissionKeys = {
  all: () => ['commissions'],
  byPartner: (partnerId, filters = {}) => ['commissions', 'byPartner', partnerId, filters],
  byMaster: (filters = {}) => ['commissions', 'master', filters],
  summary: (partnerId) => ['commissions', 'summary', partnerId],
};

// Helpers diretos (alguns lugares preferem função vs objeto)
export const partnerKey = (id) => partnerKeys.detail(id);
export const referralKey = (id) => referralKeys.detail(id);
export const commissionKey = (partnerId, filters) => commissionKeys.byPartner(partnerId, filters);