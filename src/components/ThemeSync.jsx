// ThemeSync — DEPRECATED. Antiga implementação que forçava `dark` global.
// O sistema de temas foi migrado para `@/theme/ThemeProvider`.
// Este shim é mantido para compatibilidade com imports existentes; renderiza nada.
//
// NÃO use mais. Para alterar o tema: useTheme() ou <ThemeToggle />.

export default function ThemeSync() {
  return null;
}