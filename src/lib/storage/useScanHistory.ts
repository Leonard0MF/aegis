"use client";

import { useSyncExternalStore } from "react";
import type { ScanResult } from "@/types/scan";
import { HISTORY_EVENT, parseHistory, readRaw } from "./scanHistory";

const EMPTY: ScanResult[] = [];
let cache: { raw: string; value: ScanResult[] } = { raw: "[]", value: EMPTY };

function subscribe(onChange: () => void) {
  window.addEventListener(HISTORY_EVENT, onChange);
  window.addEventListener("storage", onChange); // outras abas
  return () => {
    window.removeEventListener(HISTORY_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** snapshot estável: só reprocessa o JSON quando o conteúdo cru muda */
function getSnapshot(): ScanResult[] {
  const raw = readRaw();
  if (raw !== cache.raw) cache = { raw, value: parseHistory(raw) };
  return cache.value;
}

/** Histórico de scans (mais recente primeiro), reativo. Vazio no servidor. */
export function useScanHistory(): ScanResult[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

/* ---- relógio por minuto, para "há X min" sem Date.now() na renderização ---- */

function subscribeMinute(onChange: () => void) {
  const id = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(id);
}
const minuteSnapshot = () => Math.floor(Date.now() / 60_000);

/** Minuto atual (epoch em minutos). 0 no servidor. */
export function useNowMinute(): number {
  return useSyncExternalStore(subscribeMinute, minuteSnapshot, () => 0);
}
