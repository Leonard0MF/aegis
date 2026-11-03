import tls from "node:tls";
import type { TlsInfo, TlsVersionSupport } from "@/types/scan";

const TIMEOUT_MS = 8000;
const PROBE_TIMEOUT_MS = 5000;
const DAY_MS = 24 * 60 * 60 * 1000;
const VERSIONS: TlsVersionSupport["version"][] = ["TLSv1", "TLSv1.1", "TLSv1.2", "TLSv1.3"];

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Nomes da cadeia, do certificado do site até a raiz. */
function chainOf(socket: tls.TLSSocket): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  let c: tls.DetailedPeerCertificate | undefined = socket.getPeerCertificate(true);
  while (c && c.fingerprint256 && !seen.has(c.fingerprint256) && names.length < 6) {
    seen.add(c.fingerprint256);
    names.push(first(c.subject?.CN) ?? first(c.subject?.O) ?? "?");
    if (c.issuerCertificate === c) break;
    c = c.issuerCertificate;
  }
  return names;
}

/**
 * Abre um handshake TLS direto no IP já validado (evita re-resolução de DNS / SSRF)
 * e lê o certificado. Não rejeita certificados inválidos: queremos reportar o motivo.
 */
export function inspectTls(ip: string, servername: string): Promise<TlsInfo | null> {
  return new Promise((resolve) => {
    let done = false;
    let ocspStapled = false;
    const finish = (v: TlsInfo | null) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(v);
    };

    // requestOCSP existe no Node, mas falta nos tipos de @types/node 20
    const socket = tls.connect({
      host: ip,
      port: 443,
      servername,
      rejectUnauthorized: false,
      timeout: TIMEOUT_MS,
      requestOCSP: true,
    } as tls.ConnectionOptions);

    socket.on("OCSPResponse", (r: Buffer | null) => {
      ocspStapled = !!r && r.length > 0;
    });

    socket.once("secureConnect", () => {
      const cert = socket.getPeerCertificate();
      if (!cert || Object.keys(cert).length === 0) return finish(null);

      const validTo = new Date(cert.valid_to);
      const validFrom = new Date(cert.valid_from);
      // authorized cobre cadeia/expiração; o hostname é checado à parte
      const hostError = tls.checkServerIdentity(servername, cert);
      const error = socket.authorizationError
        ? String(socket.authorizationError)
        : hostError?.message;

      let keyType: string | undefined;
      let keyBits: number | undefined;
      let signatureAlgorithm: string | undefined;
      try {
        const x = socket.getPeerX509Certificate();
        const pk = x?.publicKey;
        keyType = pk?.asymmetricKeyType?.toUpperCase();
        const d = pk?.asymmetricKeyDetails;
        keyBits =
          d?.modulusLength ??
          (d?.namedCurve ? ({ prime256v1: 256, secp384r1: 384, secp521r1: 521 } as Record<string, number>)[d.namedCurve] : undefined) ??
          cert.bits;
        signatureAlgorithm = (x as unknown as { signatureAlgorithm?: string })?.signatureAlgorithm;
      } catch {
        keyBits = cert.bits;
      }

      // o evento OCSPResponse chega junto do handshake; um tick garante que já rodou
      setImmediate(() =>
        finish({
          valid: socket.authorized && !hostError,
          error,
          issuer: first(cert.issuer?.O) ?? first(cert.issuer?.CN) ?? "UNKNOWN",
          validFrom: validFrom.toISOString(),
          validTo: validTo.toISOString(),
          daysRemaining: Math.floor((validTo.getTime() - Date.now()) / DAY_MS),
          protocol: socket.getProtocol() ?? "UNKNOWN",
          altNames: (cert.subjectaltname ?? "")
            .split(",")
            .map((s) => s.trim().replace(/^DNS:/, ""))
            .filter(Boolean)
            .slice(0, 20),
          cipher: socket.getCipher()?.name,
          keyType,
          keyBits,
          signatureAlgorithm,
          chain: chainOf(socket),
          ocspStapled,
        }),
      );
    });

    socket.once("timeout", () => finish(null));
    socket.once("error", () => finish(null));
  });
}

/** O servidor aceita um handshake fixo nesta versão? (SECLEVEL=0 para conseguir testar as antigas) */
function probeVersion(ip: string, servername: string, version: TlsVersionSupport["version"]): Promise<TlsVersionSupport> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (supported: boolean, cipher?: string) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve({ version, supported, cipher });
    };
    const socket = tls.connect({
      host: ip,
      port: 443,
      servername,
      minVersion: version,
      maxVersion: version,
      ciphers: "DEFAULT@SECLEVEL=0",
      rejectUnauthorized: false,
      timeout: PROBE_TIMEOUT_MS,
    });
    socket.once("secureConnect", () => finish(true, socket.getCipher()?.name));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

export function probeTlsVersions(ip: string, servername: string): Promise<TlsVersionSupport[]> {
  return Promise.all(VERSIONS.map((v) => probeVersion(ip, servername, v)));
}
