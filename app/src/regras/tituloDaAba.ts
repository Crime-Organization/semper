// O título da aba do navegador (#323): a página, o escritório de quem está logado e o produto, como "Pessoas · Marques &
// Lima Advogados · SEMPER". Fora do sistema (a entrada) ou sem nome do escritório, só a página e o produto. O nome do
// escritório vem das Configurações dele: o SEMPER não tem nome de escritório fixo.

/** Separa as partes do título da aba. */
const SEPARADOR = ' · ';

export function tituloDaAba(pagina: string, escritorio: string | null | undefined, produto: string): string {
  const nome = escritorio?.trim() ?? '';
  // O escritório sem nome próprio (ou com o nome do produto) não repete o produto no título.
  const doEscritorio = nome && nome !== produto ? [nome] : [];
  return [pagina, ...doEscritorio, produto].join(SEPARADOR);
}
