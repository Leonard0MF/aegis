export type CheckStatus = "pass" | "warn" | "fail" | "info";

export type CheckCategory = "tls" | "transport" | "headers" | "cookies" | "dns";

export type Grade = "A" | "B" | "C" | "D" | "F";

export interface SecurityCheck {
  id: string;
  category: CheckCategory;
  label: string;
  status: CheckStatus;
  detail: string;
  weight: number;
}

export interface TlsInfo {
  valid: boolean;
  error?: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  daysRemaining: number;
  protocol: string;
  altNames: string[];
}

export interface DnsInfo {
  spf: string | null;
  dmarc: string | null;
  mx: string[];
  caa: string[];
}

export interface ScanResult {
  domain: string;
  ip: string;
  ips: string[];
  finalUrl: string;
  redirects: string[];
  scannedAt: string;
  durationMs: number;
  score: number;
  grade: Grade;
  tls: TlsInfo | null;
  dns: DnsInfo;
  checks: SecurityCheck[];
}
