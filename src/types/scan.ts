export interface ScanResult {
  domain: string;
  ip: string;
  ssl: boolean;
  headers: number;
  score: number;
}