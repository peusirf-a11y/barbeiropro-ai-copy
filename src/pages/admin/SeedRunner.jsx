import { useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function SeedRunner() {
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(null);

  const addLog = (msg, type = 'info') => {
    setLog(prev => [...prev, { msg: typeof msg === 'object' ? JSON.stringify(msg, null, 2) : msg, type, ts: new Date().toLocaleTimeString() }]);
  };

  const syncUser = async () => {
    addLog('🔄 Sincronizando company_id do usuário...');
    const r = await base44.functions.invoke('syncUserCompanyId', {});
    addLog(`✅ Sync: ${JSON.stringify(r.data)}`, 'success');
    return r.data;
  };

  const runPhase = async (p, payload = {}) => {
    setPhase(p);
    addLog(`▶️ Fase ${p}...`);
    const r = await base44.functions.invoke('seedTestData', { phase: p, ...payload });
    addLog(`✅ Fase ${p} concluída: ${JSON.stringify(r.data)}`, 'success');
    return r.data;
  };

  const runAll = async () => {
    setRunning(true);
    setLog([]);
    try {
      await syncUser();
      await new Promise(r => setTimeout(r, 500));

      // Fase 1: Unidades
      const f1 = await runPhase(1);
      const { unit1_id, unit2_id } = f1;
      addLog(`Unidades: ${unit1_id} | ${unit2_id}`);
      await new Promise(r => setTimeout(r, 1000));

      // Fase 2: Serviços + Profissionais
      const f2 = await runPhase(2, { unit1_id, unit2_id });
      const { service_ids, pro_ids } = f2;
      addLog(`Serviços: ${service_ids?.length} | Profissionais: ${pro_ids?.length}`);
      await new Promise(r => setTimeout(r, 1000));

      // Fase 3: Clientes
      await runPhase(3, { unit1_id, unit2_id });
      await new Promise(r => setTimeout(r, 2000));

      // Fase 4: Agendamentos históricos
      await runPhase(4, { unit1_id, unit2_id, pro_ids, service_ids });
      await new Promise(r => setTimeout(r, 3000));

      // Fase 5: Agendamentos recentes
      await runPhase(5, { unit1_id, unit2_id, pro_ids, service_ids });
      await new Promise(r => setTimeout(r, 3000));

      // Fase 6: Caixas
      await runPhase(6, { unit1_id, unit2_id });
      await new Promise(r => setTimeout(r, 2000));

      // Fase 7: Planos + Assinaturas
      await runPhase(7, { unit1_id, unit2_id, service_ids });

      addLog('🎉 Seed completo! Todos os dados foram criados com sucesso.', 'success');
    } catch (err) {
      addLog(`❌ Erro: ${err.message || JSON.stringify(err)}`, 'error');
    } finally {
      setRunning(false);
      setPhase(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-green-400 font-mono p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">🌱 Seed Runner — O Corte / Vintage</h1>
        <p className="text-gray-400 text-sm mb-6">Popula o banco com dados realistas (80 clientes, 400+ agendamentos, caixas, comissões).</p>

        <button
          onClick={runAll}
          disabled={running}
          className="px-6 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg text-sm transition-colors mb-6"
        >
          {running ? `⏳ Executando fase ${phase}...` : '▶ Executar Seed Completo'}
        </button>

        {log.length > 0 && (
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 h-[500px] overflow-y-auto">
            {log.map((entry, i) => (
              <div key={i} className={`text-xs mb-1 ${
                entry.type === 'error' ? 'text-red-400' :
                entry.type === 'success' ? 'text-green-400' :
                'text-gray-300'
              }`}>
                <span className="text-gray-600 mr-2">{entry.ts}</span>
                <span className="whitespace-pre-wrap">{entry.msg}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}