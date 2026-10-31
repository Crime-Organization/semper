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
