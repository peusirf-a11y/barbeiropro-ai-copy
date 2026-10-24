// Formulário inline de cartão de crédito (Asaas) — tokenização e validação nativa.
// Suporta detecção de bandeira em tempo real, máscara dinâmica de CPF/CNPJ,
// validação de validade (MM/AA) e CVV.

import { useState } from 'react';
import { Loader2, CreditCard, Shield, AlertCircle, CheckCircle2 } from 'lucide-react';

function onlyDigits(v) {
  return String(v || '').replace(/\D+/g, '');
}

function maskCard(v) {
  const d = onlyDigits(v).slice(0, 19);
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function maskExpiry(v) {
  const d = onlyDigits(v).slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

export function maskCpfCnpj(v) {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function detectCardBrand(num) {
  const clean = onlyDigits(num);
  if (!clean) return null;
  if (/^4/.test(clean)) return { name: 'Visa', color: 'bg-blue-600 text-white' };
  if (/^(5[1-5]|2[2-7])/.test(clean)) return { name: 'Mastercard', color: 'bg-red-600 text-white' };
  if (/^(4011|4389|5041|5067|6362|6363|6277|6504|6507|6509|6516|6550)/.test(clean)) {
    return { name: 'Elo', color: 'bg-yellow-600 text-white' };
  }
  if (/^3[47]/.test(clean)) return { name: 'Amex', color: 'bg-emerald-600 text-white' };
  if (/^6062/.test(clean)) return { name: 'Hipercard', color: 'bg-rose-700 text-white' };
  return { name: 'Cartão', color: 'bg-gray-700 text-white' };
}

export default function CardPaymentFormAsaas({
  onSubmit,
  primaryColor = '#2563EB',
  amountLabel = 'Iniciar 7 dias grátis',
  title,
  showCpf = true,
  defaultCpf = '',
  defaultName = '',
  defaultEmail = '',
  defaultPhone = '',
  defaultPostalCode = '',
  defaultAddressNumber = '',
}) {
  const [form, setForm] = useState({
    holderName: defaultName || '',
    number: '',
    expiry: '',
    cvv: '',
    cpf: defaultCpf ? maskCpfCnpj(defaultCpf) : '',
    email: defaultEmail || '',
    phone: defaultPhone || '',
    postalCode: defaultPostalCode || '01310-100',
    addressNumber: defaultAddressNumber || '100',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => {
    setError('');
    setForm(p => ({ ...p, [k]: v }));
  };

  const cardBrand = detectCardBrand(form.number);

  const validateExpiry = () => {
    const parts = form.expiry.split('/');
    if (parts.length !== 2) return 'Validade incompleta. Use MM/AA.';
    const [mm, yy] = parts;
    if (!mm || !yy || mm.length !== 2 || yy.length !== 2) return 'Validade incompleta. Use MM/AA.';
    const month = parseInt(mm, 10);
    const year = 2000 + parseInt(yy, 10);
    if (Number.isNaN(month) || month < 1 || month > 12) return 'Mês da validade inválido (use 01-12).';
    const now = new Date();
    const exp = new Date(year, month, 0, 23, 59, 59);
    if (exp < now) return 'Cartão vencido.';
    return null;
  };

  const isValid = () => {
    if (!form.holderName.trim()) return false;
    const numDigits = onlyDigits(form.number).length;
    if (numDigits < 13 || numDigits > 19) return false;
    if (validateExpiry()) return false;
    if (form.cvv.length < 3) return false;
    const docDigits = onlyDigits(form.cpf).length;
    if (showCpf && (docDigits !== 11 && docDigits !== 14)) return false;
    return true;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const expErr = validateExpiry();
    if (expErr) {
      setError(expErr);
      return;
    }
    const docDigits = onlyDigits(form.cpf).length;
    if (showCpf && (docDigits !== 11 && docDigits !== 14)) {
      setError('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido para o titular.');
      return;
    }
    if (!isValid()) {
      setError('Confira os dados do cartão antes de continuar.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const [mm, yy] = form.expiry.split('/');
      await onSubmit({
        holderName: form.holderName.trim(),
        number: onlyDigits(form.number),
        expiryMonth: mm,
        expiryYear: yy.length === 2 ? `20${yy}` : yy,
        ccv: form.cvv.trim(),
        cpfCnpj: onlyDigits(form.cpf),
        email: form.email.trim() || undefined,
        phone: onlyDigits(form.phone) || undefined,
        postalCode: onlyDigits(form.postalCode) || '01310100',
        addressNumber: form.addressNumber.trim() || '100',
      });
    } catch (err) {
      console.warn('[CardPaymentFormAsaas] Erro recebido:', err);
      setError(
        err?.message ||
        'Cartão não autorizado ou dados inválidos. Verifique as informações ou utilize outro cartão.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {title && (
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="w-4 h-4 text-gray-500" />
          <span className="text-[11px] uppercase font-bold text-gray-700 tracking-wide">{title}</span>
        </div>
      )}

      {/* Alerta de Segurança */}
      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200/80 rounded-2xl p-3.5 shadow-sm">
        <Shield className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-[12px] text-blue-950 leading-relaxed">
          {String(amountLabel || '').toLowerCase().includes('grátis') ? (
            <>
              <strong>7 dias grátis.</strong> Cancele quando quiser. A primeira fatura só será debitada em 7 dias após a validação do cartão.
            </>
          ) : String(amountLabel || '').toLowerCase().includes('assinar') || String(amountLabel || '').toLowerCase().includes('/mês') ? (
            <>
              <strong>Assinatura mensal no cartão via Asaas.</strong> Seu plano é ativado na hora após a aprovação do cartão.
            </>
          ) : (
            <>
              <strong>Pagamento seguro via Asaas.</strong> Seu agendamento é confirmado imediatamente após a aprovação do cartão.
            </>
          )}
        </div>
      </div>

      {/* Número do Cartão com Detecção de Bandeira */}
      <div>
        <label className="block text-[11px] uppercase tracking-wide font-bold text-gray-600 mb-1.5">
          Número do Cartão <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            value={form.number}
            onChange={e => set('number', maskCard(e.target.value))}
            autoComplete="cc-number"
            placeholder="0000 0000 0000 0000"
            style={{ color: '#0F172A', backgroundColor: '#FFFFFF', WebkitTextFillColor: '#0F172A' }}
            className="w-full pl-4 pr-24 py-3 border border-black/15 rounded-xl text-sm font-mono tracking-wider placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          />
          {cardBrand && form.number.length >= 2 && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${cardBrand.color}`}>
                {cardBrand.name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Nome Impresso */}
      <div>
        <label className="block text-[11px] uppercase tracking-wide font-bold text-gray-600 mb-1.5">
          Nome Impresso no Cartão <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.holderName}
          onChange={e => set('holderName', e.target.value.toUpperCase())}
          autoComplete="cc-name"
          placeholder="EX: JOAO SOUZA SILVA"
          style={{ color: '#0F172A', backgroundColor: '#FFFFFF', WebkitTextFillColor: '#0F172A' }}
          className="w-full px-4 py-3 border border-black/15 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
        />
      </div>

      {/* Validade e CVV */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] uppercase tracking-wide font-bold text-gray-600 mb-1.5">
            Validade (MM/AA) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={form.expiry}
            onChange={e => set('expiry', maskExpiry(e.target.value))}
            autoComplete="cc-exp"
            placeholder="MM/AA"
            maxLength={5}
            style={{ color: '#0F172A', backgroundColor: '#FFFFFF', WebkitTextFillColor: '#0F172A' }}
            className="w-full px-4 py-3 border border-black/15 rounded-xl text-sm font-mono tracking-wider placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-wide font-bold text-gray-600 mb-1.5">
            CVV <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={form.cvv}
            onChange={e => set('cvv', onlyDigits(e.target.value).slice(0, 4))}
            autoComplete="cc-csc"
            placeholder="3 ou 4 dígitos"
            maxLength={4}
            style={{ color: '#0F172A', backgroundColor: '#FFFFFF', WebkitTextFillColor: '#0F172A' }}
            className="w-full px-4 py-3 border border-black/15 rounded-xl text-sm font-mono tracking-wider placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          />
        </div>
      </div>

      {/* CPF/CNPJ e Telefone do Titular */}
      {showCpf && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wide font-bold text-gray-600 mb-1.5">
              CPF ou CNPJ do Titular <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={form.cpf}
              onChange={e => set('cpf', maskCpfCnpj(e.target.value))}
              placeholder="000.000.000-00"
              maxLength={18}
              style={{ color: '#0F172A', backgroundColor: '#FFFFFF', WebkitTextFillColor: '#0F172A' }}
              className="w-full px-4 py-3 border border-black/15 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wide font-bold text-gray-600 mb-1.5">
              Telefone do Titular
            </label>
            <input
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="(11) 99999-9999"
              maxLength={16}
              style={{ color: '#0F172A', backgroundColor: '#FFFFFF', WebkitTextFillColor: '#0F172A' }}
              className="w-full px-4 py-3 border border-black/15 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
          </div>
        </div>
      )}

      {/* Mensagem de Erro de Cartão / Recusa */}
      {error && (
        <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs animate-shake">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
          <div className="flex-1 font-medium leading-relaxed">{error}</div>
        </div>
      )}

      {/* Botão de Envio com Bloqueio Seguro */}
      <button
        type="submit"
        disabled={loading || !isValid()}
        className="w-full font-bold py-4 rounded-2xl text-sm transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-md inline-flex items-center justify-center gap-2 cursor-pointer"
        style={{ backgroundColor: primaryColor, color: '#FFFFFF' }}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-white" />
            <span className="text-white">Validando cartão no Asaas…</span>
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4 text-white" />
            <span className="text-white">{amountLabel}</span>
          </>
        )}
      </button>

      <div className="flex items-center justify-center gap-2 text-[11px] text-gray-400 text-center pt-1">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        <span>Ambiente criptografado seguro com conformidade PCI-DSS</span>
      </div>
    </form>
  );
}