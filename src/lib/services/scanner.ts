import { ScanResult } from "@/types/scan";

export async function scanDomain(
  domain: string
): Promise<ScanResult> {

  const response = await fetch("/api/scan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      domain,
    }),
  });

  if (!response.ok) {
    throw new Error("Scan failed");
  }

  return response.json();
}