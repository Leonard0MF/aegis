export interface ScanResult {
  domain: string;

  ip: string;

  ssl: {
    valid: boolean;
  };

  headers: {
    score: number;

    csp: boolean;
    hsts: boolean;
    xFrameOptions: boolean;
  };

  score: number;
}