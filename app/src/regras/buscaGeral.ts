// Regras da busca geral (#321): a janela que busca em todos os módulos de uma vez (Ctrl+K ou o botão "Buscar" do menu).
// Tudo puro, sem tela nem banco: como ler o que a pessoa digitou (um número com pontuação vira só os algarismos), o que cada
// módulo mostra de cada achado, a ordem dos achados e dos grupos, os filtros por módulo e por data e os endereços que se abrem.
// A busca em si é a de cada módulo (a mesma da busca da página dele, com as mesmas regras de quem vê o quê): ui/fontesDaBuscaGeral.ts.
import { BUSCA_GERAL_MINIMO, BUSCA_GERAL_POR_MODULO } from '../dados/limites';
import type { AnotacaoLista, CompromissoLista, ContratoLista, DemandaLista, GrupoDoPedido, ItemParaPedir, ModuloDoPedido, PessoaLista, ProcessoLista, TarefaLista } from '../dados/tipos';
import { DIA } from '../ui/tempos';
import { fmtHora, nomeDoCompromisso, TIPOS_COMPROMISSO } from './compromisso';
import { clientesPorExtenso } from './contrato';
import { DIGITOS_DO_CNJ, fmtCNJ } from './numeroCNJ';
import { cnpjComLetrasNaBusca, cnpjValido, cpfValido, dig, fmtData, fmtDocumento, limparDocumento, TIPOS as TIPOS_PESSOA } from './pessoa';
import { numeroParaComparar, TIPOS_PROCESSO } from './processo';
import { normal, semAcento } from './texto';

// ---------- módulos e grupos ----------
/** Os módulos em que a busca procura: são os botões do filtro "Módulo". */
export type ModuloDaBusca = 'pessoas' | 'processos' | 'contratos' | 'demandas' | 'tarefas' | 'compromissos' | 'anotacoes';
/** O filtro de módulo: um deles, ou todos. */
export type FiltroDeModulo = ModuloDaBusca | 'todos';
/**
 * Os grupos de resultados. Os processos aparecem num grupo por tipo, como no menu (judicial e administrativo): cada tipo tem a sua página, e
 * o "Ver todos" de cada grupo leva à página certa.
 */
export type GrupoDaBusca = 'pessoas' | 'judiciais' | 'administrativos' | 'contratos' | 'demandas' | 'tarefas' | 'compromissos' | 'anotacoes';

/** Os escritórios ligam e desligam módulos (Configurações da plataforma); as pessoas existem em todos. */
type ModulosDoEscritorio = Record<string, boolean> | undefined;
/** Cada módulo da busca: o nome no filtro e se o escritório o tem ligado. */
export const MODULOS_DA_BUSCA: Record<ModuloDaBusca, { rotulo: string; ligado: (m: ModulosDoEscritorio) => boolean }> = {
  pessoas: { rotulo: 'Pessoas', ligado: () => true },
  processos: { rotulo: 'Processos', ligado: m => !!m?.processos },
  contratos: { rotulo: 'Contratos', ligado: m => !!m?.contratos },
  demandas: { rotulo: 'Demandas', ligado: m => !!m?.demandas },
  tarefas: { rotulo: 'Tarefas', ligado: m => !!m?.tarefas },
  compromissos: { rotulo: 'Compromissos', ligado: m => !!m?.compromissos },
  anotacoes: { rotulo: 'Anotações', ligado: m => !!m?.anotacoes }
};
/** Os módulos que o escritório tem ligados, na ordem do filtro. */
export const modulosLigados = (m: ModulosDoEscritorio) => (Object.keys(MODULOS_DA_BUSCA) as ModuloDaBusca[]).filter(x => MODULOS_DA_BUSCA[x].ligado(m));

/** O parâmetro do endereço que leva a busca à página do módulo (/pessoas/?busca=maria): a busca da página já vem preenchida. */
export const PARAMETRO_DA_BUSCA = 'busca';
/** O parâmetro do endereço que abre a página do módulo numa visão (/agenda/?visao=tabela). */
export const PARAMETRO_DA_VISAO = 'visao';
/** O que o "Ver todos" de um grupo põe no endereço além da busca. */
type AlemDaBusca = Partial<Record<typeof PARAMETRO_DA_VISAO, string>>;
/**
 * Cada grupo: o módulo dele, o título do grupo, como se chama cada item (o "tipo" que aparece antes do código), a página do
 * módulo (o cartão abre nela, com ?id=), o nome dela no "Ver todos em …" e o que esse "Ver todos" põe no endereço além da busca.
 * A Agenda abre na tabela: a visão por data só mostra o período da tela, e os compromissos achados em outras datas sumiriam.
 */
