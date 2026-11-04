/**
 * Sufixos de plataformas onde cada cliente recebe um subdomínio (estão na Public Suffix List).
 * Em `app.vercel.app` o dono do site não controla o DNS: SPF, DMARC e CAA são da plataforma.
 */
const PLATFORM_SUFFIXES = [
  "vercel.app", "netlify.app", "github.io", "pages.dev", "workers.dev", "herokuapp.com",
  "onrender.com", "fly.dev", "web.app", "firebaseapp.com", "azurewebsites.net", "azurestaticapps.net",
  "cloudfront.net", "amplifyapp.com", "up.railway.app", "surge.sh", "glitch.me", "replit.app",
  "gitlab.io", "deno.dev", "vercel.dev", "ngrok.app", "ngrok-free.app", "trycloudflare.com",
];

const SECOND_LEVEL = /\.(com|net|org|gov|edu|co|ac|gob|nom|ind|art|eng|adv|blog)\.[a-z]{2}$/i;

/** Plataforma de hospedagem dona do DNS deste host, se houver. */
export function platformOf(host: string): string | null {
  const h = host.replace(/\.$/, "").toLowerCase();
  return PLATFORM_SUFFIXES.find((s) => h.endsWith(`.${s}`)) ?? null;
}

/** Domínio registrável (aproximação da Public Suffix List). */
export function registrable(host: string): string {
  const h = host.replace(/\.$/, "").toLowerCase();
  const labels = h.split(".");
  const platform = platformOf(h);
  if (platform) return labels.slice(-(platform.split(".").length + 1)).join(".");
  return labels.slice(SECOND_LEVEL.test(h) ? -3 : -2).join(".");
}
