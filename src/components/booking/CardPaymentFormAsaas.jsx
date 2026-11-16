// Formulário inline de cartão de crédito (Asaas) — tokenização e validação nativa.
// Suporta detecção de bandeira em tempo real, máscara dinâmica de CPF/CNPJ,
// validação de validade (MM/AA) e CVV.

import { useState } from 'react';
import { Loader2, CreditCard, Shield, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getThemeAccent } from '@/lib/colorUtils';

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
  isDark,
}) {
  const accent = getThemeAccent(primaryColor, Boolean(isDark));
  const usePublicFlag = typeof isDark === 'boolean';
  const labelCls = usePublicFlag
    ? `block text-[11px] uppercase tracking-wide font-bold mb-1.5 ${isDark ? 'text-slate-300' : 'text-gray-600'}`
    : 'block text-[11px] uppercase tracking-wide font-bold text-gray-600 dark:text-slate-300 mb-1.5';
  const inputBaseCls = usePublicFlag
    ? (isDark
        ? 'bg-[#0F101A] border-[#232538] text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
        : 'bg-white border-black/15 text-[#0F172A] placeholder:text-gray-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600')
    : 'bg-white dark:bg-[#0D1326] border-black/15 dark:border-white/15 text-[#0F172A] dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:border-blue-600 focus:ring-1 focus:ring-blue-600';
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
          <CreditCard className={`w-4 h-4 ${usePublicFlag ? (isDark ? 'text-slate-400' : 'text-gray-500') : 'text-gray-500 dark:text-slate-400'}`} />
          <span className={`text-[11px] uppercase font-bold tracking-wide ${usePublicFlag ? (isDark ? 'text-slate-200' : 'text-gray-700') : 'text-gray-700 dark:text-slate-200'}`}>{title}</span>
        </div>
      )}

      {/* Alerta de Segurança */}
      <div className={`flex items-start gap-2.5 border rounded-2xl p-3.5 shadow-sm ${
        usePublicFlag
          ? (isDark ? 'bg-blue-500/10 border-blue-500/25' : 'bg-blue-50 border-blue-200/80')
          : 'bg-blue-50 dark:bg-blue-500/10 border-blue-200/80 dark:border-blue-500/25'
      }`}>
        <Shield className={`w-4 h-4 flex-shrink-0 mt-0.5 ${usePublicFlag ? (isDark ? 'text-blue-400' : 'text-blue-600') : 'text-blue-600 dark:text-blue-400'}`} />
        <div className={`text-[12px] leading-relaxed ${usePublicFlag ? (isDark ? 'text-blue-100' : 'text-blue-950') : 'text-blue-950 dark:text-blue-100'}`}>
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
        <label className={labelCls}>
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
            className={`w-full pl-4 pr-24 py-3 border rounded-xl text-sm font-mono tracking-wider focus:outline-none ${inputBaseCls}`}
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
        <label className={labelCls}>
          Nome Impresso no Cartão <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.holderName}
          onChange={e => set('holderName', e.target.value.toUpperCase())}
          autoComplete="cc-name"
          placeholder="EX: JOAO SOUZA SILVA"
          className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none ${inputBaseCls}`}
        />
      </div>

      {/* Validade e CVV */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>
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
            className={`w-full px-4 py-3 border rounded-xl text-sm font-mono tracking-wider focus:outline-none ${inputBaseCls}`}
          />
        </div>
        <div>
          <label className={labelCls}>
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
            className={`w-full px-4 py-3 border rounded-xl text-sm font-mono tracking-wider focus:outline-none ${inputBaseCls}`}
          />
        </div>
      </div>

      {/* CPF/CNPJ e Telefone do Titular */}
      {showCpf && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>
              CPF ou CNPJ do Titular <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={form.cpf}
              onChange={e => set('cpf', maskCpfCnpj(e.target.value))}
              placeholder="000.000.000-00"
              maxLength={18}
              className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none ${inputBaseCls}`}
            />
          </div>
          <div>
            <label className={labelCls}>
              Telefone do Titular
            </label>
            <input
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="(11) 99999-9999"
              maxLength={16}
              className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none ${inputBaseCls}`}
            />
          </div>
        </div>
      )}

      {/* Mensagem de Erro de Cartão / Recusa */}
      {error && (
        <div className={`flex items-start gap-2.5 p-3.5 border rounded-xl text-xs animate-shake ${
          usePublicFlag
            ? (isDark ? 'bg-red-500/15 border-red-500/30 text-red-200' : 'bg-red-50 border-red-200 text-red-700')
            : 'bg-red-50 dark:bg-red-500/15 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-200'
        }`}>
          <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${usePublicFlag ? (isDark ? 'text-red-400' : 'text-red-600') : 'text-red-600 dark:text-red-400'}`} />
          <div className="flex-1 font-medium leading-relaxed">{error}</div>
        </div>
      )}

      {/* Botão de Envio com Bloqueio Seguro */}
      <button
        type="submit"
        disabled={loading || !isValid()}
        className="w-full font-bold py-4 rounded-2xl text-sm transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-md inline-flex items-center justify-center gap-2 cursor-pointer"
        style={{ backgroundColor: accent.bg, color: accent.fg }}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: accent.fg }} />
            <span style={{ color: accent.fg }}>Validando cartão no Asaas…</span>
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4" style={{ color: accent.fg }} />
            <span style={{ color: accent.fg }}>{amountLabel}</span>
          </>
        )}
      </button>

      <div className={`flex items-center justify-center gap-2 text-[11px] text-center pt-1 ${usePublicFlag ? (isDark ? 'text-slate-400' : 'text-gray-400') : 'text-gray-400 dark:text-slate-400'}`}>
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        <span>Ambiente criptografado seguro com conformidade PCI-DSS</span>
      </div>
    </form>
  );
}