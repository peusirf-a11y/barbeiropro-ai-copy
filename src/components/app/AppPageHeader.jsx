// Header padrão de página interna — Design System Business Intelligence & Executive SaaS
export default function AppPageHeader({ title, subtitle, icon: Icon, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] shadow-sm flex items-center justify-center flex-shrink-0 text-[#2563EB] dark:text-[#93C5FD]">
            <Icon className="w-5 h-5" strokeWidth={1.75} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl lg:text-[26px] font-black tracking-tight leading-tight text-[#171827] dark:text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[#55596A] dark:text-[#8F9BBF] text-sm mt-0.5 font-medium">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children && (
        <div className="flex items-center gap-2 flex-wrap sm:self-start">
          {children}
        </div>
      )}
    </div>
  );
}