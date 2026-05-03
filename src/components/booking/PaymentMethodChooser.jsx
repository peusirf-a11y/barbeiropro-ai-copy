// Toggle no fluxo público: usar plano (assinatura) vs pagar online (Pix/Cartão).
// Aparece apenas quando o cliente identificado tem assinatura ativa com saldo.

import { Check, Infinity, CreditCard, AlertTriangle } from 'lucide-react';

export default function PaymentMethodChooser({ subscription, value, onChange, primaryColor, blocker }) {
  const isUnlimited = subscription.plan_type_snapshot === 'unlimited';
  const remaining = subscription.uses_remaining ?? 0;
  const blocked = !!blocker;

  return (
    <div className="bg-white rounded-2xl border border-black/8 p-4 mb-4">
      <div className="text-[11px] uppercase font-bold text-gray-500 tracking-wide mb-3">Como pagar</div>

      <div className="space-y-2">
        <Option
          active={value === 'subscription'}
          disabled={blocked}
          primaryColor={primaryColor}
          onClick={() => !blocked && onChange('subscription')}
          title={`Usar meu plano · ${subscription.plan_name_snapshot}`}
          subtitle={isUnlimited
            ? <span className="flex items-center gap-1">Ilimitado <Infinity className="w-3 h-3" /></span>
            : `${remaining} ${remaining === 1 ? 'uso restante' : 'usos restantes'} este mês`}
        />
        <Option
          active={value === 'avulso'}
          primaryColor={primaryColor}
          onClick={() => onChange('avulso')}
          title="Pagar online"
          subtitle="Pix ou cartão na próxima etapa"
          icon={CreditCard}
        />
      </div>

      {blocked && (
        <div className="mt-3 flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p className="text-[12px] leading-relaxed">{blocker}</p>
        </div>
      )}
    </div>
  );
}

function Option({ active, disabled, primaryColor, onClick, title, subtitle, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${
        active ? 'border-2 shadow-sm' : 'border-black/10 hover:border-gray-300'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      style={active ? { borderColor: primaryColor, backgroundColor: `${primaryColor}08` } : {}}
    >
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: active ? primaryColor : '#F3F4F6' }}>
        {active ? <Check className="w-4 h-4 text-white" /> : Icon ? <Icon className="w-4 h-4 text-gray-500" /> : <span className="w-2 h-2 rounded-full bg-gray-300" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm text-[#1B1C1E] truncate">{title}</div>
        <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>
      </div>
    </button>
  );
}