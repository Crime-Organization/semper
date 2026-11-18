// Versão do SEMPER: a da aba aberta (embutida no código ao compilar) e a que está no ar (o /versao.txt que a rotina
// "Publicar o SEMPER" grava, ex.: "v1.9.0 ecee79f"). Quando são diferentes, a aba está rodando o código antigo.

/** O formato das versões publicadas (o mesmo que a rotina de publicação exige): v1.2.3. */
const FORMATO = /^v\d+\.\d+\.\d+$/;

export const versaoValida = (versao: string | null | undefined): versao is string => !!versao && FORMATO.test(versao);

/** A versão escrita no versao.txt ("v1.9.0 ecee79f" → "v1.9.0"). Qualquer outra coisa (página de erro, vazio) → null. */
export function versaoDoArquivo(texto: string): string | null {
  const primeira = texto.trim().split(/\s+/)[0];
  return versaoValida(primeira) ? primeira : null;
}

/**
 * Se a versão no ar é outra que a da aba. Vale também para trás (voltar a uma versão anterior), porque nos dois
 * casos a aba precisa recarregar. Sem versão na aba (npm run dev, banco fictício) ou sem resposta do servidor: false.
 */
export const haVersaoNova = (daAba: string, noAr: string | null) => versaoValida(daAba) && versaoValida(noAr) && noAr !== daAba;

/** Quantas partes tem o número da versão (maior.menor.correção). */
const PARTES_DA_VERSAO = 3;
/**
 * A ordem de duas versões válidas, pelo número e não pelo texto (v1.10.0 vem depois de v1.9.3): negativo se "a" é mais
 * antiga, positivo se é mais nova, zero se são a mesma. Serve para ordenar com sort().
 */
export function compararVersoes(a: string, b: string) {
  const partes = (v: string) => v.slice(1).split('.').map(Number);
  const pa = partes(a), pb = partes(b);
  const diferente = Array.from({ length: PARTES_DA_VERSAO }, (_, i) => pa[i] - pb[i]).find(d => d !== 0);
  return diferente ?? 0;
}
