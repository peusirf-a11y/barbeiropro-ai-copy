// ActivityFeedItem — uma linha do feed operacional do Master.
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Building2, Ban, AlertTriangle, Gift, UserPlus, ShieldAlert, ChevronRight,
} from 'lucide-react';

const TYPE_META = {
  company_created:    { icon: Building2,    color: 'emerald' },
  company_canceled:   { icon: Ban,          color: 'rose' },
  company_blocked:    { icon: Ban,          color: 'rose' },
  company_past_due:   { icon: AlertTriangle, color: 'amber' },
  commission_paid:    { icon: Gift,         color: 'violet' },
  partner_registered: { icon: UserPlus,     color: 'blue' },
};

const COLORS = {
  emerald: 'bg-emerald-50 ring-emerald-100 text-emerald-700',
  rose:    'bg-red-50 ring-red-100 text-red-700',
  amber:   'bg-amber-50 ring-amber-100 text-amber-700',
  violet:  'bg-violet-50 ring-violet-100 text-violet-700',
  blue:    'bg-blue-50 ring-blue-100 text-blue-700',
};

export default function ActivityFeedItem({ event }) {
  const navigate = useNavigate();
  const meta = TYPE_META[event.type] || { icon: ShieldAlert, color: 'rose' };
  const Icon = meta.icon;
  const colorClass = COLORS[meta.color];
  const ts = new Date(event.timestamp);

  return (
    <button
      onClick={() => event.link && navigate(event.link)}
      className="w-full flex items-start gap-3 p-4 hover:bg-muted/40 transition-colors text-left group"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ring-1 flex-shrink-0 ${colorClass}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-foreground">
              {event.title}
            </div>
            <div className="text-[13px] text-foreground/80 mt-0.5 truncate">
              {event.subject}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 truncate">
              {event.description}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(ts, { locale: ptBR, addSuffix: true })}
            </div>
            <div className="text-[10px] text-muted-foreground/70 mt-0.5 whitespace-nowrap">
              {format(ts, "d/MM 'às' HH:mm", { locale: ptBR })}
            </div>
          </div>
        </div>
      </div>
      {event.link && (
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground flex-shrink-0 mt-1" />
      )}
    </button>
  );
}