export const GRUPOS_DA_BUSCA: Record<GrupoDaBusca, { modulo: ModuloDaBusca; titulo: string; tipo: string; caminho: string; pagina: string; alemDaBusca: AlemDaBusca }> = {
  pessoas: { modulo: 'pessoas', titulo: 'Pessoas', tipo: 'Pessoa', caminho: '/pessoas/', pagina: 'Pessoas', alemDaBusca: {} },
  judiciais: { modulo: 'processos', titulo: TIPOS_PROCESSO.judicial.titulo, tipo: 'Processo judicial', caminho: TIPOS_PROCESSO.judicial.caminho, pagina: TIPOS_PROCESSO.judicial.titulo,
    alemDaBusca: {} },
  administrativos: { modulo: 'processos', titulo: TIPOS_PROCESSO.administrativo.titulo, tipo: 'Processo administrativo', caminho: TIPOS_PROCESSO.administrativo.caminho,
    pagina: TIPOS_PROCESSO.administrativo.titulo, alemDaBusca: {} },
  contratos: { modulo: 'contratos', titulo: 'Contratos', tipo: 'Contrato', caminho: '/contratos/', pagina: 'Contratos', alemDaBusca: {} },
  demandas: { modulo: 'demandas', titulo: 'Demandas', tipo: 'Demanda', caminho: '/demandas/', pagina: 'Demandas', alemDaBusca: {} },
  tarefas: { modulo: 'tarefas', titulo: 'Tarefas', tipo: 'Tarefa', caminho: '/tarefas/', pagina: 'Tarefas', alemDaBusca: {} },
  compromissos: { modulo: 'compromissos', titulo: 'Compromissos', tipo: 'Compromisso', caminho: '/agenda/', pagina: 'Agenda', alemDaBusca: { [PARAMETRO_DA_VISAO]: 'tabela' } },
  anotacoes: { modulo: 'anotacoes', titulo: 'Anotações', tipo: 'Anotação', caminho: '/documentos/', pagina: 'Documentos', alemDaBusca: {} }
};
/** Os grupos na ordem em que aparecem (a da tabela acima). */
export const ORDEM_DOS_GRUPOS = Object.keys(GRUPOS_DA_BUSCA) as GrupoDaBusca[];
/** Os grupos dos módulos indicados, na ordem em que aparecem. */
export const gruposDosModulos = (modulos: readonly ModuloDaBusca[]) => ORDEM_DOS_GRUPOS.filter(g => modulos.includes(GRUPOS_DA_BUSCA[g].modulo));

/** O endereço do cartão do item, como os links dos cartões: a página do módulo com ?id=. */
export const enderecoDoCartao = (grupo: GrupoDaBusca, id: string) => `${GRUPOS_DA_BUSCA[grupo].caminho}?id=${encodeURIComponent(id)}`;
/** O endereço de "Ver todos em …": a página do módulo com a busca preenchida (e, na Agenda, a tabela). */
export const enderecoDaPagina = (grupo: GrupoDaBusca, termo: string) =>
  `${GRUPOS_DA_BUSCA[grupo].caminho}?${new URLSearchParams({ [PARAMETRO_DA_BUSCA]: termo.trim(), ...GRUPOS_DA_BUSCA[grupo].alemDaBusca })}`;
/**
 * Os parâmetros que o "Ver todos" põe no endereço. A página do módulo os lê ao chegar e os tira do endereço: assim a busca
 * antiga não volta ao recarregar, e um novo "Ver todos" com o mesmo termo preenche o campo de novo.
 */
export const PARAMETROS_DO_VER_TODOS = [PARAMETRO_DA_BUSCA, ...new Set(Object.values(GRUPOS_DA_BUSCA).flatMap(g => Object.keys(g.alemDaBusca)))];

