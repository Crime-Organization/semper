// O cadastro de pessoa aberto a partir de um cartão (#376): o "+ Nova pessoa" das seções Clientes e Pessoas (demanda, processo,
// tarefa, compromisso), o da anotação e o "+ Nova pessoa vinculada" dos Vínculos de outra pessoa. O endereço do cadastro diz de onde
// ele veio (?demanda=<id>, ?processo=<id>…, ou ?vinculo_com=<id>&tipo=<tipo do vínculo>); ao terminar, a pessoa fica ligada ao item
// de origem e a tela volta ao cartão dele. Aqui ficam o endereço, a leitura dele e os textos de cada origem; a tela só os chama.
import type { ModuloComentado, TipoProcesso } from '../dados/tipos';
import type { ItemComPessoas } from './ligarExistente';
import { CARTAO_DO_MODULO } from './mensagens';

/** De onde o cadastro de pessoa pode ser aberto já ligado a algo. Origem nova = uma entrada nova em ORIGEM_DA_PESSOA. */
export type OrigemDaPessoa = ItemComPessoas | 'anotacoes' | 'vinculos';

interface DadosDaOrigem {
  /** O parâmetro do endereço do cadastro que traz o id do item de origem. */
  parametro: string;
  /** O módulo do cartão para onde a tela volta (nos vínculos, o da pessoa de origem). */
  cartao: ModuloComentado;
  /** O botão embaixo da lista da seção. */
  novo: string;
  /** O nome do "+" do título da seção (na dica e para o leitor de tela). */
  novoNoTitulo: string;
  /** Como a pessoa fica no item de origem, para os avisos ("ligada como cliente da demanda …"). */
  ligada: (item: string) => string;
}

export const ORIGEM_DA_PESSOA: Record<OrigemDaPessoa, DadosDaOrigem> = {
  demandas: { parametro: 'demanda', cartao: 'demandas', novo: 'Nova pessoa', novoNoTitulo: 'Nova pessoa como cliente desta demanda',
    ligada: d => `ligada como cliente da demanda ${d}` },
  processos: { parametro: 'processo', cartao: 'processos', novo: 'Nova pessoa', novoNoTitulo: 'Nova pessoa como cliente deste processo',
    ligada: p => `ligada como cliente do processo ${p}` },
  tarefas: { parametro: 'tarefa', cartao: 'tarefas', novo: 'Nova pessoa', novoNoTitulo: 'Nova pessoa ligada a esta tarefa',
    ligada: t => `ligada à tarefa ${t}` },
  compromissos: { parametro: 'compromisso', cartao: 'compromissos', novo: 'Nova pessoa', novoNoTitulo: 'Nova pessoa ligada a este compromisso',
    ligada: c => `ligada ao compromisso ${c}` },
  anotacoes: { parametro: 'anotacao', cartao: 'anotacoes', novo: 'Nova pessoa', novoNoTitulo: 'Nova pessoa ligada a esta anotação',
    ligada: a => `ligada à anotação ${a}` },
  vinculos: { parametro: 'vinculo_com', cartao: 'pessoas', novo: 'Nova pessoa vinculada', novoNoTitulo: 'Nova pessoa vinculada a esta pessoa',
    ligada: v => `vinculada: ${v}` }
};

/** No vínculo: o parâmetro com a escolha do formulário de vínculos (o tipo e o sentido, como "tv3:de"; veja opcoesDeVinculo). */
export const PARAMETRO_DO_TIPO_DO_VINCULO = 'tipo';

/** A origem lida do endereço. */
export interface Origem {
  modulo: OrigemDaPessoa;
  /** O item de origem (nos vínculos, a pessoa com quem a nova fica vinculada). */
  id: string;
  /** Só nos vínculos: a escolha do tipo, feita no cartão da pessoa de origem. */
  tipoDoVinculo?: string;
  /** Só nos vínculos: a descrição ou a função, que não vai no endereço (vem junto com a navegação, veja NovaPessoa). */
  descricao?: string;
}

