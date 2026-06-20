// AsaasSplitCard — Recebimentos via Asaas (split automático)
//
// POLÍTICA: O CORTE opera EXCLUSIVAMENTE com empresas CNPJ/MEI.
// Não há modo manual, não há repasse manual, não há recebimento centralizado.
// Toda barbearia precisa de subaccount Asaas ativa para usar o agendamento online pago.
//
// Estados:
//   - Sem subaccount → form CNPJ + endereço → "Ativar pagamento online"
//   - pending → banner âmbar + link onboarding + "Atualizar status"
//   - active → banner emerald + métricas
//   - rejected → banner vermelho + suporte
//
// Barbearias PF legadas (cadastradas antes desta política): mantêm acesso ao recebimento
// já configurado, mas não conseguem criar novas subaccounts via este card.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Banknote, CheckCircle2, AlertCircle, ExternalLink, Loader2, ShieldCheck, Zap, Building2 } from 'lucide-react';

function maskCNPJ(v) {
  const d = String(v || '').replace(/\D+/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2}\.\d{3})(\d)/, '$1.$2')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}
function maskCEP(v) {
  return String(v || '').replace(/\D+/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
}

export default function AsaasSplitCard({ company }) {
  return <AsaasSplitFlow company={company} />;
}

function AsaasSplitFlow({ company }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    cpf_cnpj: company?.owner_cpf_cnpj || '',
    line1: company?.address_details?.line1 || '',
    address_number: '',
    neighborhood: company?.address_details?.neighborhood || '',
    city: company?.address_details?.city || '',
    state: company?.address_details?.state || '',
    postal_code: company?.address_details?.postal_code || '',
  });

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['asaas-subaccount', company?.id],
    queryFn: () => base44.functions.invoke('getAsaasSubaccountStatus', { company_id: company.id }).then(r => r.data),
    enabled: !!company?.id,
    refetchOnWindowFocus: true,
  });

  const docDigits = String(form.cpf_cnpj || '').replace(/\D+/g, '');
  const isCpf = docDigits.length === 11;
  const isCnpj = docDigits.length === 14;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!isCnpj) {
        throw new Error('Para utilizar os recebimentos automáticos do O CORTE é necessário possuir um CNPJ ativo (MEI também é aceito).');
      }
      try {
        const res = await base44.functions.invoke('createAsaasSubaccount', {
          company_id: company.id,
          cpf_cnpj: docDigits,
          address_number: form.address_number,
          address_details: {
            line1: form.line1,
            neighborhood: form.neighborhood,
            city: form.city,
            state: form.state.toUpperCase(),
            postal_code: form.postal_code.replace(/\D+/g, ''),
          },
        });
        if (res?.data?.error) throw new Error(res.data.message || res.data.error);
        return res.data;
      } catch (err) {
        const payload = err?.response?.data;
        const msg = payload?.message || payload?.error || err.message;
        throw new Error(msg || 'Falha ao criar conta Asaas.');
      }
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => base44.functions.invoke('getAsaasSubaccountStatus', { company_id: company.id, force_check: true }),
    onSuccess: () => refetch(),
  });

  const connected = !!status?.asaas_subaccount_id;
  const isActive = status?.status === 'active';
  const isPending = connected && status?.status === 'pending';
  const isRejected = connected && status?.status === 'rejected';

  return (
    <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-[var(--shadow-sm)] mb-4">
      <div className="flex items-start gap-4 mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isActive ? 'bg-emerald-50' : isRejected ? 'bg-red-50' : 'bg-blue-50'
        }`}>
          <Banknote className={`w-5 h-5 ${isActive ? 'text-emerald-600' : isRejected ? 'text-red-600' : 'text-[#2563EB]'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-[#111827]">Pagamentos online via Asaas</h2>
            {isActive && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" /> Ativo
              </span>
            )}
            {isPending && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                <AlertCircle className="w-3 h-3" /> Aguardando aprovação
              </span>
            )}
            {isRejected && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                <AlertCircle className="w-3 h-3" /> Reprovado
              </span>
            )}
          </div>
          <p className="text-sm text-[#6B7280] mt-1">
            Receba PIX e cartão dos seus agendamentos e mensalidades <strong className="text-[#111827]">direto na sua conta</strong> via split automático do Asaas.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Verificando status…
        </div>
      )}

      {/* ─── Estado: NÃO conectado → form ─── */}
      {!isLoading && !connected && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
            <Building2 className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-blue-900 mb-1">É necessário possuir CNPJ (inclusive MEI)</div>
              <p className="text-xs text-blue-900 leading-relaxed">
                O CORTE opera exclusivamente com empresas com CNPJ ativo. Cada PIX/cartão cai direto na sua conta bancária via split automático — sem intermediário e sem repasse manual.
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="CNPJ" required>
              <input
                value={maskCNPJ(form.cpf_cnpj)}
                onChange={e => setForm({ ...form, cpf_cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
                className="w-full bg-white border border-black/10 rounded-lg px-3 py-2 text-sm"
              />
              {isCpf && (
                <p className="mt-1 text-[11px] text-red-700">
                  Para utilizar os recebimentos automáticos do O CORTE é necessário possuir um CNPJ ativo (MEI também é aceito). Caso precise de uma análise especial, entre em contato pelo WhatsApp.
                </p>
              )}
            </Field>
            <Field label="CEP" required>
              <input
                value={maskCEP(form.postal_code)}
                onChange={e => setForm({ ...form, postal_code: e.target.value })}
                placeholder="00000-000"
                className="w-full bg-white border border-black/10 rounded-lg px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Endereço" required className="sm:col-span-2">
              <input
                value={form.line1}
                onChange={e => setForm({ ...form, line1: e.target.value })}
                placeholder="Rua das Flores"
                className="w-full bg-white border border-black/10 rounded-lg px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Número" required>
              <input
                value={form.address_number}
                onChange={e => setForm({ ...form, address_number: e.target.value })}
                placeholder="123"
                className="w-full bg-white border border-black/10 rounded-lg px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Bairro" required>
              <input
                value={form.neighborhood}
                onChange={e => setForm({ ...form, neighborhood: e.target.value })}
                placeholder="Centro"
                className="w-full bg-white border border-black/10 rounded-lg px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Cidade" required>
              <input
                value={form.city}
                onChange={e => setForm({ ...form, city: e.target.value })}
                placeholder="São Paulo"
                className="w-full bg-white border border-black/10 rounded-lg px-3 py-2 text-sm"
              />
            </Field>
            <Field label="UF" required>
              <input
                value={form.state}
                onChange={e => setForm({ ...form, state: e.target.value.toUpperCase().slice(0, 2) })}
                placeholder="SP"
                maxLength={2}
                className="w-full bg-white border border-black/10 rounded-lg px-3 py-2 text-sm uppercase"
              />
            </Field>
          </div>

          {createMutation.isError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800">
              {String(createMutation.error?.message || 'Não foi possível criar sua conta. Verifique os dados e tente novamente.')}
            </div>
          )}

          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !isCnpj}
            className="inline-flex items-center gap-2 bg-[#2563EB] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-[#1d4ed8] disabled:opacity-50 transition-all shadow-[0_4px_12px_rgba(37,99,235,0.25)]"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
            Ativar pagamento online
          </button>
        </div>
      )}

      {/* ─── PENDING ─── */}
      {!isLoading && isPending && (
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="text-sm font-bold text-amber-900 mb-1">Conta criada — aguardando aprovação do Asaas</div>
            <p className="text-xs text-amber-800 leading-relaxed">
              Geralmente leva até 24h úteis. Você receberá um email do Asaas quando aprovado.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {status?.onboarding_url && (
              <a
                href={status.onboarding_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-amber-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-amber-600"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Completar cadastro
              </a>
            )}
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="inline-flex items-center gap-2 bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-100 border border-black/10"
            >
              {syncMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Atualizar status
            </button>
          </div>
        </div>
      )}

      {/* ─── ACTIVE ─── */}
      {!isLoading && isActive && (
        <div className="space-y-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="text-sm font-bold text-emerald-900 mb-1">Tudo pronto ✓</div>
            <p className="text-xs text-emerald-800 leading-relaxed">
              Sua barbearia está recebendo PIX direto na conta Asaas, com {status?.split_percentage ?? 100}% de repasse automático em cada transação.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            <MiniStat icon={Zap} label="PIX" value={status?.pix_enabled ? 'Ativo' : 'Inativo'} ok={status?.pix_enabled} />
            <MiniStat icon={Banknote} label="Repasse" value={`${status?.split_percentage ?? 100}%`} ok />
            <MiniStat icon={ShieldCheck} label="Status" value="Aprovado" ok />
          </div>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="inline-flex items-center gap-2 bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-gray-100 border border-black/10"
          >
            {syncMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
            Atualizar status
          </button>
        </div>
      )}

      {/* ─── REJECTED ─── */}
      {!isLoading && isRejected && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="text-sm font-bold text-red-900 mb-1">Cadastro reprovado pelo Asaas</div>
          <p className="text-xs text-red-800 leading-relaxed">
            Os dados informados não foram aprovados. Entre em contato com nosso suporte para revisar e reabrir o cadastro.
          </p>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[11px] uppercase tracking-wide font-semibold text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

function MiniStat({ icon: Icon, label, value, ok }) {
  return (
    <div className={`rounded-xl border p-3 ${ok ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-bold text-gray-600">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className={`text-sm font-black mt-0.5 ${ok ? 'text-emerald-700' : 'text-gray-700'}`}>{value}</div>
    </div>
  );
}