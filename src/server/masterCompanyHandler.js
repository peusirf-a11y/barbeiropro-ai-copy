// Handler Server-Side para Onboarding Assistido / Venda Manual no Painel Master
// Provisiona a barbearia em public.companies e gerencia o vínculo/convite no Supabase Auth Admin.

import { createClient } from '@supabase/supabase-js';

const RESERVED_SLUGS = new Set([
  'app',
  'api',
  'admin',
  'master',
  'checkout',
  'onboarding',
  'agendar',
  'demo',
  'login',
  'logout',
  'parceiros',
  'parceiro',
  'privacidade',
  'termos',
  'termos-de-uso',
  'politica-de-privacidade',
]);

export function sanitizeCompanySlug(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function generateReferralCode(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function handleMasterCreateCompany(payload = {}) {
  try {
    const rawName = String(payload.name || '').trim();
    const rawEmail = String(payload.owner_email || '').trim().toLowerCase();
    const rawOwnerName = String(payload.owner_name || '').trim();
    const rawPhone = String(payload.phone || payload.whatsapp || '').trim();
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const subscriptionStatus = String(payload.subscription_status || 'trial').trim().toLowerCase();
    const rawPlan = String(payload.plan || payload.plan_name || 'Starter').trim();
    const sendInvite = payload.send_invite !== false;

    if (!rawName || rawName.length < 2) {
      return {
        status: 400,
        body: {
          success: false,
          error: 'O nome da barbearia é obrigatório (mínimo de 2 caracteres).',
        },
      };
    }

    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return {
        status: 400,
        body: {
          success: false,
          error: 'Informe um e-mail válido para o proprietário/responsável.',
        },
      };
    }

    // 1. Geração e higienização do slug
    let baseSlug = sanitizeCompanySlug(payload.slug || rawName);
    if (!baseSlug || baseSlug.length < 3 || RESERVED_SLUGS.has(baseSlug)) {
      baseSlug = `${sanitizeCompanySlug(rawName) || 'barbearia'}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // 2. Mapeamento do ciclo de vida inicial da subscrição
    const now = new Date();
    const nowIso = now.toISOString();
    const trialEndsAt =
      subscriptionStatus === 'trial'
        ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : null;

    const companyStatus =
      subscriptionStatus === 'pending_payment' ? 'inactive' : 'active';

    const billingStatus =
      subscriptionStatus === 'manual_active'
        ? 'ACTIVE'
        : subscriptionStatus === 'pending_payment'
        ? 'PENDING'
        : 'TRIAL';

    const planSlug = rawPlan.toLowerCase();
    const planLabel =
      planSlug === 'pro'
        ? 'Pro'
        : planSlug === 'premium' || planSlug === 'enterprise'
        ? 'Premium'
        : 'Starter';

    const supabaseUrl = (
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      'https://ijitvgzcbvguacsveccy.supabase.co'
    ).trim();

    const serviceRoleKey = (
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
      ''
    ).trim();

    const anonKey = (
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      ''
    ).trim();

    const activeKey = serviceRoleKey || anonKey;
    if (!supabaseUrl || !activeKey) {
      return {
        status: 500,
        body: {
          success: false,
          error: 'Credenciais do Supabase não configuradas no ambiente.',
        },
      };
    }

    const supabase = createClient(supabaseUrl, activeKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const hasAdminAuth = Boolean(serviceRoleKey);

    // 3. Verificação de Usuário Existente / Convite no Supabase Auth
    let existingAuthUser = null;
    let inviteSent = false;
    let inviteWarning = null;

    if (hasAdminAuth && supabase.auth?.admin) {
      try {
        const { data: usersListData, error: listErr } = await supabase.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        if (!listErr && Array.isArray(usersListData?.users)) {
          existingAuthUser =
            usersListData.users.find(
              (u) => String(u.email || '').trim().toLowerCase() === rawEmail
            ) || null;
        }
      } catch (authLookupErr) {
        console.warn('[masterCreateCompany] Aviso ao consultar usuários no Auth Admin:', authLookupErr?.message);
      }

      if (!existingAuthUser && sendInvite) {
        try {
          const publicOrigin = (
            process.env.VITE_PUBLIC_DOMAIN ||
            process.env.NEXT_PUBLIC_SITE_URL ||
            'https://ocorte.app'
          ).replace(/\/$/, '');

          const { data: inviteData, error: inviteErr } =
            await supabase.auth.admin.inviteUserByEmail(rawEmail, {
              data: {
                company_name: rawName,
                full_name: rawOwnerName || rawName,
                role: 'owner',
              },
              redirectTo: `${publicOrigin}/criar-senha?email=${encodeURIComponent(rawEmail)}&business=${encodeURIComponent(rawName)}&plan=${encodeURIComponent(planSlug)}`,
            });

          if (inviteErr) {
            const msg = String(inviteErr.message || '');
            if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')) {
              inviteSent = false;
            } else {
              inviteWarning = `Empresa criada, mas o envio de convite retornou aviso: ${msg}`;
            }
          } else {
            existingAuthUser = inviteData?.user || null;
            inviteSent = true;
          }
        } catch (invEx) {
          inviteWarning = `Empresa criada, porém não foi possível disparar o convite imediatamente (${invEx?.message || 'erro no serviço de Auth'}).`;
        }
      }
    } else if (sendInvite) {
      // Fallback caso SUPABASE_SERVICE_ROLE_KEY não esteja presente no ambiente:
      // verifica se já existe credencial e dispara Magic Link / OTP se aplicável
      try {
        const { data: existingCred } = await supabase
          .from('barber_credentials')
          .select('id, email')
          .ilike('email', rawEmail)
          .maybeSingle();

        if (existingCred) {
          existingAuthUser = { email: rawEmail };
        } else {
          const publicOrigin = (
            process.env.VITE_PUBLIC_DOMAIN ||
            'https://ocorte.app'
          ).replace(/\/$/, '');

          const { error: otpErr } = await supabase.auth.signInWithOtp({
            email: rawEmail,
            options: {
              shouldCreateUser: true,
              data: {
                company_name: rawName,
                full_name: rawOwnerName || rawName,
                role: 'owner',
              },
              emailRedirectTo: `${publicOrigin}/criar-senha?email=${encodeURIComponent(rawEmail)}&business=${encodeURIComponent(rawName)}&plan=${encodeURIComponent(planSlug)}`,
            },
          });

          if (!otpErr) {
            inviteSent = true;
          } else {
            inviteWarning =
              'Empresa provisionada com sucesso. Configure SUPABASE_SERVICE_ROLE_KEY no servidor para disparo via Admin Invite API.';
          }
        }
      } catch (_) {}
    }

    // 4. Verifica colisão prévia de slug no banco e garante unicidade
    let finalSlug = baseSlug;
    try {
      const { data: slugHit } = await supabase
        .from('companies')
        .select('id, slug')
        .eq('slug', finalSlug)
        .maybeSingle();
      if (slugHit) {
        finalSlug = `${baseSlug.slice(0, 32)}-${Math.floor(1000 + Math.random() * 9000)}`;
      }
    } catch (_) {}

    // 5. Monta o payload completo para public.companies
    const companyRecord = {
      name: rawName,
      slug: finalSlug,
      owner_email: rawEmail,
      owner_name: rawOwnerName || null,
      ...(existingAuthUser?.id ? { owner_id: existingAuthUser.id } : {}),
      phone: cleanPhone || rawPhone || null,
      whatsapp: cleanPhone || rawPhone || null,
      status: companyStatus,
      active: companyStatus === 'active',
      plan: planSlug,
      plan_id: planSlug,
      plan_name: planLabel,
      subscription_status: subscriptionStatus,
      billing_status: billingStatus,
      trial_ends_at: trialEndsAt,
      current_period_end: trialEndsAt,
      referral_code: generateReferralCode(8),
      onboarding_completed: false,
      onboarding_step: 1,
      business_hours: {
        _billing: {
          plan_name: planLabel,
          subscription_status: subscriptionStatus,
          billing_status: billingStatus,
          provisioned_by: 'master_assisted_onboarding',
          provisioned_at: nowIso,
        },
      },
      created_at: nowIso,
      updated_at: nowIso,
    };

    // 6. Inserção resiliente em public.companies com tratamento de colisão de slug e colunas opcionais
    let payloadToInsert = { ...companyRecord };
    let insertedCompany = null;
    let insertError = null;

    const selectColumns =
      'id, name, slug, owner_email, phone, whatsapp, active, created_at';

    for (let attempt = 0; attempt < 15; attempt++) {
      if (!payloadToInsert.slug) {
        payloadToInsert.slug = `${baseSlug.slice(0, 32)}-${Math.floor(1000 + Math.random() * 9000)}`;
      }

      const res = await supabase
        .from('companies')
        .insert([payloadToInsert])
        .select(selectColumns)
        .maybeSingle();

      insertedCompany = res.data;
      insertError = res.error;

      if (!insertError) break;

      const errMsg = String(insertError.message || '');

      // Colisão de slug único (Postgres 23505)
      if (insertError.code === '23505' && errMsg.toLowerCase().includes('slug')) {
        const cleanBase = String(payloadToInsert.slug || baseSlug)
          .replace(/-\d{4,6}$/, '')
          .slice(0, 32);
        payloadToInsert.slug = `${cleanBase}-${Math.floor(1000 + Math.random() * 9000)}`;
        continue;
      }

      // Remove apenas colunas opcionais que ainda não existam no schema remoto
      const colMatch =
        errMsg.match(/Could not find the '([^']+)' column/i) ||
        errMsg.match(/column "([^"]+)" of relation "[^"]+" does not exist/i) ||
        errMsg.match(/column "([^"]+)" does not exist/i);
      const missingCol = colMatch?.[1];
      if (
        missingCol &&
        missingCol in payloadToInsert &&
        missingCol !== 'name' &&
        missingCol !== 'slug' &&
        missingCol !== 'id'
      ) {
        delete payloadToInsert[missingCol];
        continue;
      }

      break;
    }

    if (insertError || !insertedCompany) {
      return {
        status: 400,
        body: {
          success: false,
          error:
            insertError?.message ||
            'Não foi possível criar o registro da barbearia no Supabase.',
          code: insertError?.code || 'COMPANY_INSERT_FAILED',
        },
      };
    }

    // 7. Sincroniza metadados do usuário no Auth Admin e BarberCredential com o company_id gerado (consistência RLS)
    if (hasAdminAuth && existingAuthUser?.id && supabase.auth?.admin) {
      try {
        await supabase.auth.admin.updateUserById(existingAuthUser.id, {
          user_metadata: {
            ...(existingAuthUser.user_metadata || {}),
            company_id: insertedCompany.id,
            company_name: insertedCompany.name,
            full_name: rawOwnerName || existingAuthUser.user_metadata?.full_name || insertedCompany.name,
            role: 'owner',
          },
        });
      } catch (_) {}
    }

    try {
      const { data: existingCred } = await supabase
        .from('barber_credentials')
        .select('id')
        .ilike('email', rawEmail)
        .maybeSingle();

      if (!existingCred) {
        await supabase.from('barber_credentials').insert([
          {
            email: rawEmail,
            full_name: rawOwnerName || rawName,
            role: 'owner',
            company_id: insertedCompany.id,
            created_at: nowIso,
          },
        ]);
      } else {
        await supabase
          .from('barber_credentials')
          .update({ company_id: insertedCompany.id })
          .eq('id', existingCred.id);
      }
    } catch (_) {}

    return {
      status: 200,
      body: {
        success: true,
        company: {
          ...companyRecord,
          ...insertedCompany,
        },
        auth: {
          user_already_existed: Boolean(existingAuthUser && !inviteSent),
          invite_sent: inviteSent,
          user_id: existingAuthUser?.id || null,
          warning: inviteWarning,
        },
      },
    };
  } catch (err) {
    console.error('[masterCreateCompany] Erro inesperado:', err);
    return {
      status: 500,
      body: {
        success: false,
        error: err?.message || 'Erro interno ao provisionar barbearia.',
      },
    };
  }
}
