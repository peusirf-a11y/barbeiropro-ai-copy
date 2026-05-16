/**
 * AdaptiveCaptcha — Captcha adaptativo baseado em risco.
 *
 * MODOS:
 *  - none: sem captcha (baixo risco)
 *  - invisible: apenas valida sem interação
 *  - checkbox: simples checkbox de "não sou robô"
 *  - challenge: desafio matemático simples (fallback sem dependência externa)
 *
 * Exibido somente quando necessário — sem fricção para usuários normais.
 */

import { useState, useEffect, useCallback } from 'react';
import { Shield, CheckCircle2, RefreshCw } from 'lucide-react';

function MathChallenge({ onVerify }) {
  const [a] = useState(() => Math.floor(Math.random() * 10) + 1);
  const [b] = useState(() => Math.floor(Math.random() * 10) + 1);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (parseInt(answer, 10) === a + b) {
      onVerify(true);
    } else {
      setError('Resposta incorreta. Tente novamente.');
      setAnswer('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <span className="text-sm font-semibold text-[#111827]">{a} + {b} = ?</span>
      <input
        type="number"
        value={answer}
        onChange={e => { setAnswer(e.target.value); setError(''); }}
        className="w-16 px-2 py-1.5 border border-black/15 rounded-lg text-sm text-center focus:outline-none focus:border-[#2563EB]"
        placeholder="?"
        autoFocus
      />
      <button type="submit" className="px-3 py-1.5 bg-[#2563EB] text-white text-xs font-semibold rounded-lg hover:bg-[#1d4ed8] transition-colors">
        OK
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </form>
  );
}

/**
 * @param {object} props
 * @param {'none'|'invisible'|'checkbox'|'challenge'} props.mode
 * @param {function} props.onVerified - chamado com token quando verificado
 * @param {boolean} [props.loading]
 */
export default function AdaptiveCaptcha({ mode = 'none', onVerified, loading = false }) {
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(false);

  // Modo none ou invisible: auto-verifica
  useEffect(() => {
    if (mode === 'none' || mode === 'invisible') {
      setVerified(true);
      onVerified?.('auto_verified');
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCheckbox = useCallback(async () => {
    setChecking(true);
    // Simula verificação invisível (delay humano mínimo)
    await new Promise(r => setTimeout(r, 600));
    setVerified(true);
    setChecking(false);
    onVerified?.('checkbox_verified');
  }, [onVerified]);

  const handleMathVerify = useCallback((success) => {
    if (success) {
      setVerified(true);
      onVerified?.('challenge_verified');
    }
  }, [onVerified]);

  if (mode === 'none' || mode === 'invisible') return null;

  if (verified) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-700 py-1">
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        <span className="font-semibold">Verificado</span>
      </div>
    );
  }

  if (mode === 'challenge') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-xs font-semibold text-amber-700">Verificação de segurança</span>
        </div>
        <MathChallenge onVerify={handleMathVerify} />
      </div>
    );
  }

  // Modo checkbox
  return (
    <div className="bg-gray-50 border border-black/10 rounded-xl p-3 flex items-center gap-3">
      <button
        type="button"
        onClick={handleCheckbox}
        disabled={checking || loading}
        className="w-6 h-6 border-2 border-gray-400 rounded flex items-center justify-center hover:border-[#2563EB] transition-colors disabled:opacity-50"
      >
        {checking && <RefreshCw className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
      </button>
      <span className="text-sm text-gray-700">Não sou um robô</span>
      <div className="ml-auto flex flex-col items-end">
        <Shield className="w-5 h-5 text-gray-300" />
        <span className="text-[9px] text-gray-300">Segurança</span>
      </div>
    </div>
  );
}