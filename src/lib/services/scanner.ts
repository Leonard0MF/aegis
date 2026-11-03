import type { ActiveInfo, ScanResult, SecurityCheck, SurfaceInfo } from "@/types/scan";

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly data: unknown) {
    super(message);
  }
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(data?.error ?? `Falha na requisição (HTTP ${response.status})`, response.status, data);
  }
  return data as T;
}

export function scanDomain(domain: string): Promise<ScanResult> {
  return post<ScanResult>("/api/scan", { domain });
}

export function scanSurface(domain: string): Promise<{ surface: SurfaceInfo; checks: SecurityCheck[] }> {
  return post("/api/scan/surface", { domain });
}

export function scanActive(domain: string): Promise<{ active: ActiveInfo; checks: SecurityCheck[]; via?: string }> {
  return post("/api/scan/active", { domain });
}

export interface VerifyStatus {
  domain: string;
  verified: boolean;
  via?: string;
  method?: "dns" | "file";
  dns: { name: string; type: "TXT"; value: string };
  file: { url: string; content: string };
}

export function verifyDomain(domain: string): Promise<VerifyStatus> {
  return post<VerifyStatus>("/api/verify", { domain });
}

export interface KevItem {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  shortDescription: string;
  requiredAction: string;
  dueDate: string;
  knownRansomwareCampaignUse: string;
}

export interface ThreatFeed {
  catalogVersion: string;
  updated: string;
  total: number;
  last7: number;
  last30: number;
  ransomware: number;
  topVendors: { name: string; count: number }[];
  recent: KevItem[];
  matches: KevItem[];
}

export async function getThreats(ids: string[] = []): Promise<ThreatFeed> {
  const q = ids.length ? `?ids=${encodeURIComponent(ids.slice(0, 100).join(","))}` : "";
  const response = await fetch(`/api/threats${q}`);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(data?.error ?? `HTTP ${response.status}`, response.status, data);
  return data as ThreatFeed;
}
