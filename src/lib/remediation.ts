/** Como corrigir cada verificação (texto curto para relatórios). Chave = id do SecurityCheck. */
export const REMEDIATION: Record<string, string> = {
  /* TLS */
  "tls-cert": "Instale um certificado válido emitido para o domínio (ex.: Let's Encrypt), com a cadeia intermediária completa.",
  "tls-expiry": "Renove o certificado e automatize a renovação (ACME/certbot ou o painel do provedor).",
  "tls-protocol": "Negocie TLS 1.2 ou superior; desative SSLv3, TLS 1.0 e TLS 1.1 no servidor ou CDN.",
  "tls-legacy": "Desative TLS 1.0 e 1.1: são vulneráveis e foram descontinuados (RFC 8996).",
  "tls-13": "Habilite TLS 1.3: handshake mais rápido e só cifras modernas.",
  "tls-weak-cipher": "Remova cifras sem forward secrecy ou com RC4/3DES/CBC; prefira ECDHE + AES-GCM/ChaCha20.",
  "tls-key": "Use chave RSA de 2048 bits ou mais, ou ECDSA P-256.",
  "tls-sig": "Reemita o certificado com assinatura SHA-256 ou superior.",
  "tls-ocsp": "Ative OCSP stapling no servidor para acelerar e proteger a validação do certificado.",
  /* transporte */
  hsts: "Envie Strict-Transport-Security: max-age=31536000; includeSubDomains.",
  "hsts-subdomains": "Inclua includeSubDomains no HSTS (e, quando todos os subdomínios tiverem HTTPS, preload).",
  "http-redirect": "Redirecione todo acesso HTTP para HTTPS com 301.",
  /* headers */
  csp: "Defina uma Content-Security-Policy com nonce ou hash em script-src, sem 'unsafe-inline'/'unsafe-eval', e frame-ancestors 'none'.",
  "x-frame": "Bloqueie o carregamento em iframes: X-Frame-Options: DENY ou CSP frame-ancestors 'none'.",
  xcto: "Envie X-Content-Type-Options: nosniff.",
  referrer: "Envie Referrer-Policy: strict-origin-when-cross-origin.",
  permissions: "Envie Permissions-Policy desligando o que o site não usa (camera=(), microphone=(), geolocation=()).",
  "info-leak": "Remova headers que revelam versão de software (Server, X-Powered-By, X-AspNet-Version).",
  "security-txt": "Publique /.well-known/security.txt (RFC 9116) com Contact e Expires.",
  /* cookies */
  cookies: "Marque cookies de sessão com Secure, HttpOnly e SameSite=Lax ou Strict.",
  "cookie-secure": "Adicione o atributo Secure aos cookies para que só trafeguem por HTTPS.",
  "cookie-httponly": "Adicione HttpOnly aos cookies de sessão para que JavaScript não consiga lê-los.",
  "cookie-samesite": "Defina SameSite=Lax (ou Strict) para reduzir o risco de CSRF.",
  /* DNS */
  caa: "Publique registros CAA autorizando só as autoridades que você usa (ex.: 0 issue \"letsencrypt.org\").",
  dnssec: "Ative DNSSEC no provedor de DNS e publique o registro DS no registrador.",
  /* e-mail */
  spf: "Publique um SPF terminando em -all (ou \"v=spf1 -all\" se o domínio não envia e-mail).",
  dmarc: "Publique DMARC em _dmarc com p=quarantine ou p=reject e rua= para receber relatórios.",
  dkim: "Ative a assinatura DKIM no provedor de e-mail e publique a chave no DNS.",
  "mta-sts": "Publique MTA-STS (_mta-sts TXT + política em https://mta-sts.<domínio>/.well-known/mta-sts.txt).",
  "tls-rpt": "Publique _smtp._tls com rua= para receber relatórios de falhas de TLS na entrega de e-mail.",
  /* vulnerabilidades */
  vulns: "Atualize as bibliotecas e servidores afetados para a versão corrigida indicada em cada CVE.",
  "vulns-kev": "Prioridade máxima: estas CVEs estão sendo exploradas ativamente (CISA KEV). Atualize imediatamente.",
  /* reputação */
  reputation: "Investigue o motivo da listagem, limpe o comprometimento e peça a remoção à lista que acusou o domínio.",
  /* superfície */
  surface: "Revise os subdomínios públicos e desative os que não estão em uso.",
  takeover: "Remova o registro DNS que aponta para o serviço desativado (risco de sequestro do subdomínio).",
  "sensitive-subs": "Restrinja o acesso a painéis, ambientes de teste e admin (VPN, IP allowlist ou autenticação).",
  "internal-ip": "Remova do DNS público os registros que apontam para IPs internos.",
  /* exposição */
  "exposed-files": "Bloqueie o acesso público a arquivos sensíveis (.env, .git, backups) e troque credenciais expostas.",
  "open-ports": "Feche no firewall as portas que não precisam estar expostas à internet.",
};

export const remediationFor = (id: string) => REMEDIATION[id] ?? REMEDIATION[id.split(":")[0]] ?? null;
