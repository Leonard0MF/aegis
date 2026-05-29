"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Shield,
  Activity,
  Radar,
  Boxes,
  Settings,
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();

  const linkClass = (path: string) =>
    `flex items-center gap-3 transition ${
      pathname === path
        ? "text-white"
        : "text-zinc-400 hover:text-blue-400"
    }`;

  return (
    <aside className="w-64 h-screen border-r border-zinc-800 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-widest">
          AEGIS
        </h1>

        <p className="text-xs text-zinc-500 mt-1">
          Threat Intelligence Platform
        </p>
      </div>

      <nav className="mt-10 space-y-5">
        <Link href="/" className={linkClass("/")}>
          <Shield size={18} />
          <span>Dashboard</span>
        </Link>

        <Link
          href="/threat-feed"
          className={linkClass("/threat-feed")}
        >
          <Activity size={18} />
          <span>Threat Feed</span>
        </Link>

        <Link
          href="/analytics"
          className={linkClass("/analytics")}
        >
          <Radar size={18} />
          <span>Analytics</span>
        </Link>

        <Link
          href="/assets"
          className={linkClass("/assets")}
        >
          <Boxes size={18} />
          <span>Assets</span>
        </Link>

        <Link
          href="/settings"
          className={linkClass("/settings")}
        >
          <Settings size={18} />
          <span>Settings</span>
        </Link>
      </nav>
    </aside>
  );
}