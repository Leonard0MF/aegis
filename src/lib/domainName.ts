/* Sem dependências do Node: usado também no navegador. */

const HOSTNAME_RE =
  /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*\.[a-z]{2,63}$/;

/**
 * Normaliza entrada do usuário ("https://Exemplo.com:443/path?x" -> "exemplo.com").
 * Retorna null se não for um hostname público válido.
 */
export function normalizeDomain(input: unknown): string | null {
  if (typeof input !== "string") return null;

  let value = input.trim().toLowerCase();
  if (!value) return null;

  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, ""); // protocolo
  value = value.split(/[/?#]/)[0];                        // caminho / query
  value = value.replace(/^.*@/, "");                      // credenciais
  value = value.replace(/:\d+$/, "");                     // porta
  value = value.replace(/\.$/, "");                       // ponto final

  return HOSTNAME_RE.test(value) ? value : null;
}
