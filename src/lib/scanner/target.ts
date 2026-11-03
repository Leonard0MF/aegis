import dns from "node:dns/promises";
import { NextResponse } from "next/server";
import { isPrivateIp, normalizeDomain } from "@/lib/validators";

export function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export type Target = { domain: string; ips: string[] } | { error: NextResponse };

/** Lê `{ domain }` do corpo, normaliza, resolve e recusa destinos internos. */
export async function readTarget(req: Request): Promise<Target> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { error: fail("Invalid JSON body", 400) };
  }
  return resolveTarget((body as { domain?: unknown } | null)?.domain);
}

export async function resolveTarget(raw: unknown): Promise<Target> {
  const domain = normalizeDomain(raw);
  if (!domain) return { error: fail("Invalid domain", 400) };

  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(domain, { all: true });
  } catch {
    return { error: fail(`Could not resolve domain: ${domain}`, 404) };
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
    return { error: fail("Target resolves to a private or reserved address", 400) };
  }
  // IPv4 primeiro: nem toda rede tem rota IPv6
  const ips = addresses
    .map((a) => a.address)
    .sort((a, b) => Number(a.includes(":")) - Number(b.includes(":")));
  return { domain, ips };
}
