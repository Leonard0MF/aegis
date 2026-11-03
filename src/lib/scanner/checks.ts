import type {
  CheckCategory,
  CheckStatus,
  DnsInfo,
  SecurityCheck,
  TlsInfo,
} from "@/types/scan";

export interface CheckInput {
  tls: TlsInfo | null;
  headers: Headers | null;
  /** headers vieram de uma resposta HTTPS? */
  overHttps: boolean;
  httpRedirectsToHttps: boolean | null;
  dns: DnsInfo;
}

const HALF_YEAR_S = 15_552_000;

export function check(
  id: string,
  category: CheckCategory,
  label: string,
  weight: number,
  status: CheckStatus,
  detail: string,
  cap?: number,
): SecurityCheck {
  return cap === undefined ? { id, category, label, weight, status, detail } : { id, category, label, weight, status, detail, cap };
}

function tlsChecks(t: TlsInfo | null): SecurityCheck[] {
  if (!t) {
    return [check("tls-cert", "tls", "Certificado TLS", 25, "fail", "HTTPS indisponível (porta 443 não respondeu)")];
  }
  const out: SecurityCheck[] = [
    check(
      "tls-cert", "tls", "Certificado TLS", 25,
      t.valid ? "pass" : "fail",
      t.valid ? `Válido, emitido por ${t.issuer}` : `Inválido: ${t.error ?? "erro desconhecido"}`,
    ),
  ];

  out.push(
    check(
      "tls-expiry", "tls", "Validade do certificado", 8,
      t.daysRemaining < 0 ? "fail" : t.daysRemaining < 30 ? "warn" : "pass",
      t.daysRemaining < 0
        ? `Expirou há ${-t.daysRemaining} dias`
        : `Expira em ${t.daysRemaining} dias`,
    ),
  );

  const modern = t.protocol === "TLSv1.3" || t.protocol === "TLSv1.2";
  out.push(
    check("tls-protocol", "tls", "Versão do protocolo TLS", 5, modern ? "pass" : "fail", `Negociado: ${t.protocol}`),
  );

  if (t.versions) {
    const legacy = t.versions.filter((v) => v.supported && (v.version === "TLSv1" || v.version === "TLSv1.1"));
    const has13 = t.versions.some((v) => v.version === "TLSv1.3" && v.supported);
    out.push(
      check(
        "tls-legacy", "tls", "Versões antigas de TLS desativadas", 6,
        legacy.length ? "fail" : "pass",
        legacy.length
          ? `Ainda aceita ${legacy.map((v) => (v.version === "TLSv1" ? "TLS 1.0" : "TLS 1.1")).join(" e ")} (vulneráveis a BEAST/POODLE, proibidas pelo PCI DSS)`
          : "TLS 1.0 e 1.1 recusados",
      ),
      check(
        "tls-13", "tls", "Suporte a TLS 1.3", 2,
        has13 ? "pass" : "warn",
        has13 ? "TLS 1.3 disponível" : "TLS 1.3 não suportado (handshake mais lento, sem forward secrecy obrigatório)",
      ),
    );
    const weak = t.versions.find((v) => v.cipher && /RC4|3DES|DES-CBC|NULL|EXPORT|MD5/i.test(v.cipher));
    if (weak) {
      out.push(check("tls-weak-cipher", "tls", "Cifras fracas", 6, "fail", `Aceita ${weak.cipher} em ${weak.version}`));
    }
  }

  if (t.keyBits && t.keyType) {
    const weakKey = (t.keyType === "RSA" && t.keyBits < 2048) || (t.keyType === "EC" && t.keyBits < 256);
    out.push(
      check(
        "tls-key", "tls", "Chave do certificado", 4,
        weakKey ? "fail" : "pass",
        `${t.keyType} ${t.keyBits} bits${weakKey ? " (fraca: o mínimo é RSA 2048 / EC 256)" : ""}`,
      ),
    );
  }
  if (t.signatureAlgorithm) {
    const weakSig = /sha1|md5/i.test(t.signatureAlgorithm);
    out.push(
      check(
        "tls-sig", "tls", "Algoritmo de assinatura", 3,
        weakSig ? "fail" : "pass",
        weakSig ? `${t.signatureAlgorithm} (obsoleto, sujeito a colisões)` : t.signatureAlgorithm,
      ),
    );
  }
  if (t.ocspStapled !== undefined) {
    out.push(
      check(
        "tls-ocsp", "tls", "OCSP stapling", 0, "info",
        t.ocspStapled ? "Ativo (revogação verificada sem consultar a CA)" : "Inativo",
      ),
    );
  }
  return out;
}