// ---------- o que a pessoa digitou ----------
/**
 * Como a busca entende o que foi digitado. "cnj": um número de processo judicial (20 algarismos, com ou sem pontuação). "cpf" e
 * "cnpj": um documento válido. "codigo": o código de um item (8 letras e números, como C0FFEE12) ou o número de um contrato
 * (HE62-0163-2026). "numero": outros números (telefone, número de processo administrativo). "texto": nomes, títulos, palavras.
 */
export type FormaDoTermo = 'vazio' | 'cnj' | 'cpf' | 'cnpj' | 'codigo' | 'numero' | 'texto';
export interface TermoDaBusca {
  /** O que foi digitado, sem os espaços das pontas. É o que vai para a busca de cada módulo, que já tira a pontuação dos números. */
  escrito: string;
  forma: FormaDoTermo;
  /** O termo para comparar: num número, só os algarismos; no resto, sem acentos e em minúsculas. */
  comparavel: string;
}
/** Só algarismos e a pontuação dos números (CPF, CNPJ, telefone, processo). */
const NUMERO_ESCRITO = /^[\d\s.\-/()+]+$/;
/** O código dos itens (privado.gerar_codigo, no banco): 8 letras de A a F e algarismos. */
const CODIGO_DO_ITEM = /^[0-9A-F]{8}$/i;
/** O número do contrato: a sigla do responsável, o número e o ano (supabase/migrations/20261027000009_contratos.sql). */
const NUMERO_DO_CONTRATO = /^[A-Z]{2}\d{2}-\d{4,}-\d{4}$/i;
const ehNumero = (escrito: string) => /\d/.test(escrito) && NUMERO_ESCRITO.test(escrito);
/** Na ordem: a primeira forma que combina é a do termo. */
const FORMAS: [FormaDoTermo, (escrito: string) => boolean][] = [
  ['vazio', e => !e],
  ['cnj', e => ehNumero(e) && dig(e).length === DIGITOS_DO_CNJ],
  ['cpf', e => ehNumero(e) && cpfValido(e)],
  // O CNPJ com letras (12.ABC.345/01DE-35) também é CNPJ, com ou sem a máscara, como na busca de cada módulo.
  ['cnpj', e => (ehNumero(e) || !!cnpjComLetrasNaBusca(e)) && cnpjValido(e)],
  ['codigo', e => CODIGO_DO_ITEM.test(e) || NUMERO_DO_CONTRATO.test(e)],
  ['numero', ehNumero],
  ['texto', () => true]
];
/** Os números se comparam pelos algarismos (o CNPJ, pelas letras e algarismos, em maiúsculas); o resto, sem acentos e em minúsculas. */
const COMPARAVEL: Record<FormaDoTermo, (escrito: string) => string> = {
  vazio: () => '', cnj: dig, cpf: dig, cnpj: limparDocumento, numero: dig, codigo: normal, texto: normal
};
export function lerTermo(texto: string): TermoDaBusca {
  const escrito = texto.replace(/\s+/g, ' ').trim();
  const forma = FORMAS.find(([, combina]) => combina(escrito))![0];
  return { escrito, forma, comparavel: COMPARAVEL[forma](escrito) };
}
/** Com menos de BUSCA_GERAL_MINIMO letras ou números, quase tudo combinaria: a busca espera a pessoa digitar mais. */
export const buscaPronta = (t: TermoDaBusca) => t.escrito.replace(/[^\p{L}\p{N}]/gu, '').length >= BUSCA_GERAL_MINIMO;
/**
 * Como a janela confirma o que entendeu, embaixo do campo: o número com a pontuação de sempre (a pessoa vê que "529982..." é
 * o CPF). Nomes e códigos não precisam.
 */
export const LEITURA_DO_TERMO: Record<FormaDoTermo, (t: TermoDaBusca) => string | null> = {
  vazio: () => null,
  cnj: t => `Número de processo ${fmtCNJ(t.comparavel)}`,
  cpf: t => `CPF ${fmtDocumento(t.comparavel)}`,
  cnpj: t => `CNPJ ${fmtDocumento(t.comparavel)}`,
  codigo: () => null,
  numero: () => null,
  texto: () => null
};

