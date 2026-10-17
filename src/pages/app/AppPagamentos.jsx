// AppPagamentos.jsx — Modelo A (SaaS + Integração Direta de Barbearias)
// Permite que o proprietário configure sua própria Chave de API do Asaas para receber 100%
// dos pagamentos dos clientes finais de forma autônoma (via Pix ou Cartão de Crédito).
// 🔒 Protegido: Barbeiros NUNCA têm acesso a esta tela nem à visualização das chaves.

import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { resolveCompanyId } from '@/api/functions';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useCompany } from '@/hooks/useCompany';
import { useTeamRole } from '@/lib/useTeamRole';
import { useToast } from '@/components/ui/use-toast';
import AppLayout from '@/components/layout/AppLayout';
import AppPageHeader from '@/components/app/AppPageHeader';
import StandardModal from '@/components/ui/standard-modal';
import {
  CreditCard,
  QrCode,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Loader2,
  Eye,
  EyeOff,
  Copy,
  Check,
  Zap,
  Info,
} from 'lucide-react';

export default function AppPagamentos() {
  const { user } = useAuth();
  const { company, companyId, isLoading: loadingCompany } = useCompany();
  const { data: teamRole, isLoading: loadingRole } = useTeamRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isBarbeiro = teamRole?.role === 'barbeiro' || teamRole?.isBarbeiro === true;

  // Estados locais do formulário
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [pixEnabled, setPixEnabled] = useState(true);
  const [cardEnabled, setCardEnabled] = useState(true);
  const [bookingPaymentMode, setBookingPaymentMode] = useState('optional'); // 'none' | 'deposit' | 'full' | 'optional'
  const [depositAmount, setDepositAmount] = useState('20.00');

  // Estados de feedback e modais
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testingKey, setTestingKey] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [testChargeModal, setTestChargeModal] = useState(null);
  const [generatingCharge, setGeneratingCharge] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Helper para resolver o company_id da empresa ativa da sessão
  const resolveActiveCompanyId = useCallback(async () => {
    if (companyId && companyId !== 'comp_demo_01') return companyId;
    if (company?.id && company.id !== 'comp_demo_01') return company.id;

    try {
      const rawAdmin = localStorage.getItem('admin_logged_user');
      if (rawAdmin) {
        const parsed = JSON.parse(rawAdmin);
        if (parsed?.company_id && parsed.company_id !== 'comp_demo_01') {
          return parsed.company_id;
        }
        if (parsed?.email && supabase) {
          const { data: compByEmail } = await supabase
            .from('companies')
            .select('id')
            .eq('owner_email', parsed.email.trim().toLowerCase())
            .maybeSingle();
          if (compByEmail?.id) return compByEmail.id;
        }
      }
    } catch (_) {}

    try {
      if (supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionEmail = sessionData?.session?.user?.email;
        if (sessionEmail) {
          const { data: compBySession } = await supabase
            .from('companies')
            .select('id')
            .eq('owner_email', sessionEmail.trim().toLowerCase())
            .maybeSingle();
          if (compBySession?.id) return compBySession.id;
        }
      }
    } catch (_) {}

    const resolved = await resolveCompanyId({ company_id: companyId });
    if (resolved && resolved !== 'comp_demo_01') return resolved;

    try {
      if (supabase) {
        const { data: firstComp } = await supabase
          .from('companies')
          .select('id')
          .limit(1)
          .maybeSingle();
        if (firstComp?.id) return firstComp.id;
      }
    } catch (_) {}

    return companyId || company?.id || null;
  }, [company, companyId]);

  // 1. Carregamento Inicial (useEffect / fetch):
  // Ao carregar a página, consulte o registo da barbearia ativa em 'companies' trazendo o campo 'asaas_api_key'.
  // Se 'asaas_api_key' existir no banco, preencha o input com o valor (ou mantenha o valor visível para edição).
  const fetchAsaasApiKey = useCallback(async () => {
    try {
      const activeId = await resolveActiveCompanyId();
      if (activeId && supabase) {
        const { data, error } = await supabase
          .from('companies')
          .select('id, asaas_api_key')
          .eq('id', activeId)
          .maybeSingle();

        if (!error && data) {
          if (data.asaas_api_key) {
            setApiKey(data.asaas_api_key);
          }
        }

        // Carrega preferências locais se configuradas
        try {
          const rawLocal = localStorage.getItem(`barberpass_payment_settings_${activeId}`);
          if (rawLocal) {
            const parsed = JSON.parse(rawLocal);
            if (parsed.pixEnabled !== undefined) setPixEnabled(Boolean(parsed.pixEnabled));
            if (parsed.cardEnabled !== undefined) setCardEnabled(Boolean(parsed.cardEnabled));
            if (parsed.bookingPaymentMode) setBookingPaymentMode(parsed.bookingPaymentMode);
            if (parsed.depositAmount !== undefined) setDepositAmount(String(parsed.depositAmount));
          }
        } catch (_) {}
      }
    } catch (err) {
      console.warn('[AppPagamentos] Erro ao carregar asaas_api_key da barbearia:', err);
    }
  }, [resolveActiveCompanyId]);

  useEffect(() => {
    fetchAsaasApiKey();
  }, [fetchAsaasApiKey]);

  // Hidrata dados da company quando carregada
  useEffect(() => {
    if (company) {
      if (company.asaas_api_key && !apiKey) setApiKey(company.asaas_api_key);
    }
  }, [company, apiKey]);

  // 2. Ação de Salvar ("Salvar Chave de API"):
  // Ao clicar em "Salvar Chave de API", execute o update no Supabase:
  // supabase.from('companies').update({ asaas_api_key: apiKey.trim() }).eq('id', activeCompanyId)
  // Adicione tratamento explícito de erro: se houver erro, exiba um toast com a mensagem exata (error.message).
  // Em caso de sucesso, exiba toast verde: "Chave de API salva com sucesso!" e atualize o estado local.
  const handleSaveApiKey = async (overrideOptions = {}) => {
    const cleanKey = (overrideOptions.apiKey !== undefined ? overrideOptions.apiKey : apiKey).trim();
    setIsSaving(true);
    try {
      const activeCompanyId = await resolveActiveCompanyId();
      if (!activeCompanyId) {
        toast({
          title: 'Erro de identificação',
          description: 'Não foi possível identificar a empresa ativa da sessão.',
          variant: 'destructive',
        });
        setIsSaving(false);
        return;
      }

      // Executa o update exato da chave de API no Supabase
      const { error } = await supabase
        .from('companies')
        .update({ asaas_api_key: cleanKey })
        .eq('id', activeCompanyId);

      if (error) {
        console.error('[AppPagamentos] Erro ao salvar chave no Supabase:', error);
        toast({
          title: 'Erro ao salvar chave',
          description: error.message,
          variant: 'destructive',
        });
        setIsSaving(false);
        return;
      }

      // Salva preferências locais para consistência na UI
      try {
        const settingsToSave = {
          pixEnabled: overrideOptions.pixEnabled !== undefined ? overrideOptions.pixEnabled : pixEnabled,
          cardEnabled: overrideOptions.cardEnabled !== undefined ? overrideOptions.cardEnabled : cardEnabled,
          bookingPaymentMode: overrideOptions.bookingPaymentMode || bookingPaymentMode,
          depositAmount: overrideOptions.depositAmount || depositAmount,
        };
        localStorage.setItem(`barberpass_payment_settings_${activeCompanyId}`, JSON.stringify(settingsToSave));
      } catch (_) {}


      setApiKey(cleanKey);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);

      toast({
        title: 'Chave de API salva com sucesso!',
        description: 'Sua chave do Asaas foi gravada e está ativa para recebimentos.',
        className: 'bg-emerald-600 text-white border-none',
      });

      queryClient.invalidateQueries({ queryKey: ['my-company'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      await fetchAsaasApiKey();
    } catch (err) {
      console.error('[AppPagamentos] Exceção ao salvar chave:', err);
      toast({
        title: 'Erro ao salvar chave',
        description: err?.message || 'Falha inesperada ao gravar no Supabase.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 3. Botão "Testar Conexão com Asaas":
  // Chama a rota de proxy serverless /api/asaas/test-connection via POST para evitar bloqueios de CORS
  const handleTestConnection = async () => {
    const rawKey = apiKey.trim();
    const activeCompanyId = await resolveActiveCompanyId();

    const isMasked = /^[•*]+$/.test(rawKey) || rawKey.includes('••••') || rawKey.includes('****');

    if (!rawKey && !activeCompanyId && !company?.asaas_api_key) {
      const msg = 'Digite uma chave de API antes de testar.';
      setTestResult({ success: false, error: msg, message: msg });
      toast({
        title: 'Chave obrigatória',
        description: msg,
        variant: 'destructive',
      });
      return;
    }

    setTestingKey(true);
    setTestResult(null);

    try {
      const payload = {
        companyId: activeCompanyId || company?.id,
      };

      // Se a chave não for a máscara pontilhada, envia o valor digitado
      if (!isMasked && rawKey) {
        payload.apiKey = rawKey;
      }

      const res = await fetch('/api/asaas/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.success) {
        setTestResult({
          success: true,
          message: data.message || 'Conexão estabelecida com sucesso!',
        });
        toast({
          title: 'Conexão bem-sucedida!',
          description: data.message || 'Conexão estabelecida com sucesso!',
          className: 'bg-emerald-600 text-white border-none',
        });
      } else {
        const errorMsg = data?.message || (typeof data?.error === 'string' ? data.error : null) || `Erro Asaas (${res.status}): Falha na validação com o servidor.`;
        setTestResult({
          success: false,
          error: errorMsg,
          message: errorMsg,
        });
        toast({
          title: 'Falha na validação',
          description: errorMsg,
          variant: 'destructive',
        });
      }
    } catch (err) {
      const errorMsg = err?.message || 'Falha ao testar conexão com o Asaas.';
      setTestResult({
        success: false,
        error: errorMsg,
        message: errorMsg,
      });
      toast({
        title: 'Erro de conexão',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setTestingKey(false);
    }
  };

  // Gerar cobrança de teste de R$ 5,00 para validação
  const handleGenerateTestCharge = async () => {
    setGeneratingCharge(true);
    try {
      const res = await base44.functions.invoke('createAsaasBookingPayment', {
        company_id: companyId,
        price: 5.0,
        customer_name: 'Teste de Integração Barbearia',
      });
      if (res?.data?.pix) {
        setTestChargeModal(res.data.pix);
      }
    } catch (_) {}
    finally {
      setGeneratingCharge(false);
    }
  };

  // 🔒 Bloqueio estrito de segurança (RBAC): Barbeiros NUNCA acessam esta página
  if (!loadingRole && isBarbeiro) {
    return <Navigate to="/app/agenda" replace />;
  }

  const isConfigured = Boolean(company?.asaas_api_key || apiKey);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto animate-fade-in font-inter space-y-6">
        <AppPageHeader
          title="Pagamentos e Recebimento Online"
          subtitle="Configure a chave de API do Asaas da sua barbearia para receber 100% das reservas e cortes direto na sua conta bancária."
          icon={CreditCard}
        />

        {/* Status de Conexão - Modelo A */}
        <div className={`p-5 rounded-3xl border backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all shadow-xl ${
          isConfigured
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
            : 'bg-amber-500/10 border-amber-500/20 text-amber-200'
        }`}>
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              isConfigured ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
            }`}>
              {isConfigured ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">
                  {isConfigured ? 'Integração Direta Ativa (Modelo A)' : 'Chave do Asaas Pendente'}
                </h3>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  isConfigured ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {isConfigured ? '100% Autônomo' : 'Ação Necessária'}
                </span>
              </div>
              <p className="text-xs text-white/60 mt-0.5 leading-relaxed">
                {isConfigured
                  ? 'Todos os pagamentos realizados pelos seus clientes no link de agendamento são creditados diretamente na sua conta do Asaas.'
                  : 'Cole a sua Chave de API do Asaas abaixo para liberar pagamentos via Pix e Cartão de Crédito no seu link de agendamento.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowInstructionsModal(true)}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer flex-shrink-0 border border-white/10"
          >
            <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
            <span>Como obter minha chave?</span>
          </button>
        </div>

        {/* Card 1: Chave de API do Asaas */}
        <div className="bg-[#0B1020]/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-7 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-400/20 flex items-center justify-center text-blue-400">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Chave de API do Asaas da sua Barbearia</h2>
                <p className="text-xs text-white/50">Garante a autonomia total: sem intermediários ou taxas ocultas.</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block mb-0.5">Instrução simples:</strong>
                <span>Acesse <strong>asaas.com</strong> &gt; <strong>Configurações</strong> &gt; <strong>Integrações</strong> &gt; <strong>Gerar Chave de API</strong> e cole aqui para receber diretamente dos seus clientes via Cartão ou Pix.</span>
              </div>
            </div>

            <label className="block text-xs font-semibold text-white/70">
              Chave de API do Asaas da sua Barbearia (company.asaas_api_key)
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestResult(null);
                }}
                placeholder="Cole aqui sua chave: $aact_prod_... ou $aact_hmlg_..."
                className="w-full pl-4 pr-24 py-3 bg-white/[0.04] border border-white/10 rounded-2xl text-sm font-mono text-white placeholder:text-white/25 focus:outline-none focus:border-blue-400 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 text-xs text-white/40 hover:text-white flex items-center gap-1 rounded-lg transition-colors cursor-pointer"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span>{showKey ? 'Ocultar' : 'Mostrar'}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingKey || (!apiKey.trim() && !company?.asaas_api_key)}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.99] border border-white/10 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {testingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" /> : <Zap className="w-3.5 h-3.5 text-blue-400" />}
                <span>Testar Conexão com Asaas</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveApiKey()}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#1D4ED8] to-[#3B82F6] hover:brightness-110 active:scale-[0.99] text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Salvar Chave de API</span>
              </button>

              {saveSuccess && (
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4" />
                  Salvo com sucesso!
                </span>
              )}
            </div>

            {/* Resultado do Teste de Conexão */}
            {testResult && (
              <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 mt-3 animate-fade-in ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-200'
              }`}>
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">{testResult.success ? 'Conexão Testada com Sucesso' : 'Falha na Validação'}</div>
                  <div className="mt-0.5 text-white/70">{testResult.message || testResult.error}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Métodos de Pagamento Aceitos */}
        <div className="bg-[#0B1020]/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-7 shadow-xl space-y-5">
          <div className="border-b border-white/5 pb-4">
            <h2 className="text-base font-bold text-white">Métodos de Pagamento no Agendamento</h2>
            <p className="text-xs text-white/50">Selecione quais formas de pagamento seus clientes podem utilizar online.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Toggle Pix */}
            <div className={`p-4 rounded-2xl border transition-all ${
              pixEnabled ? 'bg-blue-500/10 border-blue-400/30' : 'bg-white/[0.02] border-white/8 opacity-60'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-white">Pix Instantâneo</span>
                </div>
                <input
                  type="checkbox"
                  checked={pixEnabled}
                  onChange={(e) => {
                    const nextVal = e.target.checked;
                    setPixEnabled(nextVal);
                    handleSaveApiKey({ pixEnabled: nextVal });
                  }}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </div>
              <p className="text-xs text-white/55 leading-relaxed">
                Gera QR Code dinâmico e código Pix Copia e Cola para pagamento na hora. Dinheiro cai em segundos na sua conta.
              </p>
            </div>

            {/* Toggle Cartão */}
            <div className={`p-4 rounded-2xl border transition-all ${
              cardEnabled ? 'bg-blue-500/10 border-blue-400/30' : 'bg-white/[0.02] border-white/8 opacity-60'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-white">Cartão de Crédito</span>
                </div>
                <input
                  type="checkbox"
                  checked={cardEnabled}
                  onChange={(e) => {
                    const nextVal = e.target.checked;
                    setCardEnabled(nextVal);
                    handleSaveApiKey({ cardEnabled: nextVal });
                  }}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </div>
              <p className="text-xs text-white/55 leading-relaxed">
                Permite pagamento à vista ou parcelado direto no link público. O valor segue o calendário de repasse do seu Asaas.
              </p>
            </div>
          </div>
        </div>

        {/* Card 3: Política de Cobrança Online (Sinal Anti No-Show) */}
        <div className="bg-[#0B1020]/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-7 shadow-xl space-y-5">
          <div className="border-b border-white/5 pb-4">
            <h2 className="text-base font-bold text-white">Política de Cobrança no Agendamento</h2>
            <p className="text-xs text-white/50">Defina se o cliente paga sinal de reserva, valor integral ou apenas no balcão.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { id: 'none', label: 'Sem cobrança prévia', desc: 'Cliente agenda grátis e paga no balcão da barbearia' },
              { id: 'deposit', label: 'Cobrar Sinal de Reserva', desc: 'Trava o horário e reduz no-shows (abatido no valor total)' },
              { id: 'full', label: 'Cobrar Valor Integral', desc: 'Cliente paga 100% do serviço antes de confirmar o horário' },
            ].map((opt) => (
              <div
                key={opt.id}
                onClick={() => {
                  setBookingPaymentMode(opt.id);
                  handleSaveApiKey({ bookingPaymentMode: opt.id });
                }}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  bookingPaymentMode === opt.id
                    ? 'bg-blue-600/15 border-blue-400/40 ring-1 ring-blue-400/30'
                    : 'bg-white/[0.02] border-white/8 hover:border-white/15'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-bold text-white">{opt.label}</div>
                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                    bookingPaymentMode === opt.id ? 'border-blue-400 bg-blue-500' : 'border-white/30'
                  }`}>
                    {bookingPaymentMode === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <p className="text-[11px] text-white/50 leading-relaxed">{opt.desc}</p>
              </div>
            ))}
          </div>

          {bookingPaymentMode === 'deposit' && (
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2 animate-fade-in max-w-sm">
              <label className="block text-xs font-semibold text-white/70">
                Valor do Sinal de Reserva (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-white/40">R$</span>
                <input
                  type="number"
                  step="1"
                  min="5"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  onBlur={() => handleSaveApiKey({ depositAmount })}
                  placeholder="20.00"
                  className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-blue-400"
                />
              </div>
              <p className="text-[11px] text-white/40">
                Exemplo: Para um corte de R$ 50, o cliente paga R$ {depositAmount || 20} no agendamento e o restante no balcão.
              </p>
            </div>
          )}
        </div>

        {/* Card 4: Simulação de Teste */}
        <div className="p-5 rounded-3xl border border-white/10 bg-white/[0.025] backdrop-blur-xl flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h4 className="text-sm font-bold text-white">Quer testar se sua chave está recebendo?</h4>
            <p className="text-xs text-white/50">Gere uma cobrança Pix de teste de R$ 1,00 para verificar seu QR Code.</p>
          </div>
          <button
            type="button"
            onClick={handleGenerateTestCharge}
            disabled={generatingCharge}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            {generatingCharge ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <QrCode className="w-3.5 h-3.5 text-emerald-400" />}
            <span>Gerar Pix de Teste (R$ 1,00)</span>
          </button>
        </div>

        {/* Modal de Instruções Passo a Passo */}
        {showInstructionsModal && (
          <StandardModal
            open={showInstructionsModal}
            onClose={() => setShowInstructionsModal(false)}
            title="Como Obter sua Chave de API no Asaas"
            footer={
              <div className="flex gap-2 w-full">
                <a
                  href="https://www.asaas.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center justify-center gap-2 border border-white/10 transition-colors"
                >
                  <span>Abrir Asaas.com</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => setShowInstructionsModal(false)}
                  className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Entendi
                </button>
              </div>
            }
          >
            <div className="space-y-4 text-xs text-white/80 leading-relaxed">
              <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-400/20 text-blue-200">
                <p className="font-bold mb-1">Modelo de Autonomia Total (Modelo A)</p>
                <p className="text-blue-200/80">
                  O dinheiro dos seus clientes não passa por contas intermediárias. Ele é depositado 100% na conta Asaas da sua barbearia.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">1</div>
                  <div>
                    <p className="font-bold text-white">Acesse sua conta Asaas</p>
                    <p className="text-white/60">Faça login em <span className="text-blue-400 font-mono">asaas.com</span> com seu e-mail e senha.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">2</div>
                  <div>
                    <p className="font-bold text-white">Acesse o menu de Integrações</p>
                    <p className="text-white/60">No canto superior direito, clique no ícone de engrenagem (Configurações) e depois em <strong>Integrações</strong>.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">3</div>
                  <div>
                    <p className="font-bold text-white">Gere a Chave de API</p>
                    <p className="text-white/60">Na seção "Chaves de API", clique no botão azul <strong>"Gerar Chave de API"</strong> e confirme.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">4</div>
                  <div>
                    <p className="font-bold text-white">Copie e Cole no O CORTE</p>
                    <p className="text-white/60">Copie o código gerado (começa com <span className="font-mono text-emerald-400">$aact_...</span>), cole no campo acima e clique em <strong>Salvar Chave de API</strong>.</p>
                  </div>
                </div>
              </div>
            </div>
          </StandardModal>
        )}

        {/* Modal do Pix de Teste */}
        {testChargeModal && (
          <StandardModal
            open={!!testChargeModal}
            onClose={() => setTestChargeModal(null)}
            title="Cobrança Pix de Teste (R$ 1,00)"
            footer={
              <button
                onClick={() => setTestChargeModal(null)}
                className="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Fechar Teste
              </button>
            }
          >
            <div className="text-center space-y-4">
              <p className="text-xs text-white/60">
                Escaneie o QR Code abaixo com seu aplicativo de banco para testar a recepção na sua conta Asaas.
              </p>
              <div className="flex justify-center p-4 bg-white rounded-2xl w-fit mx-auto shadow-xl">
                <img
                  src={
                    testChargeModal.encodedImage
                      ? (testChargeModal.encodedImage.startsWith('data:') ? testChargeModal.encodedImage : `data:image/png;base64,${testChargeModal.encodedImage}`)
                      : testChargeModal.qr_code_base64
                  }
                  alt="QR Code Pix"
                  className="w-48 h-48 object-contain"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-white/60 mb-1">Código Pix Copia e Cola:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={testChargeModal.payload || testChargeModal.copy_paste}
                    className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-emerald-300 select-all"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(testChargeModal.payload || testChargeModal.copy_paste);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="px-3 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>
            </div>
          </StandardModal>
        )}
      </div>
    </AppLayout>
  );
}