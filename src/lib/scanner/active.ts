import net from "node:net";
import { randomBytes } from "node:crypto";
import type { ActiveInfo, ExposedPath, OpenPort, SecurityCheck, Severity } from "@/types/scan";
import { isPrivateIp } from "@/lib/validators";
import { check } from "./checks";
import { request, type RawResponse } from "./http";

/**
 * Testes ATIVOS: só rodam depois da verificação de propriedade.
 * Tudo é não destrutivo: conexões TCP sem enviar dados e GETs simples.
 */

const PORTS: { port: number; service: string; risk: OpenPort["risk"] }[] = [
  { port: 21, service: "FTP", risk: "medium" },
  { port: 22, service: "SSH", risk: "info" },
  { port: 23, service: "Telnet", risk: "high" },
  { port: 25, service: "SMTP", risk: "info" },
  { port: 110, service: "POP3", risk: "low" },
  { port: 135, service: "MS RPC", risk: "high" },
  { port: 139, service: "NetBIOS", risk: "high" },
  { port: 143, service: "IMAP", risk: "low" },
  { port: 445, service: "SMB", risk: "critical" },
  { port: 1433, service: "Microsoft SQL Server", risk: "critical" },
  { port: 1521, service: "Oracle DB", risk: "critical" },
  { port: 2375, service: "Docker API (sem TLS)", risk: "critical" },
  { port: 2379, service: "etcd", risk: "critical" },
  { port: 3000, service: "App de desenvolvimento / Grafana", risk: "medium" },
  { port: 3306, service: "MySQL", risk: "critical" },
  { port: 3389, service: "RDP (Área de Trabalho Remota)", risk: "high" },
  { port: 5432, service: "PostgreSQL", risk: "critical" },
  { port: 5601, service: "Kibana", risk: "high" },
  { port: 5900, service: "VNC", risk: "high" },
  { port: 6379, service: "Redis", risk: "critical" },
  { port: 8080, service: "HTTP alternativo", risk: "low" },
  { port: 8443, service: "HTTPS alternativo", risk: "low" },
  { port: 9000, service: "Painel admin (PHP-FPM / Portainer / SonarQube)", risk: "medium" },
  { port: 9200, service: "Elasticsearch", risk: "critical" },
  { port: 10250, service: "Kubelet", risk: "critical" },
  { port: 11211, service: "Memcached", risk: "critical" },
  { port: 27017, service: "MongoDB", risk: "critical" },
];

function tcpOpen(ip: string, port: number, timeoutMs = 2500): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.connect({ host: ip, port });
    const done = (open: boolean) => {
      s.destroy();
      resolve(open);
    };
    s.setTimeout(timeoutMs, () => done(false));
    s.once("connect", () => done(true));
    s.once("error", () => done(false));
  });
}

/* ---------------- arquivos sensíveis ---------------- */

type Probe = {
  path: string;
  label: string;
  severity: Severity;
  /** confirma pelo conteúdo, não só pelo status (evita falso positivo de páginas "soft 404") */
  match: (r: RawResponse) => boolean;
};

const notHtml = (r: RawResponse) => !/^\s*<(!doctype|html|head|body)/i.test(r.body);

