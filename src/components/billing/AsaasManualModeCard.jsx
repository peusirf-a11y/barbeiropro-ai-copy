// AsaasManualModeCard — exibido quando a barbearia é Pessoa Física (CPF).
// Asaas não permite subaccount para PF, então rodamos em modo "recebimento centralizado":
//   - O CORTE recebe os pagamentos na conta master
//   - Repasse para a barbearia é feito manualmente (PIX)
// Pagamentos PIX e cartão funcionam normalmente para o cliente final.

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Banknote, CheckCircle2, Loader2, Info, Clock } from 'lucide-react';

function maskCpf(v) {
  const d = String(v || '').replace(/\D+/g, '').slice(0, 11);
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export default function AsaasManualModeCard({ company, status, onActivated }) {
  const queryClient = useQueryClient();
  const [cpf, setCpf] = useState(company?.owner_cpf_cnpj || '');

  const isActive = company?.asaas_pix_enabled && company?.asaas_split_mode === 'manual';

  const activateMutation = useMutation({
    mutationFn: async () => {
      try {
        const res = await base44.functions.invoke('enableAsaasManualMode', {
          company_id: company.id,
          cpf_cnpj: cpf.replace(/\D+/g, ''),
        });
        if (res?.data?.error) throw new Error(res.data.message || res.data.error);
        return res.data;
      } catch (err) {
        const payload = err?.response?.data;
        const msg = payload?.message || payload?.error || err.message;
        throw new Error(msg || 'Falha ao ativar recebimento.');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['asaas-subaccount', company.id] });
      onActivated?.();
    },
  });

  return (
    <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-[var(--shadow-sm)] mb-4">
      <div className="flex items-start gap-4 mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-emerald-50' : 'bg-blue-50'}`}>
          <Banknote className={`w-5 h-5 ${isActive ? 'text-emerald-600' : 'text-[#2563EB]'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-[#111827]">Receba sem CNPJ</h2>
            {isActive && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" /> Ativo
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Repasse manual
            </span>
          </div>
          <p className="text-sm text-[#6B7280] mt-1">
            Comece a vender online agora mesmo usando PIX e cartão. Os pagamentos são recebidos pela O CORTE e <strong className="text-[#111827]">repassados manualmente</strong> para você.
          </p>
        </div>
      </div>

      {/* Como funciona */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
        <div className="text-sm font-bold text-blue-900 mb-2">Como funciona</div>
        <ol className="text-xs text-blue-900 space-y-1.5 list-decimal pl-4">
          <li>Seus clientes pagam PIX ou cartão pelo seu link de agendamento</li>
          <li>O dinheiro entra na conta master da O CORTE</li>
          <li>Toda semana, fazemos um PIX consolidado para você</li>
          <li>Quiser repasse automático direto? Abra um MEI ou CNPJ e ative o modo split</li>
        </ol>
      </div>

      {/* Stats / status */}
      {isActive ? (
        <div className="grid sm:grid-cols-3 gap-2 mb-2">
          <Stat icon={CheckCircle2} label="Status" value="Ativo" ok />
          <Stat icon={Banknote} label="Taxa" value="Apenas Asaas" />
          <Stat icon={Clock} label="Repasse" value="Semanal" />
        </div>
      ) : (
        <>
          <div className="mb-3">
            <label className="block">
              <span className="block text-[11px] uppercase tracking-wide font-semibold text-gray-600 mb-1">
                Seu CPF <span className="text-red-500">*</span>
              </span>
              <input
                value={maskCpf(cpf)}
                onChange={e => setCpf(e.target.value)}
                placeholder="000.000.000-00"
                className="w-full bg-white border border-black/10 rounded-lg px-3 py-2 text-sm"
              />
            </label>
          </div>

          {activateMutation.isError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800 mb-3">
              {activateMutation.error?.message || 'Não foi possível ativar. Verifique o CPF.'}
            </div>
          )}

          <button
            onClick={() => activateMutation.mutate()}
            disabled={activateMutation.isPending || cpf.replace(/\D+/g, '').length !== 11}
            className="inline-flex items-center gap-2 bg-[#2563EB] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-[#1d4ed8] disabled:opacity-50 transition-all shadow-[0_4px_12px_rgba(37,99,235,0.25)]"
          >
            {activateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
            Ativar recebimento online
          </button>
        </>
      )}

      <div className="mt-4 pt-4 border-t border-black/5 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
        <p className="text-[11px] text-gray-500 leading-relaxed">
          Para receber direto na sua conta com repasse automático em cada transação, é necessário CNPJ ou MEI. Após formalizar, você pode ativar o modo split a qualquer momento.
        </p>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, ok }) {
  return (
    <div className={`rounded-xl border p-3 ${ok ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-bold text-gray-600">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className={`text-sm font-black mt-0.5 ${ok ? 'text-emerald-700' : 'text-gray-700'}`}>{value}</div>
    </div>
  );
}