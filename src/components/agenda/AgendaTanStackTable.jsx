// AgendaTanStackTable.jsx — Tabela Executiva de Agendamentos montada com TanStack Table (@tanstack/react-table)
// Design System: Premium Business SaaS + Business Intelligence
// Superfície: #FFFFFF | Borda: #E5E7EF | Tipografia: tabular-nums | Ícones: Lucide strokeWidth=1.75
import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import {
  Clock,
  User,
  Search,
  ExternalLink,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { STATUS_TOKENS } from '@/lib/statusTokens';
import AppointmentNoteIcon from '@/components/agenda/AppointmentNoteIcon';

export default function AgendaTanStackTable({
  appointments = [],
  onCardClick,
}) {
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState([]);

  // Filtragem local por termo de busca
  const filteredData = useMemo(() => {
    if (!search.trim()) return appointments;
    const q = search.toLowerCase();
    return appointments.filter(
      (a) =>
        (a.customer_name && a.customer_name.toLowerCase().includes(q)) ||
        (a.service_name && a.service_name.toLowerCase().includes(q)) ||
        (a.professional_name && a.professional_name.toLowerCase().includes(q)) ||
        (a.customer_phone && a.customer_phone.includes(q))
    );
  }, [appointments, search]);

  const columns = useMemo(
    () => [
      {
        id: 'time',
        header: 'Horário',
        accessorFn: (row) => row.scheduled_at,
        cell: ({ row }) => {
          const a = row.original;
          const d = a.scheduled_at ? new Date(a.scheduled_at) : null;
          return (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-300 border border-[#DBEAFE] dark:border-blue-800/40 flex items-center justify-center font-bold text-xs flex-shrink-0">
                <Clock className="w-4 h-4" strokeWidth={1.75} />
              </div>
              <div className="leading-tight">
                <div className="font-extrabold text-sm text-[#171827] dark:text-white tabular-nums">
                  {d ? format(d, 'HH:mm') : '—'}
                </div>
                <div className="text-[10px] text-[#59658F] dark:text-[#7E8BAF] tabular-nums font-semibold">
                  {d ? format(d, 'dd/MM/yyyy') : '—'}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        id: 'customer',
        header: 'Cliente',
        accessorKey: 'customer_name',
        cell: ({ row }) => {
          const a = row.original;
          return (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-[#171827] dark:text-white truncate">
                  {a.customer_name || 'Cliente Avulso'}
                </span>
                {a.notes && <AppointmentNoteIcon notes={a.notes} />}
              </div>
              {a.customer_phone && (
                <div className="text-[11px] text-[#55596A] dark:text-[#8F9BBF] font-mono tabular-nums">
                  {a.customer_phone}
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: 'service',
        header: 'Serviço',
        accessorKey: 'service_name',
        cell: ({ row }) => {
          const a = row.original;
          return (
            <div className="min-w-0">
              <div className="font-semibold text-xs text-[#171827] dark:text-white truncate">
                {a.service_name || 'Corte'}
              </div>
              <div className="text-[10px] text-[#59658F] dark:text-[#7E8BAF] tabular-nums">
                {a.duration_minutes ? `${a.duration_minutes} min` : '30 min'}
              </div>
            </div>
          );
        },
      },
      {
        id: 'professional',
        header: 'Profissional',
        accessorKey: 'professional_name',
        cell: ({ row }) => {
          const a = row.original;
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F8FAFC] dark:bg-[#131422] border border-[#E5E7EF] dark:border-[#232538] text-xs font-semibold text-[#171827] dark:text-white">
              <User className="w-3.5 h-3.5 text-[#59658F]" strokeWidth={1.75} />
              <span>{a.professional_name || 'Barbeiro'}</span>
            </span>
          );
        },
      },
      {
        id: 'price',
        header: 'Preço / Pagamento',
        cell: ({ row }) => {
          const a = row.original;
          const isPaidOnline =
            a.paid ||
            a.paid_online ||
            a.payment_status === 'confirmed' ||
            a.payment_status === 'confirmed_card' ||
            Boolean(a.asaas_payment_id);
          const isCardPayment =
            a.payment_status === 'confirmed_card' ||
            a.payment_method === 'credit_card' ||
            a.payment_method === 'card';

          return (
            <div>
              <div className="font-extrabold text-xs text-[#171827] dark:text-white tabular-nums">
                R$ {(Number(a.price) || 0).toFixed(2).replace('.', ',')}
              </div>
              {isPaidOnline ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  {isCardPayment ? 'PAGO CARTÃO' : 'PAGO PIX'}
                </span>
              ) : (
                <span className="text-[10px] text-[#59658F] dark:text-[#7E8BAF] font-medium">
                  A receber no caixa
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const a = row.original;
          const st = STATUS_TOKENS[a.status] || STATUS_TOKENS.agendado;
          return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${st.badgeClass || 'bg-slate-100 text-slate-700'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
              {st.label}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Ação',
        cell: ({ row }) => {
          const a = row.original;
          return (
            <button
              type="button"
              onClick={() => onCardClick && onCardClick(a)}
              className="text-xs px-2.5 py-1.5 rounded-lg font-bold bg-[#EFF6FF] dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-300 hover:bg-[#DBEAFE] border border-[#DBEAFE] dark:border-blue-800/40 inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Gerenciar</span>
            </button>
          );
        },
      },
    ],
    [onCardClick]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="bg-[#FFFFFF] dark:bg-[#171827] rounded-2xl border border-[#E5E7EF] dark:border-[#232538] overflow-hidden shadow-sm">
      {/* Toolbar da Tabela de Agendamentos */}
      <div className="p-4 border-b border-[#E5E7EF] dark:border-[#232538] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#171827] dark:text-white uppercase tracking-wider">
            Visão Tabular BI
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#59658F]/15 text-[#59658F] dark:text-[#B5D7E8] tabular-nums">
            {filteredData.length} {filteredData.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#59658F]" strokeWidth={1.75} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, serviço ou barbeiro…"
            className="w-full pl-9 pr-3 py-1.5 border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-xs bg-[#F8FAFC] dark:bg-[#131422] text-[#171827] dark:text-white placeholder:text-[#55596A]/50 focus:outline-none focus:border-[#2563EB]"
          />
        </div>
      </div>

      {/* Tabela de Alta Densidade */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b border-[#E5E7EF] dark:border-[#232538] bg-[#F1F2F7]/60 dark:bg-[#131422]"
              >
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-[11px] font-bold text-[#55596A] dark:text-[#8F9BBF] uppercase tracking-wider"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-[#E5E7EF]/70 dark:divide-[#232538]/70">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-[#F8FAFC] dark:hover:bg-white/[0.02] transition-colors"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}

            {filteredData.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-[#55596A] dark:text-[#8F9BBF] text-xs">
                  <Calendar className="w-6 h-6 mx-auto mb-2 text-[#59658F]/40" strokeWidth={1.75} />
                  Nenhum agendamento encontrado para o filtro aplicado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
