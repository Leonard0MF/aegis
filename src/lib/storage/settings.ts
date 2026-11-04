"use client";

import { useSyncExternalStore } from "react";

const KEY = "aegis.settings.v1";
const EVENT = "aegis:settings";

export interface Settings {
  /** alvo do auto-diagnóstico quando o AEGIS roda em localhost/IP (vazio = padrão do servidor) */
  defaultTarget: string;
  /** mapear subdomínios automaticamente depois de cada scan */
  autoSurface: boolean;
  /** abrir "Verificações" já filtrado em "Só problemas" */
  issuesOnlyByDefault: boolean;
}

export const DEFAULT_SETTINGS: Settings = { defaultTarget: "", autoSurface: true, issuesOnlyByDefault: false };

let cache: { raw: string | null; value: Settings } = { raw: null, value: DEFAULT_SETTINGS };

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): Settings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const v = JSON.parse(raw) as Partial<Settings>;
    return {
      defaultTarget: typeof v.defaultTarget === "string" ? v.defaultTarget : DEFAULT_SETTINGS.defaultTarget,
      autoSurface: typeof v.autoSurface === "boolean" ? v.autoSurface : DEFAULT_SETTINGS.autoSurface,
      issuesOnlyByDefault:
        typeof v.issuesOnlyByDefault === "boolean" ? v.issuesOnlyByDefault : DEFAULT_SETTINGS.issuesOnlyByDefault,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Leitura direta (fora do React). */
export function getSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  const raw = read();
  if (raw !== cache.raw) cache = { raw, value: parse(raw) };
  return cache.value;
}

export function updateSettings(patch: Partial<Settings>): void {
  const next = { ...getSettings(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* modo privado / quota: preferências são opcionais */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function resetSettings(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, () => DEFAULT_SETTINGS);
}
