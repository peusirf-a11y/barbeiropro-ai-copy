// TotpSetup — Quando super admin nunca configurou TOTP, mostra QR + secret + input para confirmar.
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Shield, Copy, CheckCircle } from 'lucide-react';
import { setTotpSession } from '@/lib/totpSession';

export default function TotpSetup({ onComplete }) {
  const [secret, setSecret] = useState(null);
  const [otpauth, setOtpauth] = useState(null);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  const setupMutation = useMutation({
    mutationFn: () => base44.functions.invoke('setupTotp', {}),
    onSuccess: (res) => {
      if (!res.data?.success) throw new Error(res.data?.error || 'Falha');
      setSecret(res.data.secret);
      setOtpauth(res.data.otpauth_url);
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (c) => base44.functions.invoke('verifyTotp', { code: c }),
    onSuccess: (res) => {
      if (!res.data?.success) throw new Error(res.data?.error || 'Código inválido');
      setTotpSession({ token: res.data.token, expires_at: res.data.expires_at });
      onComplete?.();
    },
  });

  const qrUrl = otpauth ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(otpauth)}` : null;

  return (
    <div className="min-h-screen bg-[#F7F8FB] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-black/8 p-8 w-full max-w-md shadow-card-lg">
        <div className="w-12 h-12 rounded-xl bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center mb-4">
          <Shield className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-[#1B1C1E] mb-1">Configurar autenticação 2FA</h1>
        <p className="text-sm text-gray-500 mb-6">
          O acesso ao painel Master exige um segundo fator (TOTP). Configure um app como
          Google Authenticator, 1Password ou Authy.
        </p>

        {!secret && (
          <button
            onClick={() => setupMutation.mutate()}
            disabled={setupMutation.isPending}
            className="w-full bg-[#2563EB] text-white font-semibold rounded-lg py-2.5 hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            {setupMutation.isPending ? 'Gerando…' : 'Gerar segredo TOTP'}
          </button>
        )}

        {setupMutation.error && (
          <div className="mt-3 text-sm text-red-600">{setupMutation.error.message}</div>
        )}

        {secret && (
          <div className="space-y-4">
            {qrUrl && (
              <div className="flex justify-center">
                <img src={qrUrl} alt="QR Code TOTP" className="rounded-lg border border-black/10" />
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-gray-500">Ou digite o segredo manualmente:</label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 px-3 py-2 bg-gray-50 rounded-lg text-xs font-mono break-all">{secret}</code>
                <button
                  onClick={() => { navigator.clipboard.writeText(secret); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className="p-2 border border-black/10 rounded-lg hover:bg-gray-50"
                >
                  {copied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-[#1B1C1E]">Código de 6 dígitos do app</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                className="w-full mt-1 px-3 py-2.5 border border-black/10 rounded-lg text-center text-lg font-mono tracking-widest"
              />
            </div>

            {verifyMutation.error && (
              <div className="text-sm text-red-600">{verifyMutation.error.message}</div>
            )}

            <button
              onClick={() => verifyMutation.mutate(code)}
              disabled={code.length !== 6 || verifyMutation.isPending}
              className="w-full bg-[#2563EB] text-white font-semibold rounded-lg py-2.5 hover:bg-[#1d4ed8] disabled:opacity-50"
            >
              {verifyMutation.isPending ? 'Verificando…' : 'Confirmar e ativar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}