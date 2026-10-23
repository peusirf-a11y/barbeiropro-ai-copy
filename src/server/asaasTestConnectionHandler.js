// src/server/asaasTestConnectionHandler.js
// Rota de Proxy Serverless para teste de conexão com o Asaas (Produção e Sandbox).
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
    const action = String(body.action || 'test').toLowerCase();
    const companyId = body.companyId || body.company_id || null;

    // Ação 'status': verifica no servidor se a barbearia possui chave configurada SEM expor a chave no JSON
    if (action === 'status') {
      let hasKey = false;
      if (companyId && supabase) {
        try {
          const { data: comp } = await supabase
            .from('companies')
            .select('asaas_api_key')
            .eq('id', companyId)
            .maybeSingle();
          hasKey = Boolean(comp?.asaas_api_key && String(comp.asaas_api_key).trim().length > 0);
        } catch (_) {}
      }
      return {
        status: 200,
        body: {
          success: true,
          hasKey,
          maskedKey: hasKey ? '••••••••••••••••••••••••••••••••' : '',
        },
      };
    }

    // Ação 'save': grava a chave no banco pelo servidor sem trafegar a chave de volta
    if (action === 'save') {
      const rawNewKey = String(body.apiKey || '').trim();
      if (!companyId || !supabase) {
        return {
          status: 400,
          body: { success: false, message: 'ID da barbearia inválido para salvar a chave.' },
        };
      }
      if (!isMaskedOrEmpty(rawNewKey)) {
        const { error } = await supabase
          .from('companies')
          .update({ asaas_api_key: rawNewKey })
          .eq('id', companyId);
        if (error) {
          return {
            status: 400,
            body: { success: false, message: error.message || 'Erro ao gravar chave no banco.' },
          };
        }
      }
      return {
        status: 200,
        body: {
          success: true,
          hasKey: true,
          maskedKey: '••••••••••••••••••••••••••••••••',
          message: 'Chave de API salva com sucesso!',
        },
      };
    }

    let cleanApiKey = String(body.apiKey || '').trim();

    // Caso a chave esteja oculta por bolinhas ou vazia, consulte a tabela 'companies' do Supabase pelo companyId
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

      // Fallback para primeira empresa ativa caso companyId não tenha retornado
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

    const headers = {
      'access_token': cleanApiKey,
      'User-Agent': 'OCorte-App',
      'Content-Type': 'application/json',
    };

    const isExplicitSandbox = cleanApiKey.includes('hmlg') || cleanApiKey.includes('sandbox');
    const primaryUrl = isExplicitSandbox
      ? 'https://sandbox.asaas.com/api/v3/customers?limit=1'
      : 'https://api.asaas.com/v3/customers?limit=1';
    const secondaryUrl = isExplicitSandbox
      ? 'https://api.asaas.com/v3/customers?limit=1'
      : 'https://sandbox.asaas.com/api/v3/customers?limit=1';

    let res;
    let data = null;

    try {
      res = await fetch(primaryUrl, {
        method: 'GET',
        headers,
      });
      data = await res.json().catch(() => null);

      // Se não retornou 200 no ambiente primário, testa automaticamente o ambiente alternativo (Produção <-> Sandbox)
      if (!res.ok) {
        const retryRes = await fetch(secondaryUrl, {
          method: 'GET',
          headers,
        });
        if (retryRes.ok) {
          res = retryRes;
          data = await retryRes.json().catch(() => null);
        }
      }
    } catch (netErr) {
      console.error('[test-connection] Falha de rede ao consultar Asaas:', netErr);
      return {
        status: 400,
        body: {
          success: false,
          message: `Erro de conexão com o Asaas: ${netErr.message || 'Falha de rede'}`,
        },
      };
    }

    // 200 OK: { success: true, message: 'Conexão confirmada com sucesso no Asaas!' }
    if (res.ok) {
      return {
        status: 200,
        body: {
          success: true,
          message: 'Conexão confirmada com sucesso no Asaas!',
        },
      };
    }

    // Se o Asaas recusar: retorne status 400 com a mensagem
    const asaasReason = data?.errors?.[0]?.description;
    return {
      status: 400,
      body: {
        success: false,
        message: asaasReason
          ? `Chave recusada pelo Asaas (${res.status}): ${asaasReason}`
          : 'Chave recusada pelo Asaas.',
      },
    };
  } catch (err) {
    console.error('[test-connection] Erro interno:', err);
    return {
      status: 400,
      body: {
        success: false,
        message: err.message || 'Chave recusada pelo Asaas.',
      },
    };
  }
}
