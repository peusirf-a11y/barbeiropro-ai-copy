// Formulário inline de cartão de crédito (Asaas) — tokenização nativa.
// O cartão é enviado ao backend, que chama /creditCard/tokenize no Asaas.
// Nada é persistido localmente — após a tokenização, o backend usa o token
// para criar a Subscription (plano) ou cobrar o Payment (booking).
//
// Props:
//   onSubmit(cardData) → função async que recebe os dados e dispara a cobrança.
//                        Deve retornar uma Promise que resolve/rejeita com erro humano.
//   primaryColor       → cor do botão de ação.
//   amountLabel        → texto exibido no botão (ex: "Pagar R$ 29,00")
//   title              → título do formulário (opcional)
//   showCpf            → se true, exibe campo de CPF (default true)
//   defaultCpf         → CPF pré-preenchido (quando vier do perfil)
//   defaultName        → nome titular pré-preenchido

import { useState } from 'react';
import { Loader2, CreditCard, Shield, AlertCircle } from 'lucide-react';

function onlyDigits(v) { return String(v || '').replace(/\D+/g, ''); }
function maskCard(v) {
  const d = onlyDigits(v).slice(0, 19);
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}
function maskExpiry(v) {
  const d = onlyDigits(v).slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}
function maskCpf(v) {
  return onlyDigits(v).slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}
function maskCep(v) {
  return onlyDigits(v).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
}
function maskPhone(v) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

export default function CardPaymentFormAsaas({
  onSubmit,
  primaryColor = '#2563EB',
  amountLabel = 'Pagar agora',
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
    cpf: defaultCpf || '',
    email: defaultEmail || '',
    phone: defaultPhone || '',
    postalCode: defaultPostalCode || '',
    addressNumber: defaultAddressNumber || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const isValid = () => {
    if (!form.holderName.trim()) return false;
    if (onlyDigits(form.number).length < 13) return false;
    const [mm, yy] = form.expiry.split('/');
    if (!mm || !yy || mm.length !== 2 || yy.length !== 2) return false;
    if (form.cvv.length < 3) return false;
    if (showCpf && onlyDigits(form.cpf).length !== 11) return false;
    if (onlyDigits(form.postalCode).length !== 8) return false;
    if (!form.addressNumber.trim()) return false;
    return true;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
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
        expiryYear: `20${yy}`,
        ccv: form.cvv,
        cpfCnpj: onlyDigits(form.cpf),
        email: form.email.trim() || undefined,
        phone: onlyDigits(form.phone) || undefined,
        postalCode: onlyDigits(form.postalCode),
        addressNumber: form.addressNumber.trim(),
      });
    } catch (err) {
      setError(err?.message || 'Falha ao processar o pagamento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {title && (
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="w-4 h-4 text-gray-400" />
          <span className="text-[11px] uppercase font-bold text-gray-500 tracking-wide">{title}</span>
        </div>
      )}

      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3">
        <Shield className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-[12px] text-blue-900 leading-relaxed">
          Seus dados são criptografados e processados diretamente pelo Asaas (PCI compliance). Não armazenamos cartão.
        </p>
      </div>

      <Field label="Nome impresso no cartão" required>
        <input
          type="text"
          value={form.holderName}
          onChange={e => set('holderName', e.target.value.toUpperCase())}
          autoComplete="cc-name"
          placeholder="COMO ESTÁ NO CARTÃO"
          className="w-full px-4 py-3 border border-black/10 rounded-xl text-sm bg-white"
        />
      </Field>

      <Field label="Número do cartão" required>
        <input
          type="text"
          inputMode="numeric"
          value={form.number}
          onChange={e => set('number', maskCard(e.target.value))}
          autoComplete="cc-number"
          placeholder="0000 0000 0000 0000"
          className="w-full px-4 py-3 border border-black/10 rounded-xl text-sm bg-white font-mono tracking-wider"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Validade" required>
          <input
            type="text"
            inputMode="numeric"
            value={form.expiry}
            onChange={e => set('expiry', maskExpiry(e.target.value))}
            autoComplete="cc-exp"
            placeholder="MM/AA"
            maxLength={5}
            className="w-full px-4 py-3 border border-black/10 rounded-xl text-sm bg-white font-mono tracking-wider"
          />
        </Field>
        <Field label="CVV" required>
          <input
            type="text"
            inputMode="numeric"
            value={form.cvv}
            onChange={e => set('cvv', onlyDigits(e.target.value).slice(0, 4))}
            autoComplete="cc-csc"
            placeholder="000"
            className="w-full px-4 py-3 border border-black/10 rounded-xl text-sm bg-white font-mono tracking-wider"
          />
        </Field>
      </div>

      {showCpf && (
        <Field label="CPF do titular" required>
          <input
            type="text"
            inputMode="numeric"
            value={form.cpf}
            onChange={e => set('cpf', maskCpf(e.target.value))}
            placeholder="000.000.000-00"
            className="w-full px-4 py-3 border border-black/10 rounded-xl text-sm bg-white"
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="CEP" required>
          <input
            type="text"
            inputMode="numeric"
            value={form.postalCode}
            onChange={e => set('postalCode', maskCep(e.target.value))}
            placeholder="00000-000"
            className="w-full px-4 py-3 border border-black/10 rounded-xl text-sm bg-white"
          />
        </Field>
        <Field label="Número" required>
          <input
            type="text"
            value={form.addressNumber}
            onChange={e => set('addressNumber', e.target.value.slice(0, 10))}
            placeholder="123"
            className="w-full px-4 py-3 border border-black/10 rounded-xl text-sm bg-white"
          />
        </Field>
      </div>

      <Field label="Celular (opcional)">
        <input
          type="tel"
          inputMode="numeric"
          value={form.phone}
          onChange={e => set('phone', maskPhone(e.target.value))}
          placeholder="(11) 90000-0000"
          className="w-full px-4 py-3 border border-black/10 rounded-xl text-sm bg-white"
        />
      </Field>

      {error && (
        <div className="flex items-start gap-2 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !isValid()}
        className="w-full text-white font-bold py-4 rounded-2xl text-sm transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-md inline-flex items-center justify-center gap-2"
        style={{ backgroundColor: primaryColor }}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
        {loading ? 'Processando…' : amountLabel}
      </button>
    </form>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wide font-bold text-gray-500 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}