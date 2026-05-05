// Logo oficial "O CORTE" — usa as imagens enviadas pelo cliente.
// Sem SVG inline, sem recriação: imagens originais como fonte da verdade.
//
// Variantes:
//   variant="full"      (default) → logo horizontal completo (símbolo + "O CORTE").
//   variant="icon"               → apenas o emblema circular (sem texto).
//   variant="icon-bare"          → idem icon (mantido por compatibilidade).
//
// Props:
//   size  (number)         altura em px (default 44).
//   tone  ('dark'|'light') ignorado — as imagens já têm fundo preto;
//                          mantido por compatibilidade de API.

const FULL_LOGO_URL = 'https://media.base44.com/images/public/69edf956c00a8a48c1e17cd6/59cfd6fe2_IMG-20260505-WA0008.jpg';
const ICON_LOGO_URL = 'https://media.base44.com/images/public/69edf956c00a8a48c1e17cd6/3fea98cd6_IMG-20260505-WA0009.jpg';

export default function Logo({ size = 44, variant = 'full', className = '' }) {
  if (variant === 'icon' || variant === 'icon-bare') {
    return (
      <img
        src={ICON_LOGO_URL}
        alt="O CORTE"
        width={size}
        height={size}
        className={`block object-contain select-none ${className}`}
        style={{ width: size, height: size }}
        draggable={false}
      />
    );
  }

  // FULL — proporção ~3:1 (logo horizontal "O CORTE").
  return (
    <img
      src={FULL_LOGO_URL}
      alt="O CORTE"
      height={size}
      className={`block object-contain select-none ${className}`}
      style={{ height: size, width: 'auto' }}
      draggable={false}
    />
  );
}