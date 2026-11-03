import { NextRequest, NextResponse } from "next/server";
import dns from "node:dns/promises";
import type { ScanResult } from "@/types/scan";
import { isPrivateIp, normalizeDomain } from "@/lib/validators";

const TIMEOUT_MS = 8000;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function probe(url: string): Promise<Headers | null> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual", // não seguir redirects para hosts arbitrários
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "AEGIS-Scanner/1.0" },
    });
    // Descarta o corpo; só precisamos dos headers
    res.body?.cancel().catch(() => {});
    return res.headers;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  const domain = normalizeDomain((body as { domain?: unknown } | null)?.domain);
  if (!domain) {
    return fail("Invalid domain", 400);
  }

  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(domain, { all: true });
  } catch {
    return fail(`Could not resolve domain: ${domain}`, 404);
  }

  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
    return fail("Target resolves to a private or reserved address", 400);
  }

  // HTTPS primeiro: se a conexão TLS funcionar, o certificado é válido.
  let headers = await probe(`https://${domain}/`);
  const sslValid = headers !== null;
  if (!headers) {
    headers = await probe(`http://${domain}/`);
  }
  if (!headers) {
    return fail(`Host ${domain} did not respond`, 502);
  }

  const csp = headers.get("content-security-policy");
  const hasCsp = !!csp;
  const hasHsts = sslValid && headers.has("strict-transport-security");
  const hasXFrame =
    headers.has("x-frame-options") || /frame-ancestors/i.test(csp ?? "");

  const presentCount = [hasCsp, hasHsts, hasXFrame].filter(Boolean).length;
  const score =
    (sslValid ? 40 : 0) + (hasCsp ? 20 : 0) + (hasHsts ? 20 : 0) + (hasXFrame ? 20 : 0);

  const result: ScanResult = {
    domain,
    ip: addresses[0].address,
    ssl: { valid: sslValid },
    headers: {
      score: presentCount,
      csp: hasCsp,
      hsts: hasHsts,
      xFrameOptions: hasXFrame,
    },
    score,
  };

  return NextResponse.json(result);
}
