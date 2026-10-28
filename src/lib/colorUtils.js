const HEX_6_RE = /^#[0-9A-Fa-f]{6}$/;
const HEX_3_RE = /^#[0-9A-Fa-f]{3}$/;
const HEX_6_NO_HASH_RE = /^[0-9A-Fa-f]{6}$/;
const HEX_3_NO_HASH_RE = /^[0-9A-Fa-f]{3}$/;

/**
 * Normaliza e valida uma cor hexadecimal.
 * - Se for "#" (caso em que o input de texto ficou apenas com "#" enquanto o <input type="color"> exibia preto),
 *   retorna "#111827" (preto/grafite).
 * - Expande hex de 3 dígitos (#abc -> #AABBCC).
 * - Para valores inválidos ou vazios, retorna fallback (#2563EB).
 */
export function sanitizeHexColor(rawColor, fallback = '#2563EB') {
  if (typeof rawColor !== 'string') return fallback;
  const trimmed = rawColor.trim();
  if (!trimmed) return fallback;

  // Quando o campo foi salvo apenas com '#', o seletor nativo <input type="color">
  // exibia preto (#000000) para o usuário.
  if (trimmed === '#') return '#111827';

  if (HEX_6_RE.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  if (HEX_3_RE.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  if (HEX_6_NO_HASH_RE.test(trimmed)) {
    return `#${trimmed}`.toUpperCase();
  }
  if (HEX_3_NO_HASH_RE.test(trimmed)) {
    const r = trimmed[0];
    const g = trimmed[1];
    const b = trimmed[2];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  return fallback;
}

export function isValidHexColor(rawColor) {
  if (typeof rawColor !== 'string') return false;
  const trimmed = rawColor.trim();
  return HEX_6_RE.test(trimmed) || HEX_3_RE.test(trimmed);
}

export function getRelativeLuminance(hexColor) {
  const hex = sanitizeHexColor(hexColor, '#2563EB').slice(1);
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Retorna a cor de texto ideal ('#FFFFFF' ou '#111827') para um fundo com a cor informada.
 */
export function getContrastTextColor(bgHex) {
  const lum = getRelativeLuminance(bgHex);
  return lum > 0.68 ? '#111827' : '#FFFFFF';
}

/**
 * Retorna a paleta de destaque adaptada ao tema atual (claro/escuro),
 * evitando que cores muito escuras (ex: #000000 / #111827) sumam no tema escuro
 * ou que cores muito claras (ex: #FFFFFF) sumam no tema claro.
 */
export function getThemeAccent(rawPrimaryColor, isDark = false) {
  const base = sanitizeHexColor(rawPrimaryColor, '#2563EB');
  const lum = getRelativeLuminance(base);

  let bg = base;
  if (isDark && lum < 0.06) {
    // Cor preta/quase preta no modo escuro -> usa branco de alto contraste nos elementos ativos
    bg = '#FFFFFF';
  } else if (!isDark && lum > 0.90) {
    // Cor branca/quase branca no modo claro -> usa grafite escuro de alto contraste
    bg = '#111827';
  }

  const fg = getContrastTextColor(bg);
  return {
    base,
    bg,
    fg,
    border: bg,
    softBg: `${bg}20`,
  };
}
