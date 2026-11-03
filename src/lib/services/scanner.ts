import type { ScanResult } from "@/types/scan";

export async function scanDomain(domain: string): Promise<ScanResult> {
  const response = await fetch("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error ?? `Scan failed (HTTP ${response.status})`);
  }

  return data as ScanResult;
}
