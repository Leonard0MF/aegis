/* Sem dependências do Node: usado no navegador (mapa) e no servidor (testes ativos). */

/** Redes anycast/CDN: o mesmo IP responde de vários datacenters; a cidade é só a sede registrada. */
export const ANYCAST = /\b(vercel|cloudflare|fastly|akamai|cloudfront|google|incapsula|imperva|sucuri|stackpath|bunny|edgecast|edgio|netlify)\b/i;

/**
 * Bordas compartilhadas: o IP atende milhares de clientes e não pertence ao dono do domínio.
 * Mais estrita que ANYCAST: um IP do Google Cloud pode ser a VM do próprio cliente.
 */
export const SHARED_EDGE = /\b(vercel|cloudflare|fastly|akamai|cloudfront|amazon cloudfront|incapsula|imperva|sucuri|stackpath|bunny|edgecast|edgio|netlify|github)\b/i;
