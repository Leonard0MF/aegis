type ScanResult = {
  ip: string;
  headers: number;
  score: number;
};

// Simula delay de rede (igual API real)
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Camada de abstração do scanner.
 * Hoje: mock
 * Futuro: API real (/api/scan)
 */
export async function scanDomain(domain: string): Promise<ScanResult> {
  // simula latência de rede
  await delay(2000);

  // MOCK (substituível por API depois)
  return {
    ip: "93.184.216.34",
    headers: 7,
    score: 82,
  };
}