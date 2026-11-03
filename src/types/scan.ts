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

export interface GeoLocation {
  ip: string;
  lat: number;
  lon: number;
  city: string;
  region: string;
  country: string;
  countryCode: string;
  org: string;
  asn: number | null;
  /** hostname associado (ex.: servidor MX) */
  host?: string;
}

export interface GeoInfo {
  /** servidores web do domínio */
  servers: GeoLocation[];
  /** servidores de e-mail (MX) */
  mail: GeoLocation[];
  /** de onde o AEGIS fez o scan */
  origin: GeoLocation | null;
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
  /** opcional: scans salvos antes da geolocalização não têm este campo */
  geo?: GeoInfo;
}
