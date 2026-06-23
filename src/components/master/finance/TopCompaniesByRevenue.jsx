// TopCompaniesByRevenue — ranking das 10 empresas que mais geram MRR.
import { useNavigate } from 'react-router-dom';
import { Trophy, ChevronRight } from 'lucide-react';

const fmtMoney = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

export default function TopCompaniesByRevenue({ companies = [] }) {
  const navigate = useNavigate();

  if (companies.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 text-center shadow-[var(--shadow-sm)]">
        <Trophy className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
        <div className="text-sm font-semibold text-foreground">Sem empresas pagantes</div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-[var(--shadow-sm)]">
      <div className="p-4 sm:p-5 border-b border-border flex items-center gap-2">
        <Trophy className="w-4 h-4 text-amber-600" />
        <div>
          <h3 className="font-bold text-foreground text-lg tracking-tight">Top empresas por MRR</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Quem mais contribui para a receita recorrente</p>
        </div>
      </div>
      <div className="divide-y divide-border">
        {companies.map((c, idx) => (
          <button
            key={c.id}
            onClick={() => navigate(`/master/barbearias/${c.id}`)}
            className="w-full flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors text-left"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs flex-shrink-0 ${
              idx === 0 ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' :
              idx === 1 ? 'bg-gray-100 text-gray-700 ring-1 ring-gray-200' :
              idx === 2 ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-200' :
              'bg-muted text-muted-foreground'
            }`}>
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-foreground truncate">{c.name}</div>
              <div className="text-[11px] text-muted-foreground truncate">
                {c.plan_name} · {c.owner_email || 'sem email'}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-sm font-black text-foreground">{fmtMoney(c.mrr)}</div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">/mês</div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}