// ---------- os achados ----------
/** Um item achado, como a janela o mostra. */
export interface ItemAchado {
  tipo: 'achado';
  grupo: GrupoDaBusca;
  id: string;
  codigo: string;
  /** O nome do item: o nome da pessoa, o número do processo, os clientes do contrato, o título… */
  titulo: string;
  /** Uma linha pequena, para reconhecer o item sem abri-lo (o documento, os clientes, o prazo…). */
  contexto: string;
  /** Quando o item foi criado: o filtro de data usa. */
  criadoEm: string;
  /** O que, digitado inteiro, é exatamente este item (comparável como em lerTermo): o código e, se houver, o documento e o número. */
  exatos: string[];
}
/**
 * Um item que existe, mas de que a pessoa não faz parte (#363). Ele só aparece numa busca pelo código exato ou pelo número do
 * processo (semAcessoQueAparece), e só com o tipo e o código: nada do título, dos clientes ou do conteúdo. A linha mostra o botão
 * "Pedir para participar" ou, com o pedido pendente, "Cancelar". A consulta é SD.itensParaPedir (ui/fontesDaBuscaGeral.ts).
 */
export interface ItemSemAcesso {
  tipo: 'semAcesso';
  grupo: GrupoDoPedido;
  id: string;
  codigo: string;
  /** Nos processos: o número, só para conferir a busca (nunca aparece na tela). */
  numero?: string | null;
  /** O pedido pendente de quem busca, se houver. */
  pedido_id?: string | null;
}
/** O módulo de cada grupo em que se pede para participar (os dois grupos de processos são do mesmo módulo). */
export const MODULO_DO_GRUPO_DO_PEDIDO: Record<GrupoDoPedido, ModuloDoPedido> = {
  tarefas: 'tarefas', demandas: 'demandas', judiciais: 'processos', administrativos: 'processos',
  compromissos: 'compromissos', contratos: 'contratos', anotacoes: 'anotacoes'
};
/** O item que o banco achou para pedir, como a janela o mostra. */
export const semAcessoDoPedido = (i: ItemParaPedir): ItemSemAcesso =>
  ({ tipo: 'semAcesso', grupo: i.grupo, id: i.id, codigo: i.codigo, numero: i.numero, pedido_id: i.pedido_id });
export type ResultadoDaBusca = ItemAchado | ItemSemAcesso;

/** A linha que a listagem de cada grupo devolve. */
export interface LinhaDoGrupo {
  pessoas: PessoaLista; judiciais: ProcessoLista; administrativos: ProcessoLista;
  contratos: ContratoLista; demandas: DemandaLista;
  tarefas: TarefaLista; compromissos: CompromissoLista; anotacoes: AnotacaoLista;
}
/** A linha pequena: as partes que existem, separadas por " · ". */
const juntar = (...partes: (string | null | undefined | false)[]) => partes.filter(Boolean).join(' · ');
const clientes = (nomes: string | null | undefined) => nomes ? clientesPorExtenso(nomes) : '';
const prazo = (dia: string | null | undefined) => dia && `Prazo ${fmtData(dia)}`;
/** O processo é chamado pelo número (o judicial, com a pontuação do CNJ); sem ele, pelo título ou pelos clientes. */
const nomeDoProcesso = (x: ProcessoLista) => (x.tipo === 'judicial' ? fmtCNJ(x.numero) : x.numero) || x.titulo || clientes(x.cliente_nome);
const contextoDoProcesso = (x: ProcessoLista) => juntar(x.numero && x.titulo, clientes(x.cliente_nome), x.orgao, x.vara || x.comarca);

