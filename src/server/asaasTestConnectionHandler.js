// src/server/asaasTestConnectionHandler.js
// Rota de Proxy Serverless para teste de conexão com o Asaas com diagnóstico transparente e ambiente dinâmico.
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

      // Se ainda não encontrou e houver empresas no banco
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

    // 1. Identificação Automática de Ambiente (Sandbox vs Produção):
    // Inspecione a chave recebida:
    // * Se contiver '$aact_prod_' -> use a URL base de produção: 'https://api.asaas.com/v3'
    // * Caso contrário -> use a URL base de sandbox: 'https://sandbox.asaas.com/v3'
    const isProd = cleanApiKey.includes('$aact_prod_');
    let baseUrl = isProd ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/v3';

    // 2. Chamada de Teste no Backend:
    // Limpe a chave com .trim().
    // Faça a requisição para `${baseUrl}/customers?limit=1` enviando o header obrigatório:
    const headers = {
      'access_token': cleanApiKey,
      'User-Agent': 'OCorte-App',
      'Content-Type': 'application/json',
    };

    let res;
    try {
      res = await fetch(`${baseUrl}/customers?limit=1`, {
        method: 'GET',
        headers,
      });

      // No sandbox, caso sandbox.asaas.com/v3 sem /api redirecione para tela de login HTML,
      // utiliza a URL de API direta do sandbox (https://sandbox.asaas.com/api/v3)
      if (!isProd) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('text/html') || res.url.includes('/login')) {
          baseUrl = 'https://sandbox.asaas.com/api/v3';
          res = await fetch(`${baseUrl}/customers?limit=1`, {
            method: 'GET',
            headers,
          });
        }
      }
    } catch (netErr) {
      console.error('[test-connection] Falha de rede:', netErr);
      return {
        status: 400,
        body: {
          success: false,
          message: `Erro Asaas (Falha de rede): ${netErr.message || 'Host inacessível'}`,
        },
      };
    }

    // 3. Exibição Transparente do Erro Real:
    // Capture a resposta do Asaas: const data = await res.json().catch(() => null);
    const data = await res.json().catch(() => null);

    // SE res.ok (status 200):
    if (res.ok) {
      return {
        status: 200,
        body: {
          success: true,
          environment: isProd ? 'production' : 'sandbox',
          message: 'Conexão confirmada com sucesso no Asaas!',
        },
      };
    }

    // SE NÃO res.ok:
    // Retorne status 400 com a mensagem detalhada vinda do Asaas:
    // { success: false, message: `Erro Asaas (${res.status}): ${data?.errors?.[0]?.description || JSON.stringify(data) || res.statusText}` }
    const errorDescription =
      data?.errors?.[0]?.description ||
      (data?.errors && Array.isArray(data.errors) ? JSON.stringify(data.errors) : null) ||
      (data ? JSON.stringify(data) : null) ||
      res.statusText ||
      'Erro desconhecido';

    const detailedMessage = `Erro Asaas (${res.status}): ${errorDescription}`;

    return {
      status: 400,
      body: {
        success: false,
        environment: isProd ? 'production' : 'sandbox',
        message: detailedMessage,
      },
    };
  } catch (err) {
    console.error('[test-connection] Erro interno:', err);
    return {
      status: 400,
      body: {
        success: false,
        message: `Erro Asaas (500): ${err.message || 'Erro inesperado'}`,
      },
    };
  }
}
