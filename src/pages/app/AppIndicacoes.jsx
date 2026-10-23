import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { Company } from '@/api/entities';
import { resolveCompanyId } from '@/api/functions';
import { useCompany } from '@/hooks/useCompany';
import { Gift, Copy, CheckCircle2, Loader2, Share2, Store, CalendarCheck, Sparkles, Users } from 'lucide-react';
import AppPageHeader from '@/components/app/AppPageHeader';

function generateAlphanumericCode(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function AppIndicacoes() {
  const { company: ctxCompany, companyId: ctxCompanyId, isLoading: loadingCtx } = useCompany();
  const [companyData, setCompanyData] = useState(null);
  const [referralsList, setReferralsList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const loadCompanyAndReferral = useCallback(async () => {
    setIsLoading(true);
    try {
      let targetId = ctxCompanyId && ctxCompanyId !== 'comp_demo_01' ? ctxCompanyId : (ctxCompany?.id || null);
      if (!targetId || targetId === 'comp_demo_01') {
        targetId = await resolveCompanyId({ company_id: targetId });
      }

      let fetchedCompany = null;

      // 1. Busca os dados da company ativa no Supabase (incluindo referral_code e free_months_balance)
      if (isSupabaseConfigured && supabase) {
        if (targetId && targetId !== 'comp_demo_01') {
          const { data: row, error } = await supabase
            .from('companies')
            .select('*')
            .eq('id', targetId)
            .maybeSingle();
          if (!error && row) {
            fetchedCompany = row;
          }
        }

        if (!fetchedCompany) {
          const { data: firstRow } = await supabase
            .from('companies')
            .select('*')
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          if (firstRow) {
            fetchedCompany = firstRow;
            targetId = firstRow.id;
          }
        }
      }

      if (!fetchedCompany && targetId) {
        fetchedCompany = await Company.get(targetId);
      }
      if (!fetchedCompany && ctxCompany) {
        fetchedCompany = { ...ctxCompany };
      }
      if (!fetchedCompany) {
        const all = await Company.list();
        fetchedCompany = all[0] || { id: targetId || 'comp_demo_01', name: 'Minha Barbearia' };
      }

      // 2. Verifica ou gera o referral_code de 8 caracteres alfanuméricos
      let code = fetchedCompany.referral_code ? String(fetchedCompany.referral_code).trim() : '';
      if (!code && typeof window !== 'undefined' && fetchedCompany.id) {
        try {
          code = localStorage.getItem(`ocorte_referral_code_${fetchedCompany.id}`) || '';
        } catch (_) {}
      }

      if (!code) {
        code = generateAlphanumericCode(8);
        if (typeof window !== 'undefined' && fetchedCompany.id) {
          try {
            localStorage.setItem(`ocorte_referral_code_${fetchedCompany.id}`, code);
          } catch (_) {}
        }

        // Atualiza no banco via update na tabela 'companies'
        if (isSupabaseConfigured && supabase && fetchedCompany.id && fetchedCompany.id !== 'comp_demo_01') {
          try {
            const { data: updatedRow, error: updateError } = await supabase
              .from('companies')
              .update({ referral_code: code })
              .eq('id', fetchedCompany.id)
              .select('id, name, referral_code, free_months_balance')
              .maybeSingle();

            if (!updateError && updatedRow) {
              fetchedCompany = { ...fetchedCompany, ...updatedRow, referral_code: code };
            } else {
              fetchedCompany = { ...fetchedCompany, referral_code: code };
            }
          } catch (_) {
            fetchedCompany = { ...fetchedCompany, referral_code: code };
          }
        } else {
          fetchedCompany = { ...fetchedCompany, referral_code: code };
        }

        try {
          if (fetchedCompany.id) {
            await Company.update(fetchedCompany.id, { referral_code: code });
          }
        } catch (_) {}
      } else {
        fetchedCompany = { ...fetchedCompany, referral_code: code };
      }

      // 3. Busca barbearias indicadas por este código (se existirem)
      let indicatedCompanies = [];
      if (isSupabaseConfigured && supabase && code) {
        try {
          const { data: referredRows } = await supabase
            .from('companies')
            .select('id, name, status, subscription_status, created_at, referred_by')
            .eq('referred_by', code)
            .order('created_at', { ascending: false });

          if (Array.isArray(referredRows)) {
            indicatedCompanies = referredRows;
          }
        } catch (_) {}
      }

      setCompanyData(fetchedCompany);
      setReferralsList(indicatedCompanies);
    } catch (err) {
      console.error('[AppIndicacoes] Erro ao carregar dados de indicação:', err);
      const fallbackCode = generateAlphanumericCode(8);
      setCompanyData({
        ...(ctxCompany || {}),
        referral_code: ctxCompany?.referral_code || fallbackCode,
        free_months_balance: ctxCompany?.free_months_balance || 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, [ctxCompany, ctxCompanyId]);

  useEffect(() => {
    if (!loadingCtx) {
      loadCompanyAndReferral();
    }
  }, [loadingCtx, loadCompanyAndReferral]);

  const company = companyData || ctxCompany || {};
  const referralCode = company.referral_code || '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const referralLink = referralCode ? `${origin}/cadastro?ref=${referralCode}` : '';

  const freeMonthsBalance = Number(company.free_months_balance || 0);
  const registeredBarbershopsCount = Number(
    company.referrals_count ?? referralsList.length ?? 0
  );
  const redeemedMonthsCount = Number(
    company.free_months_redeemed ?? company.free_months_balance ?? 0
  );

  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    if (!referralLink) return;
    const message =
      'Opa, estou usando O Corte para gerenciar minha barbearia e recomendo demais. Cadastra pelo meu link para conhecer: ' +
      referralLink;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-3xl mx-auto animate-fade-in space-y-6">
        <AppPageHeader
          title="Indique e ganhe"
          subtitle="Compartilhe seu link com amigos donos de barbearia e ganhe mensalidades grátis"
          icon={Gift}
        />

        {/* Card de Proposta de Valor Principal */}
        <div className="relative bg-gradient-to-br from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] rounded-2xl p-6 text-white shadow-[0_16px_48px_rgba(37,99,235,0.45)] ring-1 ring-white/15 overflow-hidden">
          <span className="absolute -top-12 -right-12 w-40 h-40 bg-[#60A5FA]/30 blur-3xl rounded-full" aria-hidden="true" />
          <span className="absolute -bottom-16 -left-10 w-44 h-44 bg-[#93C5FD]/20 blur-3xl rounded-full" aria-hidden="true" />

          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-white/15 backdrop-blur ring-1 ring-white/25 rounded-xl flex items-center justify-center flex-shrink-0">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider opacity-85">Sua recompensa</div>
                <h2 className="text-xl font-extrabold tracking-tight">1 Mês Grátis por Indicação</h2>
              </div>
            </div>

            {/* Contador de Saldo Acumulado */}
            <div className="inline-flex items-center gap-2 bg-slate-950/35 backdrop-blur-md border border-white/20 rounded-xl px-3.5 py-2 self-start sm:self-auto">
              <Sparkles className="w-4 h-4 text-amber-300 flex-shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-white">
                Meses Grátis Acumulados: {freeMonthsBalance} meses
              </span>
            </div>
          </div>

          <p className="relative text-sm opacity-95 leading-relaxed">
            Indique amigos donos de barbearia. A cada barbearia que assinar o plano pelo seu link, você ganha 1 mês 100% grátis na sua mensalidade. Se indicar 12 barbearias, você garante o ano inteiro sem pagar nada!
          </p>
        </div>

        {/* Seção do Link de Indicação */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-white">Seu link de indicação</h2>
            {referralCode && (
              <span className="text-xs text-white/50">
                Código: <code className="font-bold text-[#93C5FD]">{referralCode}</code>
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-[#60A5FA]" />
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white/[0.04] border border-white/10 rounded-xl p-2.5 mb-4">
                <input
                  type="text"
                  readOnly
                  value={referralLink}
                  onClick={(e) => e.currentTarget.select()}
                  className="flex-1 bg-transparent text-xs sm:text-sm text-white font-mono px-2 py-1 focus:outline-none truncate"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="bg-white/[0.08] border border-white/15 hover:border-blue-400/40 hover:text-[#93C5FD] hover:bg-white/[0.12] text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center justify-center gap-1.5 flex-shrink-0 transition-all cursor-pointer"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Link Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copiar Link
                    </>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="w-full bg-gradient-to-br from-emerald-600 to-emerald-500 hover:brightness-110 text-white font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(16,185,129,0.35)] ring-1 ring-white/15 transition-all cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                Compartilhar no WhatsApp
              </button>
            </>
          )}
        </div>

        {/* Estatísticas e Lista de Indicações */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#60A5FA]" />
            <h2 className="font-bold text-white">Suas Indicações</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/25 flex items-center justify-center text-[#60A5FA] flex-shrink-0">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-white/55 font-medium">Barbearias Cadastradas</div>
                <div className="text-2xl font-extrabold text-white">{registeredBarbershopsCount}</div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center text-emerald-400 flex-shrink-0">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-white/55 font-medium">Meses Grátis Resgatados</div>
                <div className="text-2xl font-extrabold text-white">{redeemedMonthsCount}</div>
              </div>
            </div>
          </div>

          {referralsList.length > 0 ? (
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="text-xs font-semibold uppercase tracking-wider text-white/45 mb-2">
                Histórico de Barbearias Indicadas
              </div>
              {referralsList.map((item) => {
                const isActive = item.subscription_status === 'active' || item.status === 'active';
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/8"
                  >
                    <div>
                      <div className="text-sm font-semibold text-white">{item.name || 'Barbearia Indicada'}</div>
                      {item.created_at && (
                        <div className="text-[11px] text-white/45">
                          Cadastrada em {new Date(item.created_at).toLocaleDateString('pt-BR')}
                        </div>
                      )}
                    </div>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                        isActive
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
                          : 'bg-amber-500/15 text-amber-200 border-amber-400/30'
                      }`}
                    >
                      {isActive ? '+1 Mês Grátis' : 'Aguardando assinatura'}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.015] p-6 text-center">
              <p className="text-sm text-white/60 font-medium">
                Nenhuma barbearia cadastrada pelo seu link ainda.
              </p>
              <p className="text-xs text-white/40 mt-1">
                Compartilhe seu link no WhatsApp com amigos barbeiros para começar a acumular meses grátis!
              </p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}