/** O que cada grupo mostra de cada linha: o título, o contexto e o que conta como busca exata. */
export const ACHADO_DO_GRUPO: { [G in GrupoDaBusca]: (x: LinhaDoGrupo[G]) => Pick<ItemAchado, 'titulo' | 'contexto' | 'exatos'> } = {
  pessoas: x => ({
    titulo: x.nome,
    contexto: juntar(TIPOS_PESSOA[x.tipo], x.nome_fantasia, x.documento && fmtDocumento(x.documento), [x.municipio, x.uf].filter(Boolean).join('/')),
    // O documento comparado como o CNPJ do termo (letras e algarismos): no CPF, ficam só os algarismos.
    exatos: [normal(x.codigo), limparDocumento(x.documento)]
  }),
  judiciais: x => ({ titulo: nomeDoProcesso(x), contexto: contextoDoProcesso(x), exatos: [normal(x.codigo), dig(x.numero)] }),
  administrativos: x => ({ titulo: nomeDoProcesso(x), contexto: contextoDoProcesso(x), exatos: [normal(x.codigo), dig(x.numero)] }),
  contratos: x => ({
    titulo: clientes(x.cliente_nome) || x.servico,
    contexto: juntar(x.servico, x.codigo_antigo && `Código antigo ${x.codigo_antigo}`),
    exatos: [normal(x.codigo), normal(x.codigo_antigo)]
  }),
  demandas: x => ({ titulo: x.titulo, contexto: juntar(clientes(x.cliente_nome), x.contrato_codigo && `Contrato ${x.contrato_codigo}`, prazo(x.prazo)), exatos: [normal(x.codigo)] }),
  tarefas: x => ({ titulo: x.titulo, contexto: juntar(clientes(x.pessoa_nome), x.demanda_codigo && `Demanda ${x.demanda_codigo}`, prazo(x.prazo)), exatos: [normal(x.codigo)] }),
  compromissos: x => ({
    titulo: nomeDoCompromisso(x),
    contexto: juntar(TIPOS_COMPROMISSO[x.tipo].nome, fmtData(x.data) + (x.hora ? ` às ${fmtHora(x.hora)}` : ''), x.local),
    exatos: [normal(x.codigo), dig(x.processo_numero)]
  }),
  anotacoes: x => ({ titulo: x.titulo, contexto: `Atualizada em ${fmtData(x.atualizado_em)}`, exatos: [normal(x.codigo)] })
};
/** A linha da listagem do grupo, como a janela a mostra. */
export function achadoDoGrupo<G extends GrupoDaBusca>(grupo: G, x: LinhaDoGrupo[G] & { id: string; codigo: string; criado_em: string }): ItemAchado {
  const mostrado = (ACHADO_DO_GRUPO[grupo] as (y: LinhaDoGrupo[G]) => Pick<ItemAchado, 'titulo' | 'contexto' | 'exatos'>)(x);
  return { tipo: 'achado', grupo, id: x.id, codigo: x.codigo, criadoEm: x.criado_em, ...mostrado, exatos: mostrado.exatos.filter(Boolean) };
}

/**
 * O pedaço do título que combina com o texto digitado, para a janela realçar: o que vem antes, o trecho e o que vem depois,
 * como está escrito (com os acentos). Só nas buscas por texto; sem o termo no título (ele combinou pelo cliente, pelo
 * documento…), null.
 */
export function trechoQueCombina(titulo: string, t: TermoDaBusca): [antes: string, trecho: string, depois: string] | null {
  if (t.forma !== 'texto' || !t.comparavel) return null;
  const letras = titulo.split('');
  const inicios: number[] = [];
  let comparavel = '';
  for (const letra of letras) { inicios.push(comparavel.length); comparavel += semAcento(letra); }
  const onde = comparavel.indexOf(t.comparavel);
  if (onde < 0) return null;
  const primeira = inicios.findLastIndex(i => i <= onde);
  const fim = onde + t.comparavel.length;
  const depoisDaUltima = inicios.findIndex(i => i >= fim);
  const ultima = depoisDaUltima < 0 ? letras.length : depoisDaUltima;
  return [letras.slice(0, primeira).join(''), letras.slice(primeira, ultima).join(''), letras.slice(ultima).join('')];
}

/** O item é exatamente o que foi digitado: o código, o documento ou o número inteiro. */
export const ehExato = (item: Pick<ItemAchado, 'exatos'>, t: TermoDaBusca) => !!t.comparavel && item.exatos.includes(t.comparavel);
/** Quão perto o achado está do que foi digitado: 0, exato; 1, o título começa com o termo; 2, o resto. */
export function relevancia(item: ItemAchado, t: TermoDaBusca) {
  if (ehExato(item, t)) return 0;
  return normal(item.titulo).startsWith(normal(t.escrito)) ? 1 : 2;
}
/** Os achados do mais perto ao mais longe do termo; entre os iguais, a ordem em que vieram (os mais novos primeiro). */
export const ordenarAchados = (itens: readonly ItemAchado[], t: TermoDaBusca) =>
  itens.map((item, i) => ({ item, i, r: relevancia(item, t) })).sort((a, b) => a.r - b.r || a.i - b.i).map(x => x.item);