const ORIGENS = Object.keys(ORIGEM_DA_PESSOA) as OrigemDaPessoa[];

/** A origem que o endereço do cadastro traz, ou null (cadastro comum). O vínculo sem o tipo não vale: não há como gravá-lo. */
export function lerOrigem(params: URLSearchParams, descricao?: string): Origem | null {
  const modulo = ORIGENS.find(m => params.get(ORIGEM_DA_PESSOA[m].parametro));
  if (!modulo) return null;
  const id = params.get(ORIGEM_DA_PESSOA[modulo].parametro)!;
  if (modulo !== 'vinculos') return { modulo, id };
  const tipoDoVinculo = params.get(PARAMETRO_DO_TIPO_DO_VINCULO);
  return tipoDoVinculo ? { modulo, id, tipoDoVinculo, descricao: descricao?.trim() || undefined } : null;
}

/** O endereço do cadastro de pessoa aberto a partir do item (o "+ Nova pessoa" da seção). */
export function cadastroDePessoaDe(modulo: Exclude<OrigemDaPessoa, 'vinculos'>, id: string) {
  return `/pessoas/nova/?${new URLSearchParams({ [ORIGEM_DA_PESSOA[modulo].parametro]: id })}`;
}
/** O endereço do cadastro de pessoa que nasce vinculada à pessoa `pessoaId`, com a escolha do tipo (`chave` de opcoesDeVinculo). */
export function cadastroDePessoaVinculada(pessoaId: string, chave: string) {
  return `/pessoas/nova/?${new URLSearchParams({ [ORIGEM_DA_PESSOA.vinculos.parametro]: pessoaId, [PARAMETRO_DO_TIPO_DO_VINCULO]: chave })}`;
}

/** O endereço do cartão de origem, para onde a tela volta ao terminar. O processo precisa do tipo (a página dele depende disso). */
export function cartaoDeOrigem(o: Pick<Origem, 'modulo' | 'id'>, tipoDoProcesso: TipoProcesso | null = null) {
  return `${CARTAO_DO_MODULO[ORIGEM_DA_PESSOA[o.modulo].cartao].pagina(tipoDoProcesso)}?${new URLSearchParams({ id: o.id })}`;
}

// ---------- os textos ----------
/** A faixa no alto do cadastro: o que acontece ao terminar. */
export const faixaDaOrigem = (m: OrigemDaPessoa, item: string) => `Ao terminar, a pessoa fica ${ORIGEM_DA_PESSOA[m].ligada(item)}, e você volta ao cartão de origem.`;
/** O aviso do cadastro feito e ligado. */
export const cadastradaNaOrigem = (m: OrigemDaPessoa, item: string) => `Pessoa cadastrada e ${ORIGEM_DA_PESSOA[m].ligada(item)}.`;
/** O aviso quando a pessoa já existia (mesmo CPF/CNPJ) e foi ligada como está. */
export const existenteNaOrigem = (m: OrigemDaPessoa, item: string) => `Pessoa já cadastrada, agora ${ORIGEM_DA_PESSOA[m].ligada(item)}.`;
/** O aviso quando a pessoa que já existia já estava no item. */
export const jaEstavaNaOrigem = (m: OrigemDaPessoa, item: string) => `A pessoa já estava ${ORIGEM_DA_PESSOA[m].ligada(item)}.`;
/** O aviso quando a pessoa foi gravada, mas a ligação falhou (ela continua cadastrada). */
export const naoLigouNaOrigem = (m: OrigemDaPessoa, item: string, motivo?: string) =>
  `A pessoa foi cadastrada, mas não ficou ${ORIGEM_DA_PESSOA[m].ligada(item)}.${motivo ? ' ' + motivo : ''}`;
/** Por que o cadastro aberto por um cartão segue sem ligar: o item não foi achado (excluído, ou sem acesso), ou está arquivado (nada
 * nasce ligado a um item arquivado; o endereço pode ter sido digitado, ou vir de uma aba aberta antes de alguém arquivar o item). */
