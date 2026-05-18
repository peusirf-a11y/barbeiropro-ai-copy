// Badge premium usado no topo de cada seção. Glassmorphism com glow azul.
export default function SectionBadge({ icon: Icon, children }) {
  return (
    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-md">
      {Icon && (
        <span className="relative flex items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-[#60A5FA] blur-md opacity-60" />
          <Icon className="relative w-3.5 h-3.5 text-[#93C5FD]" />
        </span>
      )}
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">{children}</span>
    </div>
  );
}