/**
 * O item de que a pessoa não faz parte só aparece quando a busca é o código exato dele ou o número inteiro do processo (#363):
 * numa busca por nome ou por parte do código, ele não aparece.
 */
export function semAcessoQueAparece(item: ItemSemAcesso, t: TermoDaBusca) {
  // Compara como o banco (privado.itens_pelo_codigo) e a regra processos_numero_unico: só letras e algarismos, em maiúsculas.
  const termo = numeroParaComparar(t.escrito);
  return podeSerOCodigo(t) && !!termo && [item.codigo, item.numero ?? ''].map(numeroParaComparar).includes(termo);
}
/** O termo pode ser o código ou o número de um item: só então a busca procura os itens de que a pessoa não faz parte. */
export const podeSerOCodigo = (t: TermoDaBusca) => PEDE_O_EXATO[t.forma](t.escrito);
/**
 * O número de um processo administrativo com letras, como a patente do INPI (BR 10 2020 012345-6): letras sem acento, algarismos
 * e a pontuação dos números, com pelo menos uma letra e um algarismo. O que tem só algarismos já é das outras formas.
 */
const NUMERO_COM_LETRAS = /^(?=.*\d)(?=.*[A-Z])[A-Z\d\s.\-/()]+$/i;
/**
 * As formas de termo que podem ser o código ou o número de um item (o número do processo administrativo não tem formato: pode ser
 * só algarismos ou ter letras, e aí a forma é "texto").
 */
const PEDE_O_EXATO: Record<FormaDoTermo, (escrito: string) => boolean> = {
  vazio: () => false, cnj: () => true, cpf: () => false, cnpj: () => false, codigo: () => true, numero: () => true, texto: e => NUMERO_COM_LETRAS.test(e)
};

// ---------- filtro de data ----------
/** O filtro "Criado": pela data em que o item foi criado. Os nomes completam a frase ("Criado nos últimos 7 dias"). */
export type PeriodoDaBusca = 'qualquer' | 'semana' | 'mes' | 'ano';
export const PERIODOS_DA_BUSCA: Record<PeriodoDaBusca, { rotulo: string; dias: number | null }> = {
  qualquer: { rotulo: 'em qualquer data', dias: null },
  semana: { rotulo: 'nos últimos 7 dias', dias: 7 },
  mes: { rotulo: 'nos últimos 30 dias', dias: 30 },
  ano: { rotulo: 'nos últimos 12 meses', dias: 365 }
};
/** O item foi criado dentro do período, contado para trás a partir de agora. */
export function noPeriodo(criadoEm: string, periodo: PeriodoDaBusca, agora: Date) {
  const dias = PERIODOS_DA_BUSCA[periodo].dias;
  return dias === null || Date.parse(criadoEm) >= agora.getTime() - dias * DIA;
}

// ---------- os grupos na tela ----------
/** O que a busca de um grupo devolveu: os candidatos (até BUSCA_GERAL_CANDIDATOS, os mais novos primeiro) e quantos há ao todo. */
export interface BuscaDoGrupo { grupo: GrupoDaBusca; itens: ItemAchado[]; total: number }
export interface FiltrosDaBusca { modulo: FiltroDeModulo; periodo: PeriodoDaBusca }
export const FILTROS_PADRAO: FiltrosDaBusca = { modulo: 'todos', periodo: 'qualquer' };
/** Um grupo como a janela mostra: os resultados e se há mais na página do módulo ("Ver todos em …"). */
export interface GrupoMostrado { grupo: GrupoDaBusca; resultados: ResultadoDaBusca[]; total: number; maisNaPagina: boolean }