export type SemOrigem = 'sumiu' | 'arquivada';
/** A faixa no alto do cadastro quando ele segue sem ligar. */
export const AVISO_SEM_ORIGEM: Record<SemOrigem, string> = {
  sumiu: 'O item de onde este cadastro foi aberto não foi encontrado: a pessoa será cadastrada sem ligação.',
  arquivada: 'O item de onde este cadastro foi aberto está arquivado: a pessoa será cadastrada sem ligação.'
};

// ---------- a janela "Cadastro já existente" (o CPF/CNPJ digitado já é de outra pessoa) ----------
/** Os casos da janela: o cadastro comum; o aberto por um cartão, com a pessoa achada ativa; e com ela arquivada. */
export type CasoDoExistente = 'semOrigem' | 'comOrigem' | 'comOrigemArquivada';
/** O que se escolhe na janela (null: Cancelar). */
export type EscolhaDoExistente = 'ver' | 'atualizar' | 'ligar';
interface AcaoDoExistente { rotulo: string; valor: EscolhaDoExistente | null; tipo?: 'pri' }

/** O caso da janela. Sem item de origem (o cadastro comum, ou a origem não achada ou arquivada), vale o do cadastro comum. */
export function casoDoExistente(comOrigem: boolean, arquivada: boolean): CasoDoExistente {
  if (!comOrigem) return 'semOrigem';
  return arquivada ? 'comOrigemArquivada' : 'comOrigem';
}

/** Os botões de cada caso. Aberto por um cartão, os rótulos são curtos, para os três caberem numa linha. A pessoa arquivada não entra
 * num item como está (o "Ligar … existente" só oferece as ativas): atualizar o cadastro a devolve às ativas e, ao salvar, a liga. */
export const ACOES_DO_EXISTENTE: Record<CasoDoExistente, AcaoDoExistente[]> = {
  semOrigem: [{ rotulo: 'Ver cadastro existente', valor: 'ver' }, { rotulo: 'Cancelar', valor: null }, { rotulo: 'Atualizar este cadastro', valor: 'atualizar', tipo: 'pri' }],
  comOrigem: [{ rotulo: 'Cancelar', valor: null }, { rotulo: 'Atualizar', valor: 'atualizar' }, { rotulo: 'Ligar esta pessoa', valor: 'ligar', tipo: 'pri' }],
  comOrigemArquivada: [{ rotulo: 'Cancelar', valor: null }, { rotulo: 'Atualizar e ligar', valor: 'atualizar', tipo: 'pri' }]
};

const MANTIDO = 'O que ela já tem e você não preencher aqui é mantido, e os dados anteriores ficam no histórico.';
/** Os parágrafos de cada caso, depois do que diz quem é a pessoa achada. `ligada` diz onde ela entra ("ligada como cliente da demanda
 * …"; vazio no cadastro comum); `arquivada`, se o cadastro achado está arquivado. */
export const TEXTO_DO_EXISTENTE: Record<CasoDoExistente, (ligada: string, arquivada: boolean) => string[]> = {
  semOrigem: (_, arquivada) => [`Deseja atualizar as informações dessa pessoa com os dados desta tela? ${MANTIDO}${arquivada ? ' O cadastro volta para as ativas.' : ''}`],
  comOrigem: ligada => [`Você pode ligar essa pessoa como ela está: ela fica ${ligada}.`,
    `Ou atualizar as informações dela com os dados desta tela; ao salvar, ela também fica ligada. ${MANTIDO}`],
  comOrigemArquivada: ligada => [`Arquivada, ela não entra como está. Atualize o cadastro com os dados desta tela: ele volta para as ativas e, ao salvar, a pessoa fica ${ligada}. ${MANTIDO}`]
};
/** No vínculo: a pessoa achada pelo CPF/CNPJ é a própria pessoa de origem. */
export const VINCULO_COM_ELA_MESMA = 'Esta é a própria pessoa de onde o cadastro foi aberto: uma pessoa não se vincula a ela mesma.';
