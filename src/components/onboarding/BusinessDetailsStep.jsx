// Etapa do onboarding que coleta dados fiscais (tipo de negócio) + endereço
// estruturado + telefone comercial. Esses dados são usados para pré-preencher
// o KYC da conta Stripe Connect, reduzindo o número de campos que o usuário
// precisa preencher no portal do Stripe.

import { AlertCircle } from 'lucide-react';

const BUSINESS_TYPES = [
  { value: 'mei', label: 'MEI', sub: 'Microempreendedor Individual' },
  { value: 'cnpj', label: 'CNPJ', sub: 'Empresa registrada' },
  { value: 'individual', label: 'Pessoa Física', sub: 'Autônomo sem CNPJ' },
];

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

function maskCep(v) {
  return String(v || '').replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
}

export default function BusinessDetailsStep({ value, onChange }) {
  // value = { business_type, phone, address_details: { line1, line2, neighborhood, city, state, postal_code } }
  const addr = value.address_details || {};
  const setAddr = (k, v) => onChange({ ...value, address_details: { ...addr, [k]: v } });

  return (
    <div className="space-y-5">
      {/* Tipo de negócio */}
      <div>
        <label className="text-xs font-semibold text-gray-500 block mb-2">Tipo de negócio *</label>
        <div className="grid grid-cols-3 gap-2">
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
        <span>Esses dados são usados para pré-preencher o cadastro Stripe e agilizar a liberação de pagamentos.</span>
      </div>
    </div>
  );
}

// Validador exportado — reaproveitado pelo Onboarding para travar o botão "Continuar"
export function isBusinessDetailsValid(v) {
  if (!v?.business_type) return false;
  if (!v?.phone || v.phone.replace(/\D/g, '').length < 10) return false;
  const a = v.address_details || {};
  if (!a.line1 || !a.neighborhood || !a.city || !a.state) return false;
  if (!a.postal_code || a.postal_code.replace(/\D/g, '').length !== 8) return false;
  return true;
}