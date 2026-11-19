import type { Technology } from "@/types/scan";

type Cat = Technology["category"];

/** "nginx/1.18.0 (Ubuntu)" → versão "1.18.0" */
const ver = (s: string | undefined) => /(\d+(?:\.\d+){1,3})/.exec(s ?? "")?.[1];

/** Servidores e linguagens anunciados em headers */
const HEADER_RULES: { header: string; re: RegExp; name: string; category: Cat }[] = [
  { header: "server", re: /nginx(?:\/([\d.]+))?/i, name: "nginx", category: "server" },
  { header: "server", re: /openresty(?:\/([\d.]+))?/i, name: "OpenResty", category: "server" },
  { header: "server", re: /apache(?:\/([\d.]+))?/i, name: "Apache HTTP Server", category: "server" },
  { header: "server", re: /microsoft-iis(?:\/([\d.]+))?/i, name: "Microsoft IIS", category: "server" },
  { header: "server", re: /litespeed/i, name: "LiteSpeed", category: "server" },
  { header: "server", re: /caddy/i, name: "Caddy", category: "server" },
  { header: "server", re: /envoy/i, name: "Envoy", category: "server" },
  { header: "server", re: /gunicorn(?:\/([\d.]+))?/i, name: "Gunicorn", category: "server" },
  { header: "server", re: /openssl(?:\/([\d.]+[a-z]?))?/i, name: "OpenSSL", category: "library" },
  { header: "server", re: /php(?:\/([\d.]+))?/i, name: "PHP", category: "language" },
  { header: "x-powered-by", re: /php(?:\/([\d.]+))?/i, name: "PHP", category: "language" },
  { header: "x-powered-by", re: /express/i, name: "Express", category: "framework" },
  { header: "x-powered-by", re: /next\.js(?:\s*([\d.]+))?/i, name: "Next.js", category: "framework" },
  { header: "x-powered-by", re: /asp\.net/i, name: "ASP.NET", category: "framework" },
  { header: "x-aspnet-version", re: /([\d.]+)/, name: "ASP.NET", category: "framework" },
  { header: "x-generator", re: /drupal\s*([\d.]+)?/i, name: "Drupal", category: "cms" },
];

/** CDN / hospedagem reconhecidas por headers característicos */
const EDGE_RULES: { test: (h: Headers) => boolean; name: string; category: Cat }[] = [
  { test: (h) => h.has("cf-ray") || /cloudflare/i.test(h.get("server") ?? ""), name: "Cloudflare", category: "cdn" },
  { test: (h) => h.has("x-vercel-id"), name: "Vercel", category: "hosting" },
  { test: (h) => h.has("x-amz-cf-id"), name: "Amazon CloudFront", category: "cdn" },
  { test: (h) => /akamai/i.test(h.get("server") ?? "") || h.has("x-akamai-transformed"), name: "Akamai", category: "cdn" },
  { test: (h) => h.has("x-fastly-request-id") || /fastly/i.test(h.get("via") ?? ""), name: "Fastly", category: "cdn" },
  { test: (h) => h.has("x-nf-request-id"), name: "Netlify", category: "hosting" },
  { test: (h) => /github\.com/i.test(h.get("server") ?? ""), name: "GitHub Pages", category: "hosting" },
  { test: (h) => h.has("x-azure-ref"), name: "Azure Front Door", category: "cdn" },
];