function transportChecks(i: CheckInput): SecurityCheck[] {
  const out: SecurityCheck[] = [];

  out.push(
    check(
      "http-redirect", "transport", "Redirecionamento HTTP → HTTPS", 8,
      i.httpRedirectsToHttps === true ? "pass" : i.httpRedirectsToHttps === null ? "info" : "fail",
      i.httpRedirectsToHttps === true
        ? "HTTP redireciona para HTTPS"
        : i.httpRedirectsToHttps === null
          ? "Porta 80 não respondeu"
          : "HTTP não redireciona para HTTPS",
    ),
  );

  const hsts = i.overHttps ? i.headers?.get("strict-transport-security") : null;
  if (!hsts) {
    out.push(check("hsts", "transport", "HSTS (Strict-Transport-Security)", 10, "fail", "Header Strict-Transport-Security ausente"));
  } else {
    const maxAge = Number(/max-age\s*=\s*"?(\d+)/i.exec(hsts)?.[1] ?? 0);
    out.push(
      check(
        "hsts", "transport", "HSTS (Strict-Transport-Security)", 10,
        maxAge >= HALF_YEAR_S ? "pass" : "warn",
        maxAge >= HALF_YEAR_S
          ? `max-age=${maxAge}`
          : `max-age=${maxAge} é curto (recomendado ≥ ${HALF_YEAR_S})`,
      ),
    );
    out.push(
      check(
        "hsts-subdomains", "transport", "HSTS em subdomínios", 0, "info",
        /includesubdomains/i.test(hsts) ? "includeSubDomains ativo" : "Sem includeSubDomains",
      ),
    );
  }
  return out;
}

function headerChecks(h: Headers | null): SecurityCheck[] {
  if (!h) return [];
  const out: SecurityCheck[] = [];
  const csp = h.get("content-security-policy");

  out.push(
    check(
      "csp", "headers", "Content-Security-Policy", 10,
      csp ? (/unsafe-inline|unsafe-eval/i.test(csp) ? "warn" : "pass") : "fail",
      csp
        ? /unsafe-inline|unsafe-eval/i.test(csp)
          ? "Presente, mas permite unsafe-inline/unsafe-eval"
          : "Política presente"
        : "Header ausente",
    ),
  );

  const xfo = h.get("x-frame-options");
  const frameAncestors = /frame-ancestors/i.test(csp ?? "");
  out.push(
    check(
      "x-frame", "headers", "Proteção contra clickjacking", 8,
      xfo || frameAncestors ? "pass" : "fail",
      xfo ? `X-Frame-Options: ${xfo}` : frameAncestors ? "CSP frame-ancestors" : "Sem X-Frame-Options nem frame-ancestors",
    ),
  );

  const xcto = h.get("x-content-type-options");
  out.push(
    check(
      "xcto", "headers", "X-Content-Type-Options", 5,
      xcto?.toLowerCase().includes("nosniff") ? "pass" : "fail",
      xcto ? `Valor: ${xcto}` : "Header ausente",
    ),
  );

  const ref = h.get("referrer-policy");
  out.push(
    check(
      "referrer", "headers", "Referrer-Policy", 4,
      ref ? (/unsafe-url/i.test(ref) ? "warn" : "pass") : "warn",
      ref ? `Valor: ${ref}` : "Header ausente (padrão do navegador)",
    ),
  );

  const pp = h.get("permissions-policy");
  out.push(
    check("permissions", "headers", "Permissions-Policy", 3, pp ? "pass" : "warn", pp ? "Política presente" : "Header ausente"),
  );

  const leaks = ["server", "x-powered-by", "x-aspnet-version"]
    .map((n) => [n, h.get(n)] as const)
    .filter(([, v]) => v && /\d/.test(v));
  out.push(
    check(
      "info-leak", "headers", "Exposição de versão do servidor", 3,
      leaks.length ? "warn" : "pass",
      leaks.length ? leaks.map(([n, v]) => `${n}: ${v}`).join(" · ") : "Nenhuma versão de software exposta",
    ),
  );

  return out;
}

function cookieChecks(h: Headers | null): SecurityCheck[] {
  const cookies = h?.getSetCookie() ?? [];
  if (cookies.length === 0) {
    return [check("cookies", "cookies", "Cookies", 0, "info", "Nenhum cookie definido na resposta")];
  }
  const missing = (flag: RegExp) =>
    cookies.filter((c) => !flag.test(c)).map((c) => c.split("=")[0].trim());

  const noSecure = missing(/;\s*secure/i);
  const noHttpOnly = missing(/;\s*httponly/i);
  const noSameSite = missing(/;\s*samesite=/i);
  const list = (names: string[]) => names.slice(0, 4).join(", ") + (names.length > 4 ? "…" : "");

  return [
    check(
      "cookie-secure", "cookies", "Cookies com Secure", 4,
      noSecure.length ? "fail" : "pass",
      noSecure.length ? `Sem Secure: ${list(noSecure)}` : `${cookies.length} cookie(s) com Secure`,
    ),
    check(
      "cookie-httponly", "cookies", "Cookies com HttpOnly", 3,
      noHttpOnly.length ? "warn" : "pass",
      noHttpOnly.length ? `Sem HttpOnly: ${list(noHttpOnly)}` : "Todos com HttpOnly",
    ),
    check(
      "cookie-samesite", "cookies", "Cookies com SameSite", 3,
      noSameSite.length ? "warn" : "pass",
      noSameSite.length ? `Sem SameSite: ${list(noSameSite)}` : "Todos com SameSite",
    ),
  ];
}

function dnsChecks(d: DnsInfo): SecurityCheck[] {
  return [
    check(
      "caa", "dns", "CAA", 2,
      d.caa.length ? "pass" : "warn",
      d.caa.length ? `CAs autorizadas: ${[...new Set(d.caa)].join(", ")}` : "Sem CAA: qualquer autoridade pode emitir certificado para o domínio",
    ),
  ];
}

export function buildChecks(i: CheckInput): SecurityCheck[] {
  return [
    ...tlsChecks(i.tls),
    ...transportChecks(i),
    ...headerChecks(i.headers),
    ...cookieChecks(i.headers),
    ...dnsChecks(i.dns),
  ];
}
