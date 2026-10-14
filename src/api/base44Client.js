// Retrocompatibilidade de imports O CORTE
// Re-exporta a camada de dados autônoma appClient sem nenhuma dependência do SDK proprietário.

import { appClient } from './client';

export const base44 = appClient;
export default appClient;
