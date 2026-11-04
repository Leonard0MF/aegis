export type CheckStatus = "pass" | "warn" | "fail" | "info";

export type CheckCategory =
  | "tls"
  | "transport"
  | "headers"
  | "cookies"
  | "dns"
  | "email"
  | "vulns"
  | "reputation"
  | "surface"
  | "exposure";

export type Severity = "critical" | "high" | "medium" | "low";

export type Grade = "A" | "B" | "C" | "D" | "F";

export interface SecurityCheck {
  id: string;
  category: CheckCategory;
  label: string;
  status: CheckStatus;
  detail: string;
  weight: number;
  /** achado grave: a nota final não passa deste valor */
  cap?: number;
}

export interface TlsVersionSupport {
  version: "TLSv1" | "TLSv1.1" | "TLSv1.2" | "TLSv1.3";
  supported: boolean;
  cipher?: string;
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
  /* --- campos do scan aprofundado (opcionais em scans antigos) --- */
  cipher?: string;
  keyType?: string;
  keyBits?: number;
  signatureAlgorithm?: string;
  chain?: string[];
  ocspStapled?: boolean;
  versions?: TlsVersionSupport[];
}

export interface DnsInfo {
  spf: string | null;
  dmarc: string | null;
  mx: string[];
  caa: string[];
  /** DMARC herdado do domínio organizacional (RFC 7489 §6.6.3) */
  dmarcFrom?: string;
  /** CAA herdado de um domínio pai (RFC 8659 §3) */
  caaFrom?: string;
  /** plataforma que controla o DNS (ex.: vercel.app) */
  platform?: string | null;
}

export interface EmailInfo {
  spf: {
    record: string | null;
    all: "+all" | "~all" | "-all" | "?all" | null;
    lookups: number;
    includes: string[];
  };
  dmarc: {
    record: string | null;
    policy: string | null;
    subdomainPolicy: string | null;
    pct: number;
    reporting: boolean;
    /** registro veio do domínio organizacional; vale a política sp (ou p) */
    inheritedFrom?: string;
  };
  dkim: string[];
  mtaSts: { record: boolean; mode: string | null };
  tlsRpt: boolean;
  dnssec: boolean | null;
  /** DNS controlado por uma plataforma (ex.: vercel.app): SPF/DMARC fora do alcance do dono */
  platform?: string | null;
}

export interface Technology {
  name: string;
  version?: string;
  category: "server" | "language" | "framework" | "cms" | "library" | "cdn" | "hosting";
  /** de onde veio a detecção (header, meta, script…) */
  evidence: string;
}

export interface Vulnerability {
  id: string;
  aliases: string[];
  summary: string;
  severity: Severity;
  cvss?: number;
  /** nome + versão da tecnologia afetada */
  affects: string;
  fixedIn?: string;
  /** está no catálogo CISA KEV (exploração ativa confirmada) */
  kev: boolean;
  url: string;
}

export interface VulnTotals {
  total: number;
  kev: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface ReputationEntry {
  list: string;
  target: string;
  status: "clean" | "listed" | "unavailable" | "not_configured";
  detail?: string;
}

export interface Subdomain {
  name: string;
  ips: string[];
  cname?: string;
  /** IP interno publicado no DNS */
  privateIp?: boolean;
  takeover?: { service: string; reason: string };
  /** CNAME para um nome que não existe (sem risco de takeover conhecido) */
  dangling?: boolean;
  interesting?: boolean;
}

export interface SurfaceInfo {
  source: string;
  total: number;
  /** quantos foram resolvidos/analisados (há um limite por scan) */
  analyzed: number;
  subdomains: Subdomain[];
  error?: string;
}

export interface OpenPort {
  port: number;
  service: string;
  risk: Severity | "info";
}

export interface ExposedPath {
  path: string;
  label: string;
  severity: Severity;
  status: number;
}

export interface ActiveInfo {
  scannedAt: string;
  ports: OpenPort[];
  portsTested: number;
  exposed: ExposedPath[];
  pathsTested: number;
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
  /* --- scan aprofundado (opcionais em scans antigos) --- */
  email?: EmailInfo;
  tech?: Technology[];
  /** até 15 CVEs por tecnologia (as mais graves); os totais reais ficam em vulnTotals */
  vulns?: Vulnerability[];
  vulnTotals?: VulnTotals;
  reputation?: ReputationEntry[];
  securityTxt?: boolean;
  surface?: SurfaceInfo;
  active?: ActiveInfo;
  /** motivo, se a nota foi limitada por um achado grave */
  capReason?: string;
}
