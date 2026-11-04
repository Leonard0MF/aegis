import type { ReactNode } from "react";

interface PanelProps {
  title?: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  id?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/** Container padrão dos cartões do dashboard. */
export default function Panel({
  title,
  subtitle,
  actions,
  className = "",
  id,
  bodyClassName = "",
  children,
}: PanelProps) {
  return (
    <section
      id={id}
      className={`rounded-2xl border border-line bg-panel/90 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset,0_12px_32px_-16px_rgba(0,0,0,0.6)] flex flex-col ${className}`}
    >
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 px-4 sm:px-5 pt-4 pb-3">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-medium text-fg">{title}</h3>}
            {subtitle && <p className="text-xs text-dim mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </header>
      )}
      <div className={`px-4 sm:px-5 pb-4 sm:pb-5 ${title || actions ? "" : "pt-5"} flex-1 min-h-0 ${bodyClassName}`}>
        {children}
      </div>
    </section>
  );
}
