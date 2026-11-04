import net from "node:net";

export { normalizeDomain } from "./domainName";

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;
}

function inRange(ip: string, cidr: string): boolean {
  const [base, bits] = cidr.split("/");
  const mask = bits === "0" ? 0 : (~0 << (32 - Number(bits))) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

const PRIVATE_V4 = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "224.0.0.0/4",
  "240.0.0.0/4",
];

/** True para IPs internos/reservados (evita SSRF contra a rede local). */
export function isPrivateIp(ip: string): boolean {
  const version = net.isIP(ip);

  if (version === 4) {
    return PRIVATE_V4.some((cidr) => inRange(ip, cidr));
  }

  if (version === 6) {
    const v6 = ip.toLowerCase();
    if (v6 === "::" || v6 === "::1") return true;
    const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v6);
  }

  return true; // formato desconhecido: trata como inseguro
}
