// As buscas de cada módulo para ligar, no cartão de um item, outro que já existe (#341, etapa 2): a peça LigarExistente com a busca
// na camada de dados, o jeito de mostrar cada achado e os textos de cada módulo, para todas as seções falarem igual. Quem usa diz o
// filtro (o que a seção não oferece: os já ligados, os que já têm outro), por que um achado não pode ser escolhido e o que fazer ao
// escolher. A camada de dados só devolve itens ativos que a pessoa pode alterar.
import { SD, type CompromissoParaEscolher, type ContratoParaEscolher, type DemandaParaEscolher, type FiltroParaLigar, type LigacaoDeUmSo, type PessoaLista,
  type ProcessoParaEscolher, type TarefaParaEscolher } from '../dados';
import { ITENS_PARA_LIGAR } from '../dados/limites';
import { nomeDoCompromisso, TIPOS_COMPROMISSO } from '../regras/compromisso';
import { clientesPorExtenso } from '../regras/contrato';
import { fmtData, fmtDocumento, TIPOS } from '../regras/pessoa';
import { detalheDoProcesso, nomeDoProcesso } from '../regras/processo';
import { LigarExistente, type AchadoParaLigar } from './LigarExistente';

/** O filtro de cada busca, sem o texto (que é o que a pessoa digita). As pessoas só saem pelos já ligados. */
type Sem<S extends LigacaoDeUmSo = never> = Omit<FiltroParaLigar<S>, 'termo'>;
interface Filtros {
  demandas: Sem<'contratos'>;
  tarefas: Sem<LigacaoDeUmSo> & { doProcesso?: string };
  compromissos: Sem<'processos'>;
  processos: Sem;
  contratos: Sem;
  pessoas: Pick<Sem, 'fora'>;
}
interface Achados {
  demandas: DemandaParaEscolher;
  tarefas: TarefaParaEscolher;
  compromissos: CompromissoParaEscolher;
  processos: ProcessoParaEscolher;
  contratos: ContratoParaEscolher;
  pessoas: PessoaLista;
}
export type ModuloParaLigar = keyof Achados;
/** O achado de cada módulo. */
export type AchadoDe<M extends ModuloParaLigar> = Achados[M];
/** O filtro de cada módulo (sem o texto). */
export type FiltroDe<M extends ModuloParaLigar> = Filtros[M];

interface Modulo<M extends ModuloParaLigar> {
  buscar: (termo: string, f: Filtros[M]) => Promise<Achados[M][]>;
  mostrar: (x: Achados[M]) => Omit<AchadoParaLigar, 'motivo'>;
  /** O texto do botão, o nome e a dica do campo, o nome da lista e o que ela diz quando não acha nada. */
  rotulo: string; rotuloDaBusca: string; dicaDaBusca: string; nomeDaLista: string; semAchados: { comTexto: string; semTexto: string };
}
const junto = (...partes: (string | null | undefined | false)[]) => partes.filter(Boolean).join(' · ');
/** As pessoas vêm da busca do cadastro (só as ativas); as já ligadas ao cartão saem, e sobram até ITENS_PARA_LIGAR. */
async function pessoasParaLigar(termo: string, fora: readonly string[] = []) {
  const { linhas } = await SD.pessoasListar({ termo, porPagina: ITENS_PARA_LIGAR + fora.length });
  return linhas.filter(p => !fora.includes(p.id)).slice(0, ITENS_PARA_LIGAR);
}

