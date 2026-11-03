import tls from "node:tls";
import type { TlsInfo } from "@/types/scan";

const TIMEOUT_MS = 8000;
const DAY_MS = 24 * 60 * 60 * 1000;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Abre um handshake TLS direto no IP já validado (evita re-resolução de DNS / SSRF)
 * e lê o certificado. Não rejeita certificados inválidos: queremos reportar o motivo.
 */
export function inspectTls(ip: string, servername: string): Promise<TlsInfo | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: TlsInfo | null) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(v);
    };

    const socket = tls.connect({
      host: ip,
      port: 443,
      servername,
      rejectUnauthorized: false,
      timeout: TIMEOUT_MS,
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
      });
    });

    socket.once("timeout", () => finish(null));
    socket.once("error", () => finish(null));
  });
}
