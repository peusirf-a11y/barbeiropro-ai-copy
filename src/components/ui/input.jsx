import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border border-[#E5E7EF] dark:border-white/[0.12] bg-white dark:bg-[#0D1326] px-3.5 py-2 text-sm text-[#171827] dark:text-white shadow-[var(--shadow-xs)] transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-slate-400 dark:placeholder:text-slate-400/70 focus-visible:outline-none focus-visible:border-[#2563EB] dark:focus-visible:border-[#60A5FA] focus-visible:ring-2 focus-visible:ring-[#2563EB]/20 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
})
Input.displayName = "Input"

export { Input }