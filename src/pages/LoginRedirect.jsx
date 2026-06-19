// LoginRedirect — captura /login (e /signin) em app público.
// Base44 não hospeda mais essa rota quando o app é público, então respondemos
// no client: lemos ?from_url=... e disparamos a tela oficial de login Base44
// (que hoje aceita apenas email + senha — Google/Microsoft/Facebook desativados).
import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export default function LoginRedirect() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('from_url') || '/app/dashboard';
    base44.auth.redirectToLogin(fromUrl);
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#050816]">
      <div className="w-8 h-8 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
    </div>
  );
}