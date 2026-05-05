// BrandMark — wrapper do logo "O CORTE" com subtítulo opcional.
// A imagem `full` já contém o texto "O CORTE", então NÃO duplicamos texto ao lado.
// Use apenas o subtítulo (ex: "Painel de gestão", "Modo demonstração").

import Logo from '@/components/Logo';

export default function BrandMark({
  size = 40,
  tone = 'light',
  subtitle = null,
  className = '',
}) {
  const subtitleColor = tone === 'dark' ? 'text-gray-400' : 'text-gray-500';

  if (!subtitle) {
    return <Logo size={size} className={className} />;
  }

  return (
    <div className={`flex items-center gap-3 min-w-0 ${className}`}>
      <Logo size={size} className="flex-shrink-0" />
      <div className={`text-[11px] font-medium ${subtitleColor} truncate hidden sm:block`}>
        {subtitle}
      </div>
    </div>
  );
}