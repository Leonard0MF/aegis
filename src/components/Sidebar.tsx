"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type LucideIcon,
  LayoutDashboard,
  Activity,
  BarChart3,
  Boxes,
  Settings,
  Shield,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { label: "Visão geral", href: "/", icon: LayoutDashboard },
  { label: "Ameaças", href: "/threat-feed", icon: Activity },
  { label: "Análises", href: "/analytics", icon: BarChart3 },
  { label: "Ativos", href: "/assets", icon: Boxes },
  { label: "Configurações", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full lg:w-60 shrink-0 lg:h-dvh border-b lg:border-b-0 lg:border-r border-line bg-panel/80 px-4 pt-4 pb-2 lg:py-5 flex flex-col gap-3 lg:gap-8 select-none">
      <Link href="/" className="flex items-center gap-2.5 px-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent ring-1 ring-inset ring-accent/25">
          <Shield size={16} strokeWidth={2} />
        </span>
        <span>
          <span className="block text-[15px] font-semibold tracking-tight text-fg">Aegis</span>
          <span className="block text-[11px] text-dim -mt-0.5">Security scanner</span>
        </span>
      </Link>

      <nav className="no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 flex lg:flex-col gap-1 overflow-x-auto">
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 lg:gap-3 rounded-lg px-3 py-1.5 lg:py-2 text-[13px] lg:text-sm whitespace-nowrap transition-colors ${
                active
                  ? "bg-panel-2 text-fg ring-1 ring-inset ring-line-strong"
                  : "text-muted hover:text-fg hover:bg-panel-2/60"
              }`}
            >
              <Icon size={16} strokeWidth={1.75} className={active ? "text-accent" : "text-dim"} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto hidden lg:block px-2 text-[11px] text-dim">v1.0.4</div>
    </aside>
  );
}