/** exportado para os testes */
export const PATHS: Probe[] = [
  { path: "/.git/HEAD", label: "Repositório Git exposto (código-fonte e histórico)", severity: "critical", match: (r) => /^ref: refs\//.test(r.body) },
  { path: "/.git/config", label: "Configuração do Git exposta", severity: "critical", match: (r) => /\[core\]/.test(r.body) && notHtml(r) },
  { path: "/.env", label: "Arquivo .env exposto (senhas e chaves)", severity: "critical", match: (r) => notHtml(r) && /^[A-Z][A-Z0-9_]{2,}=/m.test(r.body) },
  { path: "/.env.production", label: "Arquivo .env.production exposto", severity: "critical", match: (r) => notHtml(r) && /^[A-Z][A-Z0-9_]{2,}=/m.test(r.body) },
  { path: "/.svn/entries", label: "Repositório SVN exposto", severity: "high", match: (r) => notHtml(r) && /^\d+\s*$/m.test(r.body.slice(0, 20)) },
  { path: "/.hg/requires", label: "Repositório Mercurial exposto", severity: "high", match: (r) => notHtml(r) && /revlogv1|store/.test(r.body) },
  { path: "/.DS_Store", label: ".DS_Store exposto (lista de arquivos)", severity: "low", match: (r) => r.head.subarray(4, 8).toString("latin1") === "Bud1" },
  { path: "/.htpasswd", label: ".htpasswd exposto (hashes de senha)", severity: "critical", match: (r) => notHtml(r) && /^[\w.-]+:(\$apr1\$|\$2[aby]\$|\{SHA\}|[./0-9A-Za-z]{13}$)/m.test(r.body) },
  { path: "/wp-config.php.bak", label: "Backup do wp-config.php (credenciais do banco)", severity: "critical", match: (r) => notHtml(r) && /DB_PASSWORD/.test(r.body) },
  { path: "/wp-config.php~", label: "Cópia do wp-config.php (credenciais do banco)", severity: "critical", match: (r) => notHtml(r) && /DB_PASSWORD/.test(r.body) },
  { path: "/config.php.bak", label: "Backup de config.php", severity: "high", match: (r) => /<\?php/.test(r.body) },
  { path: "/backup.zip", label: "Backup .zip público", severity: "critical", match: (r) => r.head.subarray(0, 2).toString("latin1") === "PK" },
  { path: "/backup.tar.gz", label: "Backup .tar.gz público", severity: "critical", match: (r) => r.head[0] === 0x1f && r.head[1] === 0x8b },
  { path: "/backup.sql", label: "Dump de banco de dados público", severity: "critical", match: (r) => notHtml(r) && /(CREATE TABLE|INSERT INTO)/i.test(r.body) },
  { path: "/dump.sql", label: "Dump de banco de dados público", severity: "critical", match: (r) => notHtml(r) && /(CREATE TABLE|INSERT INTO)/i.test(r.body) },
  { path: "/database.sql", label: "Dump de banco de dados público", severity: "critical", match: (r) => notHtml(r) && /(CREATE TABLE|INSERT INTO)/i.test(r.body) },
  { path: "/phpinfo.php", label: "phpinfo() exposto (configuração completa do servidor)", severity: "high", match: (r) => /phpinfo\(\)|PHP Version <\/td>|<title>PHP \d/i.test(r.body) },
  { path: "/info.php", label: "phpinfo() exposto", severity: "high", match: (r) => /phpinfo\(\)|<title>PHP \d/i.test(r.body) },
  { path: "/server-status", label: "Apache server-status (requisições em tempo real)", severity: "high", match: (r) => /Apache Server Status/i.test(r.body) },
  { path: "/server-info", label: "Apache server-info (configuração do servidor)", severity: "high", match: (r) => /Apache Server Information/i.test(r.body) },
  { path: "/actuator/env", label: "Spring Boot Actuator /env (variáveis e segredos)", severity: "critical", match: (r) => /"activeProfiles"|"propertySources"/.test(r.body) },
  { path: "/actuator/heapdump", label: "Spring Boot heapdump (memória do processo)", severity: "critical", match: (r) => r.status === 200 && /octet-stream/i.test(r.headers.get("content-type") ?? "") },
  { path: "/debug/pprof/", label: "Go pprof exposto", severity: "medium", match: (r) => /Types of profiles available/i.test(r.body) },
  { path: "/elmah.axd", label: "ELMAH (log de erros ASP.NET)", severity: "high", match: (r) => /Error Log for/i.test(r.body) },
  { path: "/trace.axd", label: "ASP.NET trace exposto", severity: "high", match: (r) => /Application Trace/i.test(r.body) },
  { path: "/composer.json", label: "composer.json público (dependências e versões)", severity: "low", match: (r) => notHtml(r) && /"require"\s*:/.test(r.body) },
  { path: "/package.json", label: "package.json público (dependências e versões)", severity: "low", match: (r) => notHtml(r) && /"dependencies"\s*:/.test(r.body) },
  { path: "/phpmyadmin/", label: "phpMyAdmin acessível pela internet", severity: "high", match: (r) => /phpMyAdmin/i.test(r.body) && /pma_|phpmyadmin\.css|<title>phpMyAdmin/i.test(r.body) },
  { path: "/adminer.php", label: "Adminer acessível pela internet", severity: "high", match: (r) => /adminer/i.test(r.body) && /<title>.*Adminer/i.test(r.body) },
  { path: "/wp-json/wp/v2/users", label: "WordPress lista usuários publicamente", severity: "medium", match: (r) => notHtml(r) && /^\[\s*\{"id":\d+,"name"/.test(r.body) },
  { path: "/xmlrpc.php", label: "WordPress xmlrpc.php ativo (força bruta amplificada)", severity: "low", match: (r) => /XML-RPC server accepts POST requests only/i.test(r.body) },
];

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

export async function runActive(domain: string, ip: string, base: "https" | "http"): Promise<ActiveInfo> {
  if (isPrivateIp(ip)) throw new Error("private ip");

  const portsP = Promise.all(PORTS.map(async (p) => ((await tcpOpen(ip, p.port)) ? p : null)));

  const origin = `${base}://${domain}`;
  // página aleatória: se o servidor devolver 200 + listagem para tudo, a checagem de diretório é ignorada
  const random = await request(new URL(`${origin}/aegis-${randomBytes(6).toString("hex")}/`), { maxBody: 16384, timeoutMs: 6000 });
  const catchAll = random?.status === 200;

  const found = await pool(PATHS, 5, async (p): Promise<ExposedPath | null> => {
    const r = await request(new URL(origin + p.path), { maxBody: 64 * 1024, timeoutMs: 6000 });
    if (!r || r.status !== 200 || !p.match(r)) return null;
    return { path: p.path, label: p.label, severity: p.severity, status: r.status };
  });

  const exposed = found.filter((x): x is ExposedPath => !!x);

  // listagem de diretório em pastas comuns
  if (!catchAll) {
    for (const dir of ["/uploads/", "/backup/", "/files/", "/wp-content/uploads/"]) {
      const r = await request(new URL(origin + dir), { maxBody: 16384, timeoutMs: 6000 });
      if (r?.status === 200 && /<title>Index of \//i.test(r.body)) {
        exposed.push({ path: dir, label: "Listagem de diretório ativa", severity: "medium", status: 200 });
        break;
      }
    }
  }

  const ports = (await portsP)
    .filter((p): p is (typeof PORTS)[number] => !!p)
    .map(({ port, service, risk }) => ({ port, service, risk }));

  return {
    scannedAt: new Date().toISOString(),
    ports,
    portsTested: PORTS.length,
    exposed,
    pathsTested: PATHS.length + 4,
  };
}

const CAP: Record<Severity, number | undefined> = { critical: 20, high: 50, medium: undefined, low: undefined };

export function activeChecks(a: ActiveInfo): SecurityCheck[] {
  const out: SecurityCheck[] = [];
  const bySev = (s: Severity) => a.exposed.filter((e) => e.severity === s);
  const crit = bySev("critical");
  const high = bySev("high");
  const minor = [...bySev("medium"), ...bySev("low")];

  out.push(
    check(
      "exposed-files", "exposure", "Arquivos sensíveis expostos", 15,
      crit.length || high.length ? "fail" : minor.length ? "warn" : "pass",
      a.exposed.length
        ? a.exposed.map((e) => `${e.path} (${e.label})`).slice(0, 5).join(" · ")
        : `${a.pathsTested} caminhos testados, nada exposto`,
      crit.length ? CAP.critical : high.length ? CAP.high : undefined,
    ),
  );

  const dangerous = a.ports.filter((p) => p.risk === "critical" || p.risk === "high");
  const critPorts = a.ports.filter((p) => p.risk === "critical");
  out.push(
    check(
      "open-ports", "exposure", "Portas de serviços internos", 12,
      dangerous.length ? "fail" : "pass",
      dangerous.length
        ? `Abertas para a internet: ${dangerous.map((p) => `${p.port} ${p.service}`).join(", ")}`
        : `${a.portsTested} portas testadas; abertas: ${a.ports.map((p) => p.port).join(", ") || "nenhuma além do esperado"}`,
      critPorts.length ? 40 : undefined,
    ),
  );
  return out;
}