/** Bibliotecas JS reconhecidas pelo caminho do <script src> (npm = nome no OSV) */
const SCRIPT_RULES: { re: RegExp; name: string; npm: string }[] = [
  { re: /jquery[.-]?(\d+\.\d+\.\d+)(?:\.min|\.slim)*\.js/i, name: "jQuery", npm: "jquery" },
  { re: /jquery\/(\d+\.\d+\.\d+)\//i, name: "jQuery", npm: "jquery" },
  { re: /jquery@(\d+\.\d+\.\d+)/i, name: "jQuery", npm: "jquery" },
  { re: /jquery-ui[.-]?(\d+\.\d+\.\d+)/i, name: "jQuery UI", npm: "jquery-ui" },
  { re: /jqueryui\/(\d+\.\d+\.\d+)\//i, name: "jQuery UI", npm: "jquery-ui" },
  { re: /bootstrap(?:@|\/|[.-])(\d+\.\d+\.\d+)/i, name: "Bootstrap", npm: "bootstrap" },
  { re: /angular(?:js)?(?:@|\/)(1\.\d+\.\d+)/i, name: "AngularJS", npm: "angular" },
  { re: /vue(?:@|\/)(\d+\.\d+\.\d+)/i, name: "Vue.js", npm: "vue" },
  { re: /react(?:-dom)?(?:@|\/)(\d+\.\d+\.\d+)/i, name: "React", npm: "react" },
  { re: /lodash(?:\.js)?(?:@|\/)(\d+\.\d+\.\d+)/i, name: "Lodash", npm: "lodash" },
  { re: /moment(?:\.js)?(?:@|\/)(\d+\.\d+\.\d+)/i, name: "Moment.js", npm: "moment" },
  { re: /handlebars(?:\.js)?(?:@|\/)(\d+\.\d+\.\d+)/i, name: "Handlebars", npm: "handlebars" },
  { re: /dompurify(?:@|\/)(\d+\.\d+\.\d+)/i, name: "DOMPurify", npm: "dompurify" },
  { re: /swiper(?:@|\/)(\d+\.\d+\.\d+)/i, name: "Swiper", npm: "swiper" },
];

/**
 * Tags `<name ...>` do HTML com busca linear (indexOf). Regex como /<script[^>]+src=/ retrocede de forma
 * quadrática em HTML malicioso sem ">" e travaria o event loop por segundos.
 */
function tags(html: string, name: string, max = 300): string[] {
  const out: string[] = [];
  const lower = html.toLowerCase();
  const open = `<${name}`;
  let i = 0;
  while (out.length < max) {
    i = lower.indexOf(open, i);
    if (i === -1) break;
    const next = lower[i + open.length];
    const end = lower.indexOf(">", i);
    if (end === -1) break;
    if (next !== undefined && /[\s/>]/.test(next) && end - i <= 2048) out.push(html.slice(i, end + 1));
    i = end + 1;
  }
  return out;
}

/** Valor de um atributo dentro de uma tag já isolada (no máximo 2 KB). */
const attr = (tag: string, name: string) =>
  new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag)?.[1];

export interface DetectedTech extends Technology {
  /** pacote npm (bibliotecas JS) para consultar no OSV */
  npm?: string;
  /** produto no NVD (vendor:product) para softwares de servidor */
  cpe?: string;
}

const CPE: Record<string, string> = {
  nginx: "f5:nginx",
  "Apache HTTP Server": "apache:http_server",
  PHP: "php:php",
  "Microsoft IIS": "microsoft:internet_information_services",
  OpenSSL: "openssl:openssl",
  WordPress: "wordpress:wordpress",
  Drupal: "drupal:drupal",
  Joomla: "joomla:joomla\\!",
  OpenResty: "openresty:openresty",
};

export function detectTech(h: Headers | null, html: string): DetectedTech[] {
  const found = new Map<string, DetectedTech>();
  const add = (t: DetectedTech) => {
    const prev = found.get(t.name);
    // mantém a detecção com versão
    if (!prev || (!prev.version && t.version)) found.set(t.name, { ...t, cpe: CPE[t.name], npm: t.npm ?? prev?.npm });
  };

  if (h) {
    for (const r of HEADER_RULES) {
      const v = h.get(r.header);
      const m = v ? r.re.exec(v) : null;
      // OpenSSL usa letra na versão (1.0.2k) e o CPE do NVD também
      if (m) add({ name: r.name, version: r.name === "OpenSSL" ? m[1] : ver(m[1]), category: r.category, evidence: `header ${r.header}: ${v}` });
    }
    for (const r of EDGE_RULES) if (r.test(h)) add({ name: r.name, category: r.category, evidence: "headers da resposta" });
    const cookies = h.getSetCookie().join(" ");
    if (/PHPSESSID/.test(cookies)) add({ name: "PHP", category: "language", evidence: "cookie PHPSESSID" });
    if (/JSESSIONID/.test(cookies)) add({ name: "Java (Servlet)", category: "language", evidence: "cookie JSESSIONID" });
    if (/laravel_session/.test(cookies)) add({ name: "Laravel", category: "framework", evidence: "cookie laravel_session" });
    if (/ASP\.NET_SessionId/.test(cookies)) add({ name: "ASP.NET", category: "framework", evidence: "cookie ASP.NET_SessionId" });
  }

  if (html) {
    const genTag = tags(html, "meta").find((t) => attr(t, "name")?.toLowerCase() === "generator");
    const gen = genTag ? attr(genTag, "content") : undefined;
    if (gen) {
      const g = gen.trim();
      if (/wordpress/i.test(g)) add({ name: "WordPress", version: ver(g), category: "cms", evidence: `meta generator: ${g}` });
      else if (/joomla/i.test(g)) add({ name: "Joomla", version: ver(g), category: "cms", evidence: `meta generator: ${g}` });
      else if (/drupal/i.test(g)) add({ name: "Drupal", version: ver(g), category: "cms", evidence: `meta generator: ${g}` });
      else if (/wix/i.test(g)) add({ name: "Wix", category: "cms", evidence: `meta generator: ${g}` });
      else add({ name: g.split(/\s/)[0], version: ver(g), category: "cms", evidence: `meta generator: ${g}` });
    }
    if (/\/wp-content\/|\/wp-includes\//i.test(html) && !found.has("WordPress")) {
      const v = /wp-includes\/[^"'\s?]{1,200}\?ver=(\d+\.\d+(?:\.\d+)?)/i.exec(html)?.[1];
      add({ name: "WordPress", version: v, category: "cms", evidence: "caminhos /wp-content/" });
    }
    if (/__NEXT_DATA__|\/_next\/static\//.test(html)) add({ name: "Next.js", category: "framework", evidence: "assets /_next/" });
    if (/\/_nuxt\//.test(html)) add({ name: "Nuxt", category: "framework", evidence: "assets /_nuxt/" });
    if (/cdn\.shopify\.com/i.test(html)) add({ name: "Shopify", category: "hosting", evidence: "assets cdn.shopify.com" });

    const srcs = tags(html, "script")
      .map((t) => attr(t, "src"))
      .filter((v): v is string => !!v)
      .slice(0, 80);
    for (const src of srcs) {
      for (const r of SCRIPT_RULES) {
        const m = r.re.exec(src);
        if (m) add({ name: r.name, version: m[1], category: "library", evidence: `script ${src.slice(0, 120)}`, npm: r.npm });
      }
    }
  }

  return [...found.values()];
}
