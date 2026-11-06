// src/lib/planPricing.js
// Lógica centralizada de preços de planos SaaS do ecossistema O CORTE.
// Modela o plano de Franquias e Redes (Plano Matriz / Exclusivo) e filiais adicionais.

export const PLAN_PRICING_CONFIG = {
  classico: {
    key: 'classico',
    name: 'Clássico',
    basePrice: 69.00,
    allowsMultiUnit: false,
    additionalBranchPrice: 0,
    description: 'Para barbeiros autônomos e 1 profissional.',
  },
  master: {
    key: 'master',
    name: 'Master',
    basePrice: 119.00,
    promoPrice: 79.00,
    allowsMultiUnit: false,
    additionalBranchPrice: 0,
    description: 'Para barbearias em crescimento com equipe e CRM inteligente.',
  },
  exclusivo: {
    key: 'exclusivo',
    name: 'Exclusivo (Matriz & Franquias)',
    basePrice: 249.00, // Valor base da unidade matriz
    allowsMultiUnit: true,
    additionalBranchPrice: 90.00, // R$ 90,00 por filial extra vinculada à matriz
    description: 'Para redes e franquias: R$ 249/mês (matriz) + R$ 90/mês por filial adicional ativa.',
  },
};

export const EXCLUSIVO_BASE_PRICE = 249.00;
export const ADDITIONAL_BRANCH_PRICE = 90.00;

/**
 * Normaliza o identificador/chave do plano a partir do nome ou slug.
 */
export function normalizePlanKey(planNameOrSlug = '') {
  const n = String(planNameOrSlug || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (n.includes('exclusiv') || n.includes('matriz') || n.includes('franquia') || n.includes('enterprise')) {
    return 'exclusivo';
  }
  if (n.includes('classic') || n.includes('starter') || n.includes('basico')) {
    return 'classico';
  }
  return 'master';
}

/**
 * Calcula o valor total da assinatura somando a taxa base da matriz com as filiais adicionais ativas.
 *
 * @param {Object} params
 * @param {string} [params.planName] - Nome ou chave do plano (ex: 'Exclusivo', 'Plano Matriz', 'Master')
 * @param {number} [params.basePrice] - Preço base opcional cadastrado no banco
 * @param {number} [params.activeUnitsCount=1] - Quantidade total de unidades ativas (1 matriz + X filiais)
 * @param {number} [params.extraBranchesCount] - Se informado diretamente, quantidade de filiais além da matriz
 * @returns {Object} Detalhamento completo do cálculo para exibição e faturamento
 */
export function calculateSubscriptionPrice({
  planName = '',
  basePrice,
  activeUnitsCount = 1,
  extraBranchesCount,
}) {
  const planKey = normalizePlanKey(planName);
  const isExclusivo = planKey === 'exclusivo';

  // Se for Exclusivo/Matriz, a taxa base da unidade matriz é R$ 249,00
  const effectiveBasePrice = isExclusivo
    ? (Number(basePrice) > 0 ? Number(basePrice) : EXCLUSIVO_BASE_PRICE)
    : (Number(basePrice) > 0 ? Number(basePrice) : (planKey === 'classico' ? 69.00 : 119.00));

  // Quantidade de filiais extras ativas (descontando a unidade matriz)
  const totalUnits = Math.max(1, Number(activeUnitsCount) || 1);
  const extraBranches = typeof extraBranchesCount === 'number'
    ? Math.max(0, extraBranchesCount)
    : Math.max(0, totalUnits - 1);

  // Cada filial extra vinculada à matriz acrescenta R$ 90,00/mês
  const branchFeePerUnit = isExclusivo ? ADDITIONAL_BRANCH_PRICE : 0;
  const extraBranchesCost = isExclusivo ? extraBranches * branchFeePerUnit : 0;
  const totalPrice = effectiveBasePrice + extraBranchesCost;

  return {
    planKey,
    isExclusivo,
    planDisplayName: isExclusivo ? 'Plano Matriz / Exclusivo' : (planName || 'Master'),
    basePrice: effectiveBasePrice,
    totalUnits,
    extraBranches,
    branchFeePerUnit,
    extraBranchesCost,
    totalPrice,
    formattedBasePrice: formatBRL(effectiveBasePrice),
    formattedExtraBranchesCost: formatBRL(extraBranchesCost),
    formattedTotalPrice: formatBRL(totalPrice),
    summaryText: isExclusivo
      ? extraBranches > 0
        ? `${formatBRL(effectiveBasePrice)} (Matriz) + ${extraBranches} filial(is) (${formatBRL(extraBranchesCost)}) = ${formatBRL(totalPrice)}/mês`
        : `${formatBRL(effectiveBasePrice)}/mês (Unidade Matriz)`
      : `${formatBRL(effectiveBasePrice)}/mês`,
  };
}

/**
 * Formata valor em Real Brasileiro (R$)
 */
export function formatBRL(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