/**
 * Monta os grupos da janela: só os do módulo escolhido, os candidatos do período, do mais perto ao mais longe do termo, até
 * BUSCA_GERAL_POR_MODULO por grupo, e então os itens de que a pessoa não faz parte (#363) que a busca pede. Os grupos com um
 * achado exato vêm primeiro (a pessoa digitou o código: o item dele é o que ela quer); os outros, na ordem de sempre. Grupo
 * sem nada não aparece.
 * A ordem por relevância vale entre os candidatos: os BUSCA_GERAL_CANDIDATOS mais novos de cada módulo que contêm o termo.
 * Um item exato mais antigo que eles só aparece em "Ver todos" (a ordem por relevância para tudo pede uma busca no banco).
 * "Ver todos" aparece quando o grupo tem mais do que a janela mostra (a página do módulo abre com a busca, sem o filtro de data).
 * As listagens já vêm ordenadas pelos mais novos, então o filtro de data aplicado aqui dá os mesmos itens que daria no banco.
 */
export function montarGrupos(buscas: readonly BuscaDoGrupo[], semAcesso: readonly ItemSemAcesso[], t: TermoDaBusca, filtros: FiltrosDaBusca, agora: Date): GrupoMostrado[] {
  const doFiltro = (g: GrupoDaBusca) => filtros.modulo === 'todos' || GRUPOS_DA_BUSCA[g].modulo === filtros.modulo;
  const grupos = buscas.filter(b => doFiltro(b.grupo)).map(b => {
    const achados = ordenarAchados(b.itens.filter(i => noPeriodo(i.criadoEm, filtros.periodo, agora)), t).slice(0, BUSCA_GERAL_POR_MODULO);
    const codigos = new Set(achados.map(a => a.codigo));
    const fora = semAcesso.filter(s => s.grupo === b.grupo && !codigos.has(s.codigo) && semAcessoQueAparece(s, t));
    return { grupo: b.grupo, resultados: [...achados, ...fora], total: b.total, maisNaPagina: b.total > achados.length };
  }).filter(g => g.resultados.length);
  const temExato = (g: GrupoMostrado) => g.resultados.some(r => r.tipo === 'achado' && ehExato(r, t));
  return grupos.map((g, i) => ({ g, i, primeiro: temExato(g) ? 0 : 1 }))
    .sort((a, b) => a.primeiro - b.primeiro || ORDEM_DOS_GRUPOS.indexOf(a.g.grupo) - ORDEM_DOS_GRUPOS.indexOf(b.g.grupo) || a.i - b.i)
    .map(x => x.g);
}

/** Uma linha que as setas percorrem: um resultado ou o "Ver todos" de um grupo. */
export type OpcaoDaBusca = { tipo: 'resultado'; id: string; grupo: GrupoDaBusca; resultado: ResultadoDaBusca } | { tipo: 'verTodos'; id: string; grupo: GrupoDaBusca };
/** As linhas na ordem da tela (cada grupo: os resultados e, se houver mais, o "Ver todos"), com um id para o leitor de tela. */
export function opcoesDosGrupos(grupos: readonly GrupoMostrado[]): OpcaoDaBusca[] {
  return grupos.flatMap(g => [
    ...g.resultados.map(r => ({ tipo: 'resultado' as const, id: `${g.grupo}-${r.id}`, grupo: g.grupo, resultado: r })),
    ...(g.maisNaPagina ? [{ tipo: 'verTodos' as const, id: `${g.grupo}-ver-todos`, grupo: g.grupo }] : [])
  ]);
}
/**
 * A linha pequena do "Ver todos em …". O total é o do módulo inteiro, em qualquer data: com o filtro de data ligado, o número
 * não bate com o que a janela mostra, então a linha diz que a página mostra todas as datas. Os filtros da página continuam
 * valendo (o de responsável, por exemplo), e a linha avisa.
 */
export const textoDoVerTodos = (total: number, periodo: PeriodoDaBusca) => PERIODOS_DA_BUSCA[periodo].dias === null
  ? `${total} no total · a página abre com a busca e os filtros dela`
  : 'Em todas as datas · a página abre com a busca e os filtros dela';

