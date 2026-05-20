// Botão + modal para gerar invite_token de um plano já salvo.
// Usado tanto no Master (entity='Plan') quanto no AppPlanos (entity='CustomerPlan').
//
// Props:
//   - planId: ID do plano (precisa estar salvo)
//   - entity: 'Plan' | 'CustomerPlan'
//   - publicBaseUrl: prefixo da URL pública (sem token). Ex: "/planos/convite/" ou "/cliente/{slug}/planos/convite/"
//   - variant: 'dark' | 'light'

import { useState } from 'react';
import { Link2, Copy, Loader2, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import StandardModal from '@/components/ui/standard-modal';

export default function PlanInviteGenerator({ planId, entity, publicBaseUrl, variant = 'dark' }) {
  const [open, setOpen] = useState(false);
  const [expires, setExpires] = useState(30);
  const [maxUses, setMaxUses] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [token, setToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setGenerating(true); setError('');
    try {
      const res = await base44.functions.invoke('generatePlanInvite', {
        entity, plan_id: planId,
        expires_in_days: Number(expires) || null,
        max_uses: Number(maxUses) || null,
      });
      if (res?.data?.success) setToken(res.data.token);
      else setError(res?.data?.error || 'Erro ao gerar convite');
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Erro ao gerar convite');
    } finally {
      setGenerating(false);
    }
  };

  const fullUrl = token ? `${window.location.origin}${publicBaseUrl}${token}` : '';
  const copy = async () => {
    if (!fullUrl) return;
    try { await navigator.clipboard.writeText(fullUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* clipboard pode falhar em http; usuário copia manualmente */ }
  };

  const isDark = variant === 'dark';
  const inputCls = isDark
    ? 'w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white'
    : 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground';
  const labelCls = isDark ? 'text-xs font-semibold text-white/60 block mb-1' : 'text-xs font-semibold text-muted-foreground block mb-1';

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setToken(''); setError(''); }}
        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-500/15 text-[#60A5FA] border border-blue-400/30 hover:bg-blue-500/25 transition-colors">
        <Link2 className="w-3.5 h-3.5" /> Gerar convite
      </button>

      {open && (
        <StandardModal open={open} onClose={() => setOpen(false)} title="Gerar link de convite" size="md"
          footer={
            !token ? (
              <>
                <button onClick={() => setOpen(false)} className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-semibold">Cancelar</button>
                <button onClick={generate} disabled={generating}
                  className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                  {generating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Gerar link'}
                </button>
              </>
            ) : (
              <button onClick={() => setOpen(false)} className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-semibold">Fechar</button>
            )
          }
        >
          {!token ? (
            <div className="space-y-3">
              <p className={isDark ? 'text-sm text-white/70' : 'text-sm text-muted-foreground'}>
                O link gerado dará acesso a este plano. Defina validade e número máximo de usos.
                Gerar um novo link <strong>invalida o anterior</strong>.
              </p>
              <div>
                <label className={labelCls}>Expira em (dias)</label>
                <input type="number" min="0" value={expires} onChange={e => setExpires(e.target.value)} className={inputCls} />
                <p className="text-[11px] text-muted-foreground mt-1">0 = sem expiração.</p>
              </div>
              <div>
                <label className={labelCls}>Máximo de usos</label>
                <input type="number" min="0" value={maxUses} onChange={e => setMaxUses(e.target.value)} className={inputCls} />
                <p className="text-[11px] text-muted-foreground mt-1">0 = ilimitado.</p>
              </div>
              {error && <div className="text-xs text-rose-400 bg-rose-400/10 border border-rose-400/30 rounded-lg p-2.5">{error}</div>}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Link gerado com sucesso
              </div>
              <div>
                <label className={labelCls}>Link de convite</label>
                <div className="flex items-center gap-2">
                  <input readOnly value={fullUrl} className={`${inputCls} font-mono text-xs`} onClick={(e) => e.target.select()} />
                  <button onClick={copy} className="px-3 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-semibold flex items-center gap-1.5">
                    {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Envie este link apenas aos destinatários autorizados. Quem acessar e estiver autenticado libera o plano automaticamente.
                </p>
              </div>
            </div>
          )}
        </StandardModal>
      )}
    </>
  );
}