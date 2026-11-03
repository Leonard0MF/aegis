import { NextRequest, NextResponse } from "next/server";
import dns from "node:dns/promises";
import { isPrivateIp, normalizeDomain } from "@/lib/validators";
import { runScan, ScanError } from "@/lib/scanner";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
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

  try {
    // IPv4 primeiro: nem toda rede tem rota IPv6
    const ips = addresses
      .map((a) => a.address)
      .sort((a, b) => Number(a.includes(":")) - Number(b.includes(":")));
    const result = await runScan(domain, ips);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ScanError) return fail(err.message, err.status);
    return fail("Scan failed", 500);
  }
}
