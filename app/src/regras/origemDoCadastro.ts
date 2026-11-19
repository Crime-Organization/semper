// De qual cartão o cadastro foi aberto (#376). O "+ Novo …" de uma seção do cartão abre o cadastro com o item de origem no
// endereço (?cliente=, ?demanda=…) e a marca da volta (&volta=cartao). Depois de gravar o item novo, a tela volta a esse cartão,
// onde ele já aparece ligado. Sem a marca (por exemplo, o "Criar o processo?" de quando a demanda é concluída), o cadastro segue
// para o cartão do item novo, como sempre.

/** Cada parâmetro de origem e o começo do endereço do cartão que ele abre. Origem nova = uma entrada nova aqui. */
export const CARTAO_DA_ORIGEM = {
  /** "Novo contrato (ou processo) com esta pessoa como cliente", no cartão da pessoa. */
  cliente: '/pessoas/?id=',
  /** "Novo processo", no cartão da demanda. */
  demanda: '/demandas/?id='
} as const satisfies Record<string, string>;
export type OrigemDoCadastro = keyof typeof CARTAO_DA_ORIGEM;

/** O parâmetro e o valor que só o "+ Novo …" das seções põe no endereço: pedem a volta ao cartão de origem. */
export const MARCA_DA_VOLTA = { nome: 'volta', valor: 'cartao' } as const;

/** O endereço do cadastro aberto pelo "+ Novo …" de uma seção: com a origem e a marca da volta. */
export function cadastroComVolta(cadastro: string, origem: OrigemDoCadastro, id: string): string {
  const busca = new URLSearchParams({ [origem]: id, [MARCA_DA_VOLTA.nome]: MARCA_DA_VOLTA.valor });
  return cadastro + '?' + busca.toString();
}

/**
 * As origens que este cadastro aceita, na ordem em que valem, cada uma com a conferência de que o item gravado ficou mesmo
 * ligado a ela (o cliente continua entre os gravados, a ligação com a demanda deu certo). Um id que não existe, um cliente
 * trocado ou uma ligação que falhou não contam: voltar ali mostraria um cartão sem o item novo.
 */
export type OrigensAceitas = Partial<Record<OrigemDoCadastro, (id: string) => boolean>>;

/**
 * O cartão para onde o cadastro volta depois de gravar: o da primeira origem aceita (na ordem dada) que veio no endereço e
 * ficou ligada ao item. Sem a marca da volta, ou sem nenhuma origem assim, null: o cadastro segue para o cartão do item novo.
 */
export function cartaoDeOrigem(params: { get: (nome: string) => string | null }, aceitas: OrigensAceitas): string | null {
  if (params.get(MARCA_DA_VOLTA.nome) !== MARCA_DA_VOLTA.valor) return null;
  const ligadas = (Object.entries(aceitas) as [OrigemDoCadastro, (id: string) => boolean][])
    .map(([origem, ficouLigada]) => ({ origem, id: params.get(origem), ficouLigada }));
  const achada = ligadas.find(o => o.id && o.ficouLigada(o.id));
  return achada ? CARTAO_DA_ORIGEM[achada.origem] + encodeURIComponent(achada.id!) : null;
}
