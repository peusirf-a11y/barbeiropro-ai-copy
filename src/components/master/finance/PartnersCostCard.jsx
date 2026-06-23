// PartnersCostCard — custo do programa de parceiros (comissões pagas + pendentes).
import { useNavigate } from 'react-router-dom';
import { Gift, ArrowRight, AlertCircle } from 'lucide-react';

const fmtMoney = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

export default function PartnersCostCard({ partners, mrr }) {
  const navigate = useNavigate();
  const pctOfMrr = mrr > 0 ? (partners?.paid_30d / mrr) * 100 : 0;

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-violet-50 ring-1 ring-violet-100 flex items-center justify-center text-violet-700">
            <Gift className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-lg tracking-tight">Programa de Parceiros</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Custo recorrente com indicações</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/master/partners')}
          className="text-xs font-semibold text-[#2563EB] hover:underline inline-flex items-center gap-1"
        >
          Gerenciar <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-muted/40 rounded-xl p-3 border border-border">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Pago em 30d</div>
          <div className="text-xl font-black text-foreground tracking-tight">{fmtMoney(partners?.paid_30d)}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{pctOfMrr.toFixed(1)}% do MRR</div>
        </div>
        <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-200">
          <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> A pagar
          </div>
          <div className="text-xl font-black text-foreground tracking-tight">{fmtMoney(partners?.pending)}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Aprovadas + em hold</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-3 border-t border-border text-xs">
        <span className="text-muted-foreground">Total já repassado</span>
        <span className="font-bold text-foreground">{fmtMoney(partners?.total_paid)} <span className="text-muted-foreground font-medium">· {partners?.commissions_paid_count || 0} comissões</span></span>
      </div>
    </div>
  );
}