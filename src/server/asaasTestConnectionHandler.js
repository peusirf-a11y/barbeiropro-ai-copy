// src/server/asaasTestConnectionHandler.js
// Rota de Proxy Serverless para teste de conexão com o Asaas sem problemas de CORS.
import { supabase } from '../lib/supabaseClient.js';

function isMaskedOrEmpty(key) {
  if (!key || typeof key !== 'string') return true;
  const trimmed = key.trim();
  if (!trimmed) return true;
  if (/^[•*]+$/.test(trimmed)) return true;
  if (trimmed.includes('••••') || trimmed.includes('****')) return true;
  return false;
}

export async function handleTestConnection(body = {}) {
  try {
    let cleanApiKey = String(body.apiKey || body.asaas_api_key || '').trim();
    const companyId = body.companyId || body.company_id || null;

    // Se 'apiKey' vier como máscara ou vazia, busque a 'asaas_api_key' salva no Supabase para a companyId
    if (isMaskedOrEmpty(cleanApiKey)) {
      if (companyId && supabase) {
        try {
          const { data: comp, error: compErr } = await supabase
            .from('companies')
            .select('asaas_api_key')
            .eq('id', companyId)
            .maybeSingle();

          if (!compErr && comp?.asaas_api_key) {
            cleanApiKey = comp.asaas_api_key.trim();
          }
        } catch (dbErr) {
          console.warn('[test-connection] Erro ao buscar asaas_api_key da company no banco:', dbErr);
        }
      }

      // Se ainda não encontrou e houver apenas 1 company no banco
      if (isMaskedOrEmpty(cleanApiKey) && supabase) {
        try {
          const { data: firstComp } = await supabase
            .from('companies')
            .select('asaas_api_key')
            .not('asaas_api_key', 'is', null)
            .limit(1)
            .maybeSingle();
          if (firstComp?.asaas_api_key) {
            cleanApiKey = firstComp.asaas_api_key.trim();
          }
        } catch (_) {}
      }

      // Fallback para variável de ambiente se configurada
      if (isMaskedOrEmpty(cleanApiKey) && process.env.ASAAS_API_KEY) {
        cleanApiKey = process.env.ASAAS_API_KEY.trim();
      }
    }

    if (isMaskedOrEmpty(cleanApiKey)) {
      return {
        status: 400,
        body: {
          success: false,
          message: 'Nenhuma chave de API informada ou cadastrada para esta barbearia.',
        },
      };
    }

    // Identifica ambiente Sandbox ou Produção
    const isSandbox = cleanApiKey.includes('hmlg') || cleanApiKey.includes('sandbox');
    const baseUrl = isSandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3';

    // No backend (Node/Next.js), faça a chamada segura
    const balanceUrl = `${baseUrl}/finance/balance`;
    let response;
    try {
      response = await fetch(balanceUrl, {
        method: 'GET',
        headers: {
          'access_token': cleanApiKey,
          'Content-Type': 'application/json',
          'User-Agent': 'OCorte-App',
        },
      });
    } catch (netErr) {
      console.error('[test-connection] Falha de rede ao chamar Asaas:', netErr);
      return {
        status: 502,
        body: {
          success: false,
          message: `Falha de rede ao conectar com o Asaas: ${netErr.message || 'Host inacessível'}`,
        },
      };
    }

    // Se retornar status 200: sucesso
    if (response.status === 200) {
      let balanceInfo = '';
      try {
        const json = await response.json();
        if (json?.totalBalance !== undefined) {
          balanceInfo = ` Saldo atual: R$ ${Number(json.totalBalance).toFixed(2).replace('.', ',')}`;
        }
      } catch (_) {}

      return {
        status: 200,
        body: {
          success: true,
          message: `Conexão estabelecida com sucesso!${balanceInfo}`,
        },
      };
    }

    // Se retornar status 403 (ex: chave sem permissão de balance), testa /customers
    if (response.status === 403) {
      try {
        const custRes = await fetch(`${baseUrl}/customers?limit=1`, {
          method: 'GET',
          headers: {
            'access_token': cleanApiKey,
            'Content-Type': 'application/json',
            'User-Agent': 'OCorte-App',
          },
        });
        if (custRes.status === 200) {
          return {
            status: 200,
            body: {
              success: true,
              message: 'Conexão estabelecida com sucesso! (Chave validada via módulo de clientes)',
            },
          };
        }
      } catch (_) {}
    }

    // Se retornar 401: chave inválida ou expirada
    if (response.status === 401) {
      return {
        status: 401,
        body: {
          success: false,
          message: 'Chave de API inválida ou expirada no Asaas.',
        },
      };
    }

    // Outros status de erro: lê resposta JSON do Asaas
    let asaasErrorDescription = '';
    try {
      const errJson = await response.json();
      if (errJson?.errors && Array.isArray(errJson.errors) && errJson.errors[0]?.description) {
        asaasErrorDescription = errJson.errors[0].description;
      }
    } catch (_) {}

    return {
      status: response.status || 400,
      body: {
        success: false,
        message: asaasErrorDescription || `Falha na validação do Asaas (HTTP ${response.status}).`,
      },
    };
  } catch (err) {
    console.error('[test-connection] Erro interno:', err);
    return {
      status: 500,
      body: {
        success: false,
        message: err.message || 'Erro interno ao validar chave de API.',
      },
    };
  }
}
