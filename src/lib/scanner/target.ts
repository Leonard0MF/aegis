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
    return { error: fail("Corpo da requisição não é um JSON válido", 400) };
  }
  return resolveTarget((body as { domain?: unknown } | null)?.domain);
}

export async function resolveTarget(raw: unknown): Promise<Target> {
  const domain = normalizeDomain(raw);
  if (!domain) return { error: fail("Domínio inválido", 400) };

  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(domain, { all: true });
  } catch {
    return { error: fail(`Não foi possível resolver o domínio ${domain}`, 404) };
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
    return { error: fail("O domínio aponta para um endereço privado ou reservado", 400) };
  }
  // IPv4 primeiro: nem toda rede tem rota IPv6
  const ips = addresses
    .map((a) => a.address)
    .sort((a, b) => Number(a.includes(":")) - Number(b.includes(":")));
  return { domain, ips };
}