/** O que uma linha da lista é: um achado, um item de que a pessoa não faz parte (#363) ou o "Ver todos" de um grupo. */
export type LinhaDaBusca = ResultadoDaBusca | { tipo: 'verTodos'; grupo: GrupoDaBusca };
export type TipoDaLinha = LinhaDaBusca['tipo'];
/** Uma tabela com um caso para cada tipo de linha, que recebe a linha já com o tipo dela. */
export type PorTipoDaLinha<A extends unknown[], R> = { [T in TipoDaLinha]: (linha: Extract<LinhaDaBusca, { tipo: T }>, ...resto: A) => R };
/** Chama o caso do tipo da linha numa tabela PorTipoDaLinha. */
export const pelaLinha = <A extends unknown[], R>(tabela: PorTipoDaLinha<A, R>, linha: LinhaDaBusca, ...resto: A) =>
  (tabela[linha.tipo] as (l: LinhaDaBusca, ...r: A) => R)(linha, ...resto);
export const linhaDaOpcao = (o: OpcaoDaBusca): LinhaDaBusca => o.tipo === 'verTodos' ? o : o.resultado;
/** Para onde cada linha leva: a página do módulo com a busca, o cartão do achado, ou nada (o item de que a pessoa não faz parte, #363). */
const ENDERECO_DA_LINHA: PorTipoDaLinha<[termo: string], string | null> = {
  verTodos: (l, termo) => enderecoDaPagina(l.grupo, termo),
  achado: l => enderecoDoCartao(l.grupo, l.id),
  semAcesso: () => null
};
export const enderecoDaLinha = (l: LinhaDaBusca, termo: string) => pelaLinha(ENDERECO_DA_LINHA, l, termo);

/**
 * O que a janela mostra embaixo dos filtros. "antes": a pessoa ainda não digitou o bastante. "resultados": há linhas (mesmo as
 * da busca anterior, enquanto a nova não chega). "buscando": sem linhas e sem a resposta do termo atual. "nada": a resposta
 * chegou vazia.
 */
export type SituacaoDaBusca = 'antes' | 'resultados' | 'buscando' | 'nada';
interface EstadoDaBusca { pronta: boolean; respondida: boolean; linhas: number }
/** Na ordem: a primeira situação que combina é a da janela. */
const SITUACOES: [SituacaoDaBusca, (e: EstadoDaBusca) => boolean][] = [
  ['antes', e => !e.pronta],
  ['resultados', e => e.linhas > 0],
  ['buscando', e => !e.respondida],
  ['nada', () => true]
];
export const situacaoDaBusca = (e: EstadoDaBusca) => SITUACOES.find(([, combina]) => combina(e))![0];
/**
 * O que o leitor de tela ouve a cada situação. Ao buscar sem nada à vista, o aviso "Buscando…" da tela já se anuncia; com as
 * linhas da busca anterior à vista, ele ouve que a nova busca está a caminho.
 */
export const ANUNCIO_DA_BUSCA: Record<SituacaoDaBusca, (grupos: readonly GrupoMostrado[], respondida: boolean) => string> = {
  antes: () => '',
  resultados: (grupos, respondida) => respondida ? resumoDosResultados(grupos) : 'Buscando…',
  buscando: () => '',
  nada: grupos => resumoDosResultados(grupos)
};

/** A linha seguinte (passo 1) ou a anterior (passo -1), dando a volta nas pontas; sem nenhuma escolhida, a primeira ou a última. */
export function proximaOpcao(atual: number, quantas: number, passo: 1 | -1) {
  if (!quantas) return -1;
  if (atual < 0) return passo === 1 ? 0 : quantas - 1;
  return (atual + passo + quantas) % quantas;
}
/** Quantos resultados a janela mostra, para o leitor de tela ouvir. */
export function resumoDosResultados(grupos: readonly GrupoMostrado[]) {
  const n = grupos.reduce((s, g) => s + g.resultados.length, 0);
  if (!n) return 'Nada encontrado.';
  const modulos = grupos.length === 1 ? 'em 1 módulo' : `em ${grupos.length} módulos`;
  return `${n === 1 ? '1 resultado' : `${n} resultados`} ${modulos}.`;
}

/** A tecla do atalho, como se escreve em cada aparelho: no Mac, Cmd (⌘); nos outros, Ctrl. */
export const atalhoDaBusca = (mac: boolean) => mac ? '⌘ K' : 'Ctrl K';
/** O atalho abre a busca: K com Ctrl (Windows, Linux) ou Cmd (Mac), sem Alt nem Shift. */
export const ehAtalhoDaBusca = (e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>) =>
  e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey;
