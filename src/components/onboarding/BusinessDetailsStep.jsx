// Etapa do onboarding que coleta dados fiscais (tipo de negócio + CNPJ) +
// endereço estruturado + telefone comercial. Esses dados são usados para
// pré-preencher a subaccount Asaas, reduzindo retrabalho.
//
// POLÍTICA: O CORTE opera exclusivamente com CNPJ/MEI.
// Se o usuário digitar 11 dígitos (CPF), bloqueamos o avanço e exibimos
// orientação para contato comercial.

import { AlertCircle, Building2 } from 'lucide-react';

// PJ-only policy (docs/PJ_ONLY_POLICY.md): cadastro automatizado disponível
// apenas para MEI ou CNPJ. Atendimento PF é manual via equipe comercial.
const BUSINESS_TYPES = [
  { value: 'mei', label: 'MEI', sub: 'Microempreendedor Individual' },
  { value: 'cnpj', label: 'CNPJ', sub: 'Empresa registrada' },
];

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

function maskCep(v) {
  return String(v || '').replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
}

function maskCNPJ(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2}\.\d{3})(\d)/, '$1.$2')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export default function BusinessDetailsStep({ value, onChange }) {
  // value = { business_type, phone, owner_cpf_cnpj, address_details: {...} }
  const addr = value.address_details || {};
  const setAddr = (k, v) => onChange({ ...value, address_details: { ...addr, [k]: v } });
  const docDigits = String(value.owner_cpf_cnpj || '').replace(/\D/g, '');
  const isCpf = docDigits.length === 11;
  const isCnpj = docDigits.length === 14;

  return (
    <div className="space-y-5">
      {/* Tipo de negócio */}
      <div>
        <label className="text-xs font-semibold text-gray-500 block mb-2">Tipo de negócio *</label>
        <div className="grid grid-cols-2 gap-2">
          {BUSINESS_TYPES.map(t => {
            const active = value.business_type === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => onChange({ ...value, business_type: t.value })}
                className={`text-left p-3 rounded-xl border transition-all ${
                  active ? 'border-2 border-[#2563EB] bg-[#2563EB]/5' : 'border-black/10 bg-white hover:border-gray-300'
                }`}
              >
                <div className={`font-bold text-sm ${active ? 'text-[#2563EB]' : 'text-[#1B1C1E]'}`}>{t.label}</div>
                <div className="text-[11px] text-gray-500 mt-0.5 leading-tight">{t.sub}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* CNPJ */}
      <div>
        <label className="text-xs font-semibold text-gray-500 block mb-1">CNPJ *</label>
        <input
          type="text"
          value={maskCNPJ(value.owner_cpf_cnpj || '')}
          onChange={e => onChange({ ...value, owner_cpf_cnpj: e.target.value })}
          placeholder="00.000.000/0000-00"
          className={`w-full px-4 py-3 border rounded-xl text-sm bg-white ${
            isCpf ? 'border-red-400' : 'border-black/10'
          }`}
        />
        {isCpf && (
          <div className="mt-2 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
            <Building2 className="w-4 h-4 text-red-700 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-red-800 leading-relaxed">
              Para utilizar os recebimentos automáticos do O CORTE é necessário possuir um <strong>CNPJ ativo</strong> (MEI também é aceito). Caso precise de uma análise especial, entre em contato pelo WhatsApp.
            </p>
          </div>
        )}
        {!isCpf && !isCnpj && (value.owner_cpf_cnpj || '').length > 0 && (
          <p className="text-[11px] text-gray-500 mt-1">Digite os 14 dígitos do seu CNPJ.</p>
        )}
      </div>

      {/* Telefone comercial */}
      <div>
        <label className="text-xs font-semibold text-gray-500 block mb-1">Telefone comercial *</label>
        <input
          type="tel"
          value={value.phone || ''}
          onChange={e => onChange({ ...value, phone: e.target.value })}
          placeholder="(11) 99999-9999"
          className="w-full px-4 py-3 border border-black/10 rounded-xl text-sm bg-white"
        />
      </div>

      {/* Endereço estruturado */}
      <div className="bg-white rounded-xl border border-black/10 p-4 space-y-3">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Endereço *</div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">CEP</label>
          <input
            type="text"
            value={addr.postal_code || ''}
            onChange={e => setAddr('postal_code', maskCep(e.target.value))}
            placeholder="00000-000"
            maxLength={9}
            className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm bg-white"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs text-gray-500 block mb-1">Rua e número</label>
            <input
              type="text"
              value={addr.line1 || ''}
              onChange={e => setAddr('line1', e.target.value)}
              placeholder="Rua das Flores, 123"
              className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm bg-white"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Complemento</label>
            <input
              type="text"
              value={addr.line2 || ''}
              onChange={e => setAddr('line2', e.target.value)}
              placeholder="Sala 2 (opcional)"
              className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Bairro</label>
            <input
              type="text"
              value={addr.neighborhood || ''}
              onChange={e => setAddr('neighborhood', e.target.value)}
              className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm bg-white"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Cidade</label>
            <input
              type="text"
              value={addr.city || ''}
              onChange={e => setAddr('city', e.target.value)}
              className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm bg-white"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Estado</label>
            <select
              value={addr.state || ''}
              onChange={e => setAddr('state', e.target.value)}
              className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm bg-white"
            >
              <option value="">UF</option>
              {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 text-[11px] text-gray-500">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>Esses dados são usados para criar sua subaccount Asaas e habilitar o split automático dos recebimentos.</span>
      </div>
    </div>
  );
}

// Validador exportado — reaproveitado pelo Onboarding para travar o botão "Continuar"
export function isBusinessDetailsValid(v) {
  if (!v?.business_type) return false;
  if (!v?.phone || v.phone.replace(/\D/g, '').length < 10) return false;
  // O CORTE exige CNPJ válido (14 dígitos) — bloqueia avanço com CPF ou vazio.
  const docDigits = String(v?.owner_cpf_cnpj || '').replace(/\D/g, '');
  if (docDigits.length !== 14) return false;
  const a = v.address_details || {};
  if (!a.line1 || !a.neighborhood || !a.city || !a.state) return false;
  if (!a.postal_code || a.postal_code.replace(/\D/g, '').length !== 8) return false;
  return true;
}