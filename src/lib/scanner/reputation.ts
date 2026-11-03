import dns from "node:dns/promises";
import net from "node:net";
import type { ReputationEntry, SecurityCheck } from "@/types/scan";
import { check } from "./checks";

type Answer = { kind: "clean" } | { kind: "listed"; codes: string[] } | { kind: "unavailable"; why: string };

async function dnsbl(name: string): Promise<Answer> {
  try {
    const codes = await dns.resolve4(name);
    return { kind: "listed", codes };
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOTFOUND" || code === "ENODATA") return { kind: "clean" };
    return { kind: "unavailable", why: code ?? "erro" };
  }
}

/** Spamhaus devolve 127.255.255.x quando recusa a consulta (resolvedor público / limite) */
const spamhausRefused = (codes: string[]) => codes.some((c) => c.startsWith("127.255.255."));

const DBL: Record<string, string> = {
  "127.0.1.2": "spam", "127.0.1.4": "phishing", "127.0.1.5": "malware", "127.0.1.6": "botnet C&C",
  "127.0.1.102": "abuso (redirecionador)", "127.0.1.103": "abuso", "127.0.1.104": "phishing (abuso)",
  "127.0.1.105": "malware (abuso)", "127.0.1.106": "botnet C&C (abuso)",
};
const ZEN: Record<string, string> = {
  "127.0.0.2": "SBL (fonte de spam)", "127.0.0.3": "SBL CSS", "127.0.0.4": "XBL (máquina comprometida)",
  "127.0.0.9": "DROP (rede sequestrada)", "127.0.0.10": "PBL (IP residencial)", "127.0.0.11": "PBL",
};

async function spamhausDomain(domain: string): Promise<ReputationEntry> {
  const a = await dnsbl(`${domain}.dbl.spamhaus.org`);
  const base = { list: "Spamhaus DBL", target: domain };
  if (a.kind === "clean") return { ...base, status: "clean" };
  if (a.kind === "unavailable" || spamhausRefused(a.codes)) {
    return { ...base, status: "unavailable", detail: "Consulta recusada (o Spamhaus bloqueia resolvedores DNS públicos)" };
  }
  return { ...base, status: "listed", detail: a.codes.map((c) => DBL[c] ?? c).join(", ") };
}

async function spamhausIp(ip: string): Promise<ReputationEntry> {
  const base = { list: "Spamhaus ZEN", target: ip };
  if (!net.isIPv4(ip)) return { ...base, status: "unavailable", detail: "Só IPv4" };
  const a = await dnsbl(`${ip.split(".").reverse().join(".")}.zen.spamhaus.org`);
  if (a.kind === "clean") return { ...base, status: "clean" };
  if (a.kind === "unavailable" || spamhausRefused(a.codes)) {
    return { ...base, status: "unavailable", detail: "Consulta recusada (o Spamhaus bloqueia resolvedores DNS públicos)" };
  }
  // PBL só diz que o IP é residencial: para um servidor web não é um problema de reputação
  const real = a.codes.filter((c) => c !== "127.0.0.10" && c !== "127.0.0.11");
  if (real.length === 0) return { ...base, status: "clean", detail: "Só na PBL (faixa residencial)" };
  return { ...base, status: "listed", detail: real.map((c) => ZEN[c] ?? c).join(", ") };
}

async function surbl(domain: string): Promise<ReputationEntry> {
  const a = await dnsbl(`${domain}.multi.surbl.org`);
  const base = { list: "SURBL", target: domain };
  if (a.kind === "clean") return { ...base, status: "clean" };
  if (a.kind === "unavailable" || a.codes.includes("127.0.0.1")) {
    return { ...base, status: "unavailable", detail: "Consulta recusada pelo SURBL" };
  }
  const bits = Number(a.codes[0].split(".")[3]);
  const kinds = [[8, "phishing"], [16, "malware"], [64, "abuso"], [128, "conteúdo comprometido"]]
    .filter(([b]) => bits & (b as number))
    .map(([, k]) => k);
  return { ...base, status: "listed", detail: kinds.join(", ") || a.codes.join(", ") };
}

async function safeBrowsing(domain: string): Promise<ReputationEntry> {
  const base = { list: "Google Safe Browsing", target: domain };
  const key = process.env.GOOGLE_SAFE_BROWSING_KEY;
  if (!key) return { ...base, status: "not_configured", detail: "Defina GOOGLE_SAFE_BROWSING_KEY" };
  try {
    const r = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        client: { clientId: "aegis", clientVersion: "1.0" },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url: `http://${domain}/` }, { url: `https://${domain}/` }],
        },
      }),
    });
    if (!r.ok) return { ...base, status: "unavailable", detail: `HTTP ${r.status}` };
    const j = (await r.json()) as { matches?: { threatType: string }[] };
    if (!j.matches?.length) return { ...base, status: "clean" };
    return { ...base, status: "listed", detail: [...new Set(j.matches.map((m) => m.threatType))].join(", ") };
  } catch {
    return { ...base, status: "unavailable", detail: "Sem resposta" };
  }
}

async function urlhaus(domain: string): Promise<ReputationEntry> {
  const base = { list: "URLhaus (abuse.ch)", target: domain };
  const key = process.env.URLHAUS_AUTH_KEY;
  if (!key) return { ...base, status: "not_configured", detail: "Defina URLHAUS_AUTH_KEY" };
  try {
    const r = await fetch("https://urlhaus-api.abuse.ch/v1/host/", {
      method: "POST",
      headers: { "Auth-Key": key, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ host: domain }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { ...base, status: "unavailable", detail: `HTTP ${r.status}` };
    const j = (await r.json()) as { query_status: string; url_count?: string; urls?: { url_status: string }[] };
    if (j.query_status === "no_results") return { ...base, status: "clean" };
    if (j.query_status !== "ok") return { ...base, status: "unavailable", detail: j.query_status };
    const online = j.urls?.filter((u) => u.url_status === "online").length ?? 0;
    return { ...base, status: "listed", detail: `${j.url_count ?? "?"} URL(s) de malware registradas, ${online} online` };
  } catch {
    return { ...base, status: "unavailable", detail: "Sem resposta" };
  }
}

export function inspectReputation(domain: string, ip: string): Promise<ReputationEntry[]> {
  return Promise.all([spamhausDomain(domain), surbl(domain), spamhausIp(ip), safeBrowsing(domain), urlhaus(domain)]);
}

export function reputationChecks(entries: ReputationEntry[]): SecurityCheck[] {
  const listed = entries.filter((e) => e.status === "listed");
  const consulted = entries.filter((e) => e.status === "clean" || e.status === "listed");
  if (consulted.length === 0) {
    return [check("reputation", "reputation", "Listas de bloqueio", 0, "info", "Nenhuma lista pôde ser consultada")];
  }
  return [
    check(
      "reputation", "reputation", "Listas de bloqueio", 10,
      listed.length ? "fail" : "pass",
      listed.length
        ? `Listado em ${listed.map((e) => `${e.list} (${e.detail})`).join(" · ")}`
        : `Limpo em ${consulted.map((e) => e.list).join(", ")}`,
      listed.length ? 30 : undefined,
    ),
  ];
}
