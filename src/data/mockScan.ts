import type { ScanResult } from "@/types/scan";

export const mockScan: ScanResult = {
  domain: "openai.com",
  ip: "104.18.33.45",
  ssl: { valid: true },
  headers: {
    score: 3,
    csp: true,
    hsts: true,
    xFrameOptions: true,
  },
  score: 100,
};