const MODULOS: { [M in ModuloParaLigar]: Modulo<M> } = {
  demandas: {
    buscar: (termo, f) => SD.demandasParaLigar({ ...f, termo }),
    mostrar: d => ({ id: d.id, titulo: d.titulo, detalhe: junto(d.codigo, d.cliente_nome && clientesPorExtenso(d.cliente_nome), d.contrato_codigo && `Contrato ${d.contrato_codigo}`) }),
    rotulo: 'Ligar demanda existente', rotuloDaBusca: 'Buscar demanda para ligar', dicaDaBusca: 'Título, código ou cliente da demanda', nomeDaLista: 'Demandas para ligar',
    semAchados: { comTexto: 'Nenhuma demanda ativa com esse texto que você possa ligar.', semTexto: 'Nenhuma demanda ativa que você possa ligar.' }
  },
  tarefas: {
    buscar: (termo, f) => SD.tarefasParaLigar({ ...f, termo }),
    mostrar: t => ({ id: t.id, titulo: t.titulo, detalhe: junto(t.codigo, t.demanda_codigo && `Demanda ${t.demanda_codigo}`, t.pessoa_nome && clientesPorExtenso(t.pessoa_nome), t.prazo && `Prazo ${fmtData(t.prazo)}`) }),
    rotulo: 'Ligar tarefa existente', rotuloDaBusca: 'Buscar tarefa para ligar', dicaDaBusca: 'Título, código ou pessoa da tarefa', nomeDaLista: 'Tarefas para ligar',
    semAchados: { comTexto: 'Nenhuma tarefa ativa com esse texto que você possa ligar.', semTexto: 'Nenhuma tarefa ativa que você possa ligar.' }
  },
  compromissos: {
    buscar: (termo, f) => SD.compromissosParaLigar({ ...f, termo }),
    mostrar: c => ({ id: c.id, titulo: nomeDoCompromisso(c), detalhe: junto(TIPOS_COMPROMISSO[c.tipo].nome, c.codigo, fmtData(c.data)) }),
    rotulo: 'Ligar compromisso existente', rotuloDaBusca: 'Buscar compromisso para ligar', dicaDaBusca: 'Título, código ou pessoa do compromisso', nomeDaLista: 'Compromissos para ligar',
    semAchados: { comTexto: 'Nenhum compromisso ativo com esse texto que você possa ligar.', semTexto: 'Nenhum compromisso ativo que você possa ligar.' }
  },
  processos: {
    buscar: (termo, f) => SD.processosParaPorCliente({ ...f, termo }),
    mostrar: p => ({ id: p.id, titulo: nomeDoProcesso(p), detalhe: detalheDoProcesso(p) }),
    rotulo: 'Ligar processo existente', rotuloDaBusca: 'Buscar processo para ligar', dicaDaBusca: 'Número, nome ou cliente do processo', nomeDaLista: 'Processos para ligar',
    semAchados: { comTexto: 'Nenhum processo ativo com esse texto que você possa ligar.', semTexto: 'Nenhum processo ativo que você possa ligar.' }
  },
  contratos: {
    buscar: (termo, f) => SD.contratosParaLigar({ ...f, termo }),
    mostrar: k => ({ id: k.id, titulo: k.servico, detalhe: junto(k.codigo, k.cliente_nome && clientesPorExtenso(k.cliente_nome)) }),
    rotulo: 'Ligar contrato existente', rotuloDaBusca: 'Buscar contrato para ligar', dicaDaBusca: 'Número, cliente ou objeto do contrato', nomeDaLista: 'Contratos para ligar',
    semAchados: { comTexto: 'Nenhum contrato ativo com esse texto que você possa ligar.', semTexto: 'Nenhum contrato ativo que você possa ligar.' }
  },
  pessoas: {
    buscar: (termo, f) => pessoasParaLigar(termo, f.fora),
    mostrar: p => ({ id: p.id, titulo: p.nome, detalhe: junto(TIPOS[p.tipo], p.documento && fmtDocumento(p.documento), p.codigo) }),
    rotulo: 'Ligar pessoa existente', rotuloDaBusca: 'Buscar pessoa para ligar', dicaDaBusca: 'Nome, CPF/CNPJ ou telefone da pessoa', nomeDaLista: 'Pessoas para ligar',
    semAchados: { comTexto: 'Nenhuma pessoa ativa com esse texto que ainda não esteja aqui.', semTexto: 'Nenhuma pessoa ativa que ainda não esteja aqui.' }
  }
};

interface Props<M extends ModuloParaLigar> {
  modulo: M;
  /** O que a seção não oferece. Uma função, quando é preciso ler na hora (ex.: as demandas já ligadas ao processo). */
  filtro?: Filtros[M] | (() => Promise<Filtros[M]>);
  aoEscolher: (x: Achados[M]) => unknown;
  /** Por que o achado não pode ser escolhido ('' = pode): aparece no lugar do detalhe, com o achado desabilitado. */
  motivo?: (x: Achados[M]) => string;
  /** Outro texto para o botão (ex.: "Ligar cliente existente"). */
  rotulo?: string;
  /** Embaixo do campo, enquanto a busca está aberta (ex.: quem passa a ver o que for ligado). */
  aviso?: string;
  /** Por que agora não se pode ligar (ex.: a lista do cartão já está cheia). */
  indisponivel?: string;
  /** A busca já aberta, dentro de uma janela (veja LigarExistente). */
  naJanela?: boolean;
}

/** O botão "Ligar … existente" de uma seção de cartão, com a busca do módulo. */
export function LigarDoModulo<M extends ModuloParaLigar>({ modulo, filtro, aoEscolher, motivo, rotulo, aviso, indisponivel, naJanela }: Props<M>) {
  const m = MODULOS[modulo] as Modulo<M>;
  const lerFiltro = async () => (typeof filtro === 'function' ? await filtro() : filtro ?? {}) as Filtros[M];
  return <LigarExistente<Achados[M]> rotulo={rotulo ?? m.rotulo} rotuloDaBusca={m.rotuloDaBusca} dicaDaBusca={m.dicaDaBusca} nomeDaLista={m.nomeDaLista} semAchados={m.semAchados}
    buscar={async termo => m.buscar(termo, await lerFiltro())} mostrar={x => ({ ...m.mostrar(x), motivo: motivo?.(x) || undefined })}
    aoEscolher={aoEscolher} aviso={aviso} indisponivel={indisponivel} naJanela={naJanela} />;
}
