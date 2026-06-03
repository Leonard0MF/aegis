"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import {
  Shield,
  Activity,
  Radar,
  Boxes,
  Settings,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string; // Voltamos para o href original para navegar pelas páginas
  icon: any;
};

const navItems: NavItem[] = [
  { label: "CORE_DASHBOARD", href: "/", icon: Shield },
  { label: "THREAT_FEED", href: "/threat-feed", icon: Activity },
  { label: "ANALYTICS_MATRIX", href: "/analytics", icon: Radar },
  { label: "ASSETS_RECON", href: "/assets", icon: Boxes },
  { label: "SYS_SETTINGS", href: "/settings", icon: Settings },
];

interface SidebarProps {
  setActiveTab?: (tab: string) => void;
}

export default function Sidebar({ setActiveTab }: SidebarProps) {
  const pathname = usePathname(); // Voltamos a ler a URL real do Next.js

  // ⚡ SINCRO DOS MUNDOS: Sempre que a rota mudar, avisamos o page.tsx
  // para o globo saber se entra em modo normal ou modo analytics expandido
  useEffect(() => {
    if (setActiveTab) {
      setActiveTab(pathname);
    }
  }, [pathname, setActiveTab]);

  const getClass = (path: string) => {
    const isCurrent = pathname === path;
    return `group flex items-center gap-3 px-3 py-2.5 rounded font-mono text-[11px] tracking-wider transition-all duration-300 relative border cursor-pointer w-full text-left ${
      isCurrent
        ? "text-cyan-400 bg-cyan-500/[0.04] border-cyan-500/30 font-bold shadow-[inset_0_0_12px_rgba(6,182,212,0.05)]"
        : "text-zinc-500 border-transparent hover:text-zinc-200 hover:bg-zinc-900/40 hover:border-zinc-800/40"
    }`;
  };

  return (
    <aside className="w-64 h-screen border-r border-zinc-900/80 bg-zinc-950/20 backdrop-blur-md p-6 flex flex-col justify-between relative select-none">
      
      {/* Elemento estético: Linha laser sutil no canto extremo direito para separar a sidebar */}
      <div className="absolute top-0 right-0 w-[1px] h-32 bg-gradient-to-b from-cyan-500/30 to-transparent"></div>

      <div>
        {/* Logo Area - Estilo HUD Tático */}
        <div className="mb-10 font-mono relative">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-zinc-50 to-zinc-400 uppercase">
              AEGIS
            </h1>
            <span className="text-[7px] text-cyan-500/70 bg-cyan-950/40 border border-cyan-800/30 px-1 py-0.2 rounded font-bold tracking-normal animate-pulse">
              v1.0.4
            </span>
          </div>

          <p className="text-[9px] text-zinc-600 mt-1 uppercase tracking-widest">
            // THREAT_INTEL_GATEWAY
          </p>
        </div>

        {/* Navigation - Links reais com monitoramento de rota */}
        <nav className="space-y-1.5">
          {navItems.map(({ label, href, icon: Icon }) => {
            const isCurrent = pathname === href;
            return (
              <Link key={href} href={href} className={getClass(href)}>
                {/* Pequeno ponteiro/mira laser lateral para o link ativo */}
                {isCurrent && (
                  <span className="absolute left-0 top-1/4 bottom-1/4 w-[2px] bg-cyan-400 rounded-r shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                )}
                
                <Icon 
                  size={14} 
                  className={`transition-colors duration-300 ${
                    isCurrent ? "text-cyan-400" : "text-zinc-600 group-hover:text-zinc-400"
                  }`} 
                />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Rodapé da Sidebar - Dados do Terminal Operacional */}
      <div className="font-mono text-[8px] text-zinc-600 space-y-1 border-t border-zinc-900/60 pt-4">
        <div className="flex justify-between">
          <span>SECURE_CONNECTION:</span>
          <span className="text-emerald-500 font-bold">YES</span>
        </div>
        <div className="flex justify-between">
          <span>ENC_METHOD:</span>
          <span className="text-zinc-500">ECDSA_P256</span>
        </div>
      </div>

    </aside>
  );
}