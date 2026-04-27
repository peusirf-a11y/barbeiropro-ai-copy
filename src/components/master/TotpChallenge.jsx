// TotpChallenge — Pede código TOTP quando super admin já tem 2FA ativo mas
// a sessão atual expirou ou ainda não existe.
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Shield } from 'lucide-react';
import { setTotpSession } from '@/lib/totpSession';

export default function TotpChallenge({ onSuccess, title = 'Verificação 2FA', description }) {
  const [code, setCode] = useState('');

  const verify = useMutation({
    mutationFn: (c) => base44.functions.invoke('verifyTotp', { code: c }),
    onSuccess: (res) => {
      if (!res.data?.success) throw new Error(res.data?.error || 'Código inválido');
      setTotpSession({ token: res.data.token, expires_at: res.data.expires_at });
      onSuccess?.(res.data);
    },
  });

  return (
    <div className="min-h-screen bg-[#F7F8FB] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-black/8 p-8 w-full max-w-sm shadow-card-lg">
        <div className="w-12 h-12 rounded-xl bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center mb-4">
          <Shield className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-[#1B1C1E] mb-1">{title}</h1>
        <p className="text-sm text-gray-500 mb-6">
          {description || 'Digite o código de 6 dígitos do seu app autenticador para acessar o Master.'}
        </p>

        <input
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          inputMode="numeric"
          className="w-full px-3 py-3 border border-black/10 rounded-lg text-center text-2xl font-mono tracking-widest"
          onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6) verify.mutate(code); }}
        />

        {verify.error && <div className="text-sm text-red-600 mt-3">{verify.error.message}</div>}

        <button
          onClick={() => verify.mutate(code)}
          disabled={code.length !== 6 || verify.isPending}
          className="w-full mt-4 bg-[#2563EB] text-white font-semibold rounded-lg py-2.5 hover:bg-[#1d4ed8] disabled:opacity-50"
        >
          {verify.isPending ? 'Verificando…' : 'Verificar'}
        </button>
      </div>
    </div>
  );
}