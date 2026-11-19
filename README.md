# AEGIS: scanner de segurança de domínios

O AEGIS avalia a postura de segurança de um domínio: TLS, headers HTTP, cookies, DNS, e-mail, vulnerabilidades conhecidas
(CVE) das tecnologias detectadas, reputação e superfície de ataque. Ele dá uma nota de 0 a 100 e diz o que corrigir.

Não tem conta nem banco de dados. O histórico de scans fica no navegador (localStorage) e pode ser exportado e importado em JSON.

## Funcionalidades

| Tela | O que faz |
| --- | --- |
| **Visão geral** (`/`) | Scan de um domínio: nota, verificações, certificado, DNS/e-mail, CVEs, subdomínios, reputação, mapa dos servidores e testes ativos |
| **Ameaças** (`/threat-feed`) | Catálogo CISA KEV (vulnerabilidades exploradas ativamente) cruzado com as CVEs dos seus domínios |
| **Análises** (`/analytics`) | Evolução da nota, o que mudou entre dois scans, falhas mais comuns, prazos de certificado |
| **Ativos** (`/assets`) | Lista de domínios monitorados, com tendência, reescaneamento individual ou em lote |
| **Relatório** (`/report?d=dominio`) | Relatório imprimível (salvar como PDF) com recomendações por prioridade |
| **Configurações** (`/settings`) | Preferências, exportar, importar ou apagar o histórico |

### O que é verificado

- **TLS:** validade e cadeia do certificado, versões aceitas (TLS 1.0 a 1.3), cifras fracas, tamanho da chave, algoritmo de assinatura, OCSP stapling.
- **Transporte e headers:** redirecionamento HTTP → HTTPS, HSTS, CSP (avalia o controle de scripts), proteção contra clickjacking,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, exposição de versão do servidor, `security.txt`.
- **Cookies:** `Secure`, `HttpOnly`, `SameSite`.
- **DNS e e-mail:** SPF (incluindo o limite de 10 consultas), DMARC (inclusive herdado do domínio pai), DKIM nos seletores comuns,
  MTA-STS, TLS-RPT, CAA, DNSSEC.
- **Vulnerabilidades:** tecnologias identificadas por headers e HTML, cruzadas com OSV (bibliotecas JS), NVD (software de servidor)
  e CISA KEV.
- **Reputação:** Spamhaus DBL/ZEN, SURBL e, opcionalmente, Google Safe Browsing e URLhaus.
- **Superfície de ataque:** subdomínios via Certificate Transparency (crt.sh, Cert Spotter) e HackerTarget, com detecção de
  subdomain takeover, IPs internos no DNS público e subdomínios sensíveis (admin, staging, dev…).
- **Testes ativos (só com prova de propriedade):** arquivos sensíveis expostos (`.env`, `.git`, backups, phpinfo, painéis…) e portas
  de serviços internos (bancos de dados, RDP, Redis, Docker…).

### Nota

A nota é uma média ponderada das verificações: `pass` vale o peso cheio e `warn` vale metade.
Achados graves **limitam** a nota, independentemente do resto. Exemplos: arquivo sensível exposto (máximo 20),
CVE explorada ativamente (40), subdomain takeover (30), domínio em lista de bloqueio (30).
Faixas: A ≥ 90, B ≥ 80, C ≥ 65, D ≥ 50, F < 50.

## Passivo por padrão, ativo só com autorização

Os scans comuns usam apenas informação pública, a mesma que um navegador ou uma consulta DNS obtém.

Varrer portas ou procurar arquivos em sites de terceiros sem autorização é crime (Lei 12.737/2012). Por isso, os **testes ativos**
só rodam depois que o dono prova a posse do domínio, de um destes jeitos:

- registro **TXT** em `_aegis-verify.<domínio>` com o valor `aegis-verify=<token>` (verificar o domínio raiz também libera os subdomínios); ou
- arquivo em `https://<domínio>/.well-known/aegis-verify.txt` com o token.

O token é um HMAC do domínio com `AEGIS_SECRET`, então a verificação funciona sem banco de dados.

Quando o domínio aponta para uma **CDN ou hospedagem compartilhada** (Cloudflare, Vercel, CloudFront, Akamai, Fastly, Netlify,
GitHub Pages, Azure Front Door), a varredura de portas é pulada: aquele IP atende outros clientes e não pertence ao dono do domínio.
Os arquivos sensíveis continuam sendo testados.

## Rodando localmente

Requer Node.js 22 ou superior.

```bash
npm install
# crie o .env.local com as variáveis abaixo (ao menos AEGIS_SECRET para os testes ativos)
npm run dev
```

Abra http://localhost:3000. Sem histórico, a Visão geral faz um auto-diagnóstico: no domínio onde o AEGIS está publicado ou,
em localhost, no alvo definido em Configurações (padrão `github.com`).

Outros comandos:

```bash
npm run build   # build de produção
npm run start   # servidor de produção
npm run lint    # ESLint
npx tsc --noEmit
```

### Variáveis de ambiente

| Variável | Obrigatória | Para que serve |
| --- | --- | --- |
| `AEGIS_SECRET` | Para testes ativos | Segredo (mínimo 16 caracteres) usado para gerar os tokens de verificação de propriedade. Sem ele, `/api/verify` responde 503 |
| `NVD_API_KEY` | Não | Chave do NVD: sobe o limite de ~5 para ~50 consultas a cada 30 s ([pedir aqui](https://nvd.nist.gov/developers/request-an-api-key)) |
| `GOOGLE_SAFE_BROWSING_KEY` | Não | Ativa a consulta ao Google Safe Browsing |
| `URLHAUS_AUTH_KEY` | Não | Ativa a consulta ao URLhaus (abuse.ch) |
| `NEXT_PUBLIC_AEGIS_DEFAULT_TARGET` | Não | Alvo padrão do auto-diagnóstico em localhost (padrão `github.com`) |

A versão exibida na barra lateral vem do campo `version` do `package.json`.

## Arquitetura

Next.js 16 (App Router), React 19, Tailwind CSS 4, TypeScript. Não há dependências além de `lucide-react` (ícones): o globo é
canvas 2D e os gráficos são SVG.

```
src/
├── app/
│   ├── page.tsx                 Visão geral
│   ├── (sections)/              Ameaças, Análises, Ativos, Configurações (com barra lateral)
│   ├── report/                  Relatório imprimível
│   └── api/
│       ├── scan/route.ts        POST { domain } → scan passivo completo
│       ├── scan/surface/        POST { domain } → subdomínios e takeover
│       ├── scan/active/         POST { domain } → testes ativos (exige propriedade verificada)
│       ├── verify/              POST { domain } → instruções e estado da verificação
│       └── threats/             GET → catálogo CISA KEV (?ids=CVE-… para cruzar)
├── components/                  Telas e painéis
├── lib/
│   ├── scanner/                 Lógica do scan (roda só no servidor)
│   ├── storage/                 Histórico e preferências no localStorage
│   ├── scoring.ts               Cálculo da nota
│   ├── analytics.ts             Séries, comparações e prazos
│   └── remediation.ts           "Como corrigir" de cada verificação
└── proxy.ts                     CSP com nonce por requisição
```

### Segurança do próprio AEGIS

- **SSRF:** todo domínio é resolvido e recusado se apontar para IP privado ou reservado. As conexões HTTP usam um `lookup` que
  revalida o IP **na hora de conectar** (contra DNS rebinding), inclusive em cada redirect.
- **Prazos:** cada scan tem orçamento total de 45 s (a rota tem `maxDuration` de 60 s). A cadeia de redirects tem teto de 20 s e as
  respostas das fontes externas têm tamanho máximo.
- **HTML hostil:** a detecção de tecnologias usa busca linear, sem regex com retrocesso quadrático (ReDoS).
- **Headers:** CSP com nonce e `strict-dynamic`, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP.
- **Abuso da API:** limite de requisições por IP no Vercel Firewall (ver abaixo).

## Deploy na Vercel

O projeto roda na região `gru1` (São Paulo), definida em `vercel.json`. Configure as variáveis de ambiente no painel ou com
`vercel env add`.

### Limite de requisições

A API é pública e cada scan dispara dezenas de consultas DNS e requisições externas (com cotas gratuitas compartilhadas).
Há uma regra no Vercel Firewall, **"AEGIS - limite da API"**: 30 requisições por minuto por IP em `POST /api/scan*` e `POST /api/verify`.
O plano Hobby permite uma única regra de rate limit, por isso as rotas estão agrupadas nela.

```bash
vercel firewall rules inspect "AEGIS - limite da API"
vercel firewall diff        # mudanças pendentes
vercel firewall publish --yes
```

A regra começou em modo `log` (só registra). Depois de conferir o tráfego no painel, mude a ação para bloquear:

```bash
vercel firewall rules edit "AEGIS - limite da API" --rate-limit-action rate_limit --yes
vercel firewall publish --yes
```

## Limitações conhecidas

- **Versões do banner:** distribuições Linux corrigem falhas sem mudar o número da versão (backport). CVEs de software de servidor
  podem ser falsos positivos; confirme no servidor.
- **Spamhaus:** recusa consultas vindas de resolvedores DNS públicos. Na Vercel, essas listas costumam aparecer como "Indisponível".
- **Geolocalização:** é aproximada. IPs de CDN/anycast mostram a sede do provedor, não o datacenter que respondeu.
- **Histórico:** fica limitado ao navegador: até 10 scans por domínio e 200 no total. Só o último scan de cada domínio guarda CVEs,
  subdomínios e mapa completos; os anteriores mantêm nota e verificações.
- **Testes automatizados:** ainda não há.
