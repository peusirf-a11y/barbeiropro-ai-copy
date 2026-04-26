// Logo do BarberTrimly — imagem hospedada (PNG sobre fundo preto).
// Use a prop "size" para ajustar a altura em px. Funciona melhor sobre fundo escuro;
// sobre fundo claro, prefira usar dentro de um wrapper escuro ou usar a variante "compact".

export const LOGO_URL = "https://media.base44.com/images/public/69edf956c00a8a48c1e17cd6/8fc343ce6_file_000000006958720e9107f8eb7e0d9552.png";

export default function Logo({ size = 32, className = "" }) {
  return (
    <img
      src={LOGO_URL}
      alt="BarberTrimly"
      style={{ height: size, width: size }}
      className={`object-contain rounded-lg ${className}`}
    />
  );
}