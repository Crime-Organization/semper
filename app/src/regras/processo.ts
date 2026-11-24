// Regras do processo (módulo Processos): os dois tipos (judicial e administrativo), as listas prontas, o cadastro por etapas, o que aparece no cartão, as
// pessoas com papel e os recursos e incidentais (#316). Tudo puro, sem tela nem banco. O número no padrão do CNJ fica em regras/numeroCNJ.ts.
import type {
  CampoDeOpcao, DadosProcesso, GratuidadeProcesso, LigacaoDeProcesso, MeioProcesso, Membro, Modulo, PapeisDosClientes, PapelDaParte, PapelNoProcesso, PoloProcesso, Processo, ProcessoLista,
  ProcessoLigado, ProcessoRelacionado, RelacaoEntreProcessos, TipoProcesso
} from '../dados/tipos';
import { pessoasAoGravar, type CartaoAntes } from './sairDoCartao';
import { CLIENTES_MAXIMOS, COLABORADORES_MAXIMOS, PARTES_MAXIMAS, TAMANHO_PROCESSO, VALOR_CAUSA_LIMITE } from '../dados/limites';
import { clientesPorExtenso, dinheiroNoCampo, fmtDinheiro, lerDinheiro } from './contrato';
import { cnjValido, erroDoCNJ, fmtCNJ, orgaoDoCNJ, partesDoCNJ } from './numeroCNJ';
import { fmtData, lerData } from './pessoa';
import { normal } from './texto';
import { estaPeloGrupo } from './gruposDaEquipe';
import { tipoQueFica } from './investigacaoNoAdministrativo';
import {
  AREA_DA_PI, APRESENTACOES_DA_MARCA, camposDaProtecao, dadosDaProtecao, erroDaProtecao, fmtClassesNice, NATUREZAS_DA_MARCA, PAPEIS_DA_PI, papeisDaProtecao,
  PROTECAO_VAZIA, TIPOS_DE_PROTECAO, type CampoDaProtecao, type CamposProtecao
} from './propriedadeIntelectual';

/** Rótulo dos processos fora das colunas do quadro. */
export const SEM_SITUACAO_PROCESSO = 'Sem situação';

/** Os quadros dos processos, um por tipo. */
export type QuadroDeProcesso = Extract<Modulo, 'processos_judiciais' | 'processos_administrativos'>;
/**
 * O que cada tipo de processo tem de próprio: o nome, o título da página, o quadro e o endereço. Extrajudicial e investigação, da #316,
 * saíram na #406: os processos deles viraram administrativos (regras/investigacaoNoAdministrativo.ts).
 */
export const TIPOS_PROCESSO: Record<TipoProcesso, { nome: string; titulo: string; quadro: QuadroDeProcesso; caminho: string }> = {
  judicial: { nome: 'Judicial', titulo: 'Processos judiciais', quadro: 'processos_judiciais', caminho: '/processos/judicial/' },
  administrativo: { nome: 'Administrativo', titulo: 'Processos administrativos', quadro: 'processos_administrativos', caminho: '/processos/administrativo/' }
};
export const TIPOS = Object.keys(TIPOS_PROCESSO) as TipoProcesso[];
export const ehTipoDeProcesso = (valor: string): valor is TipoProcesso => Object.hasOwn(TIPOS_PROCESSO, valor);
/** O tipo que vem do endereço (?tipo=): os que saíram (#406) viram administrativo; fora da lista, o judicial. */
export function tipoDoEndereco(valor: string | null): TipoProcesso {
  const tipo = tipoQueFica(valor ?? '');
  return ehTipoDeProcesso(tipo) ? tipo : 'judicial';
}

/** O polo do cliente; vítima, investigado e apenado servem aos processos criminais (#289). A lista do banco é a mesma (migração polo_criminal). */
export const POLOS: Record<PoloProcesso, string> = { autor: 'Autor', reu: 'Réu', terceiro: 'Terceiro', vitima: 'Vítima', investigado: 'Investigado', apenado: 'Apenado' };
export const MEIOS: Record<MeioProcesso, string> = { eletronico: 'Eletrônico', fisico: 'Físico' };
export const GRATUIDADES: Record<GratuidadeProcesso, string> = { nao_pedida: 'Não pedida', pedida: 'Pedida', concedida: 'Concedida', negada: 'Negada' };

/** As listas prontas; o administrador acrescenta outras opções a cada uma. */
export const OPCOES_PRONTAS: Record<CampoDeOpcao, string[]> = {
  sistema: ['PJe', 'eproc', 'Projudi', 'SEEU', 'JPe', 'CPE (STJ)', 'SEI', 'e-SAJ', 'e-INSS', 'e-Marcas', 'e-Patentes', 'Físico (sem sistema)'],
  natureza: ['Procedimento comum', 'Procedimento especial', 'Juizado especial', 'Execução', 'Cumprimento de sentença', 'Mandado de segurança', 'Ação trabalhista', 'Ação penal'],
  area: ['Cível', 'Consumidor', 'Empresarial', 'Família e sucessões', 'Previdenciário', AREA_DA_PI, 'Trabalhista', 'Tributário', 'Penal', 'Administrativo']
};
/** O nome de cada lista no cadastro. */
export const LISTAS_DO_PROCESSO: Record<CampoDeOpcao, { rotulo: string }> = {
  sistema: { rotulo: 'Sistema de tramitação' }, natureza: { rotulo: 'Natureza processual' }, area: { rotulo: 'Área do direito' }
};
/**
 * A lista de um campo: as prontas, as do escritório e o valor atual, se ele tiver saído da lista. Um nome aparece uma vez só,
 * sem contar maiúsculas nem acentos, na grafia da lista pronta (#288). O valor atual é a exceção: se foi gravado com outra
 * grafia ("Seeu"), ele toma o lugar da opção igual, para o processo continuar com o sistema dele até alguém trocar.
 */
export function opcoesDoCampo(campo: CampoDeOpcao, doEscritorio: string[], atual = ''): string[] {
  const lista: string[] = [];
  for (const o of [...OPCOES_PRONTAS[campo], ...doEscritorio]) if (!opcaoNaLista(lista, o)) lista.push(o);
  if (!atual) return lista;
  const igual = opcaoNaLista(lista, atual);
  return igual === null ? [...lista, atual] : lista.map(o => o === igual ? atual : o);
}
/** Se o valor é de uma lista pronta (sem contar maiúsculas nem acentos): retirar do escritório não o tiraria da lista. */
export const ehOpcaoPronta = (campo: CampoDeOpcao, valor: string) => opcaoNaLista(OPCOES_PRONTAS[campo], valor) !== null;
/** A opção da lista com esse texto, sem contar maiúsculas nem acentos (para não repetir "PJE" e "PJe", "Civel" e "Cível"). */
export const opcaoNaLista = (lista: string[], texto: string) => {
  const procurado = normal(texto.trim());
  return lista.find(o => normal(o) === procurado) ?? null;
};

// ---------- formulário ----------
/** Campos do formulário de processo, como digitados. Os de propriedade intelectual (#317) vêm de CamposProtecao. */
export interface CamposProcesso extends CamposProtecao {
  tipo: TipoProcesso;
  numero: string;
  /** Número antigo, de antes do padrão do CNJ: o sistema não confere o formato. */
  numeroAntigo: boolean;
  titulo: string;
  orgao: string;
  responsavelId: string;
  colaboradores: string[];
  /** Um por linha (o id da pessoa escolhida; linha vazia ainda sem pessoa). */
  clientes: string[];
  /** O papel de cada cliente (#426), pelo id da pessoa: obrigatório para cada cliente escolhido. */
  papeisClientes: PapeisDosClientes;
  sistema: string;
  meio: MeioProcesso | '';
  area: string;
  natureza: string;
  gratuidade: GratuidadeProcesso | '';
  comarca: string;
  vara: string;
  classe: string;
  assunto: string;
  juiz: string;
  /** dd/mm/aaaa, ou vazio. */
  distribuicao: string;
  /** Em reais, como digitado. */
  valorCausa: string;
  instancia: string;
  segredo: boolean;
  advogadoContrario: string;
  observacoes: string;
  /** Os campos que o escritório criou, como digitados, por id do campo (regras em camposDeProcesso.ts). */
  extras: Record<string, string>;
  /** O processo de que este nasce (#316), só no cadastro de um recurso ou incidental; vazio nos outros. */
  origemId: string;
  /** Recurso ou incidental: obrigatório quando há origem. */
  ligacao: LigacaoDeProcesso | '';
}
export const processoVazio = (tipo: TipoProcesso): CamposProcesso => ({
  tipo, numero: '', numeroAntigo: false, titulo: '', orgao: '', responsavelId: '', colaboradores: [], clientes: [''], papeisClientes: {}, sistema: '', meio: '', area: '',
  natureza: '', gratuidade: '', comarca: '', vara: '', classe: '', assunto: '', juiz: '', distribuicao: '', valorCausa: '', instancia: '', segredo: false,
  advogadoContrario: '', observacoes: '', extras: {}, origemId: '', ligacao: '', ...PROTECAO_VAZIA
});

type DefineONumero = Pick<CamposProcesso, 'tipo' | 'numero' | 'numeroAntigo'>;
/** O número precisa seguir o padrão do CNJ? Só no judicial, e quem marca como antigo fica de fora. */
const conferirCNJ = (c: DefineONumero) => c.tipo === 'judicial' && !c.numeroAntigo;
/** O órgão que o número indica (TJMG, TRF6...), só no judicial e com o número completo. */
export const orgaoDoNumero = (c: DefineONumero) => conferirCNJ(c) ? orgaoDoCNJ(c.numero) : null;
/** O que torna dois números o mesmo processo (como o índice processos_numero_unico da migração). */
export const numeroParaComparar = (numero: string) => numero.toUpperCase().replace(/[^A-Z0-9]/g, '');
/** O órgão que veio do número, ao abrir um processo salvo (o sistema só troca o que ele mesmo indicou). */
export const orgaoIndicadoNoProcesso = (c: DefineONumero & Pick<CamposProcesso, 'orgao'>) => c.orgao && orgaoDoNumero(c) === c.orgao ? c.orgao : '';
/**
 * Quando o número, o tipo ou a caixa de número antigo mudam: no padrão do CNJ e completo, o número fica pontuado; antes
 * disso, fica como foi digitado, para nada se perder se a pessoa marcar depois que é antigo. O órgão acompanha o número,
 * mas o que a pessoa digitou à mão não é trocado.
 */
export function aoMudarNumero(c: CamposProcesso, mudanca: Partial<DefineONumero>, orgaoIndicado: string) {
  const novo = { ...c, ...mudanca };
  const numero = conferirCNJ(novo) && partesDoCNJ(novo.numero) ? fmtCNJ(novo.numero) : novo.numero;
  const indicado = orgaoDoNumero({ ...novo, numero }) ?? '';
  const seguir = !c.orgao || c.orgao === orgaoIndicado;
  return { campos: { ...mudanca, numero, ...(seguir ? { orgao: indicado } : {}) }, orgaoIndicado: indicado };
}

type Conferencia = (c: CamposProcesso) => string | null;
/** Os campos de propriedade intelectual do cadastro (#317): cada tipo de proteção mostra os seus (TIPOS_DE_PROTECAO). */
const CAMPOS_DA_PI: CampoDaProtecao[] = ['deposito', 'concessao', 'publicacao', 'criacao', 'apresentacaoMarca', 'naturezaMarca', 'classesNice', 'especificacao', 'variacoes', 'linguagem'];
const escolhidos = (lista: string[]) => lista.filter(Boolean);
const repetido = (lista: string[]) => new Set(escolhidos(lista)).size < escolhidos(lista).length;
const ateTamanho = (campo: keyof typeof TAMANHO_PROCESSO, nome: string): Conferencia => c => {
  const texto = c[campo as keyof CamposProcesso];
  return typeof texto === 'string' && texto.trim().length > TAMANHO_PROCESSO[campo] ? `${nome} pode ter até ${TAMANHO_PROCESSO[campo]} caracteres.` : null;
};

/** Quem lê a data e o dinheiro já avisa o que está errado. */
const semErroAoLer = (ler: (c: CamposProcesso) => unknown): Conferencia => c => {
  try { ler(c); return null; } catch (e) { return (e as Error).message; }
};

/** O que falta escolher no processo que nasce de outro: o administrativo oferece também o judicial a partir dele (#425). */
const ESCOLHA_A_LIGACAO: Record<TipoProcesso, string> = {
  judicial: 'Escolha se é um recurso ou um incidental.',
  administrativo: 'Escolha se é um recurso, um incidental ou o processo judicial a partir do administrativo.'
};

/** Os campos só do judicial não contam no administrativo: estão fora da tela e não são gravados. */
const soNoJudicial = (conferencia: Conferencia): Conferencia => c => c.tipo === 'judicial' ? conferencia(c) : null;

/** Regras do cadastro, uma lista por campo (a primeira que falhar dá a mensagem). Campo novo = entrada nova aqui. */
const CONFERENCIAS: Partial<Record<keyof CamposProcesso, Conferencia[]>> = {
  numero: [
    c => c.numero.trim() ? null : 'Informe o número do processo.',
    c => conferirCNJ(c) ? erroDoCNJ(c.numero) : null,
    ateTamanho('numero', 'O número')
  ],
  titulo: [ateTamanho('titulo', 'O nome do cartão')],
  ligacao: [
    c => c.origemId && !c.ligacao ? ESCOLHA_A_LIGACAO[c.tipo] : null,
    // O judicial do administrativo (#425) é sempre judicial (o banco recusa o resto).
    c => c.origemId && c.ligacao && LIGACOES[c.ligacao].tipo && LIGACOES[c.ligacao].tipo !== c.tipo ? SO_JUDICIAL_NO_ADMINISTRATIVO : null
  ],
  orgao: [ateTamanho('orgao', 'A sigla do órgão')],
  responsavelId: [c => c.responsavelId ? null : 'Escolha o responsável.'],
  colaboradores: [
    c => repetido(c.colaboradores) ? 'A mesma pessoa aparece duas vezes nos colaboradores.' : null,
    c => escolhidos(c.colaboradores).length > COLABORADORES_MAXIMOS ? `Um processo pode ter até ${COLABORADORES_MAXIMOS} colaboradores.` : null
  ],
  clientes: [
    c => escolhidos(c.clientes).length ? null : 'Escolha pelo menos um cliente.',
    c => repetido(c.clientes) ? 'O mesmo cliente aparece duas vezes.' : null,
    c => escolhidos(c.clientes).length > CLIENTES_MAXIMOS ? `Um processo pode ter até ${CLIENTES_MAXIMOS} clientes.` : null
  ],
  papeisClientes: [c => clientesSemPapel(c).length ? PAPEL_DO_CLIENTE_OBRIGATORIO : null],
  comarca: [soNoJudicial(ateTamanho('comarca', 'A comarca'))],
  vara: [soNoJudicial(ateTamanho('vara', 'A vara'))],
  classe: [soNoJudicial(ateTamanho('classe', 'A classe'))],
  assunto: [soNoJudicial(ateTamanho('assunto', 'O assunto'))],
  juiz: [soNoJudicial(ateTamanho('juiz', 'O nome do juiz ou relator'))],
  instancia: [soNoJudicial(ateTamanho('instancia', 'A instância'))],
  advogadoContrario: [soNoJudicial(ateTamanho('advogadoContrario', 'O nome do advogado contrário'))],
  observacoes: [ateTamanho('observacoes', 'As observações')],
  distribuicao: [soNoJudicial(semErroAoLer(c => lerData(c.distribuicao)))],
  valorCausa: [soNoJudicial(semErroAoLer(c => {
    if ((lerDinheiro(c.valorCausa) ?? 0) >= VALOR_CAUSA_LIMITE) throw new Error('Esse valor é grande demais: confira o valor da causa.');
  }))],
  // Propriedade intelectual (#317): cada campo só conta no processo de PI, com um tipo de proteção que o tenha.
  ...Object.fromEntries(CAMPOS_DA_PI.map(campo => [campo, [(c: CamposProcesso) => erroDaProtecao(c, campo)]]))
};

/** Erros do cadastro, por campo. Vazio: pode salvar. */
export function validarProcesso(c: CamposProcesso): Partial<Record<keyof CamposProcesso, string>> {
  const erros: Partial<Record<keyof CamposProcesso, string>> = {};
  for (const [campo, regras] of Object.entries(CONFERENCIAS) as [keyof CamposProcesso, Conferencia[]][]) {
    const erro = regras.map(r => r(c)).find(Boolean);
    if (erro) erros[campo] = erro;
  }
  return erros;
}

const textoOuNulo = (t: string) => t.trim() || null;
/** Os campos que só o processo judicial tem, zerados no administrativo. */
function soDoJudicial(c: CamposProcesso): Pick<DadosProcesso, 'natureza' | 'gratuidade' | 'comarca' | 'vara' | 'classe' | 'assunto' | 'juiz' | 'distribuicao' | 'valor_causa' | 'instancia' | 'segredo' | 'advogado_contrario'> {
  if (c.tipo !== 'judicial') return { natureza: null, gratuidade: null, comarca: null, vara: null, classe: null, assunto: null, juiz: null, distribuicao: null, valor_causa: null, instancia: null, segredo: false, advogado_contrario: null };
  return {
    natureza: textoOuNulo(c.natureza), gratuidade: c.gratuidade || null, comarca: textoOuNulo(c.comarca), vara: textoOuNulo(c.vara), classe: textoOuNulo(c.classe),
    assunto: textoOuNulo(c.assunto), juiz: textoOuNulo(c.juiz), distribuicao: lerData(c.distribuicao), valor_causa: lerDinheiro(c.valorCausa),
    instancia: textoOuNulo(c.instancia), segredo: c.segredo, advogado_contrario: textoOuNulo(c.advogadoContrario)
  };
}

/** O que vai para o banco (só depois de validarProcesso sem erros). O número no padrão fica pontuado, e o responsável não entra nos colaboradores. */
export function dadosDoProcesso(c: CamposProcesso): DadosProcesso {
  return {
    numero: conferirCNJ(c) ? fmtCNJ(c.numero) : c.numero.trim(), titulo: textoOuNulo(c.titulo), orgao: textoOuNulo(c.orgao), responsavel_id: c.responsavelId,
    colaboradores: [...new Set(escolhidos(c.colaboradores))].filter(id => id !== c.responsavelId), clientes: [...new Set(escolhidos(c.clientes))],
    papeis_clientes: papeisDosEscolhidos(c), sistema: textoOuNulo(c.sistema), meio: c.meio || null, area: textoOuNulo(c.area), observacoes: textoOuNulo(c.observacoes),
    ...soDoJudicial(c), ...dadosDaProtecao(c)
  };
}

/** A origem do processo novo (#316), que vai junto ao criar (ela não muda depois). Sem origem, nada. */
export const origemAoCriar = (c: Pick<CamposProcesso, 'origemId' | 'ligacao'>): Pick<DadosProcesso, 'origem_id' | 'ligacao'> =>
  c.origemId && c.ligacao ? { origem_id: c.origemId, ligacao: c.ligacao } : {};

/**
 * Quem não é administrador nem criou o processo só o vê enquanto participa, e o banco recusa a gravação que o tiraria
 * dele. Por isso, ao passar o processo adiante ou sair dos colaboradores, esta gravação ainda a mantém como colaboradora. A saída vem depois, por SD.cartaoSair: assim o resto é gravado e ela sai de verdade (#276).
 */
export function semSairDoProcesso(d: DadosProcesso, eu: string, podeSair: boolean, antes: CartaoAntes): { dados: DadosProcesso; ficou: boolean } {
  const colaboradores = d.colaboradores ?? [];
  const r = pessoasAoGravar(colaboradores, d.responsavel_id, eu, antes, podeSair);
  return { dados: r.lista === colaboradores ? d : { ...d, colaboradores: r.lista }, ficou: r.ficou };
}

/** Campos do formulário a partir de um processo salvo (para atualizar). Número fora do padrão: marcado como antigo, para não bloquear a edição. */
export const camposDoProcesso = (p: Processo): CamposProcesso => ({
  tipo: p.tipo, numero: p.numero, numeroAntigo: p.tipo === 'judicial' && !cnjValido(p.numero), titulo: p.titulo || '', orgao: p.orgao || '',
  responsavelId: p.responsavel_id, colaboradores: [...p.colaboradores], clientes: p.clientes.length ? p.clientes.map(x => x.id) : [''],
  papeisClientes: { ...p.papeis_clientes },
  sistema: p.sistema || '', meio: p.meio || '', area: p.area || '', natureza: p.natureza || '', gratuidade: p.gratuidade || '', comarca: p.comarca || '', vara: p.vara || '',
  classe: p.classe || '', assunto: p.assunto || '', juiz: p.juiz || '', distribuicao: fmtData(p.distribuicao), valorCausa: dinheiroNoCampo(p.valor_causa),
  instancia: p.instancia || '', segredo: p.segredo, advogadoContrario: p.advogado_contrario || '', observacoes: p.observacoes || '', extras: {},
  origemId: p.origem_id || '', ligacao: p.ligacao || '', ...camposDaProtecao(p)
});

// ---------- etapas do cadastro ----------
export type EtapaProcesso = 'processo' | 'pessoas' | 'detalhes';
export interface DefinicaoEtapaProcesso { id: EtapaProcesso; titulo: string; texto: string; campos: (keyof CamposProcesso)[] }
/** As etapas do cadastro, na ordem. São obrigatórios o tipo, o número e o cliente, e sempre há um responsável (começa com quem cadastra). */
export const ETAPAS_PROCESSO: DefinicaoEtapaProcesso[] = [
  { id: 'processo', titulo: 'O processo', texto: 'O tipo, o número e, se quiser, um nome para o cartão.', campos: ['ligacao', 'tipo', 'numero', 'numeroAntigo', 'titulo', 'orgao'] },
  { id: 'pessoas', titulo: 'Pessoas', texto: 'De quais clientes é o processo, o papel de cada um nele e quem da equipe cuida dele.', campos: ['clientes', 'papeisClientes', 'responsavelId', 'colaboradores'] },
  { id: 'detalhes', titulo: 'Detalhes', texto: 'Nada aqui é obrigatório: dá para preencher depois.',
    campos: ['sistema', 'meio', 'area', 'natureza', 'gratuidade', 'comarca', 'vara', 'classe', 'assunto', 'juiz', 'distribuicao', 'valorCausa', 'instancia', 'segredo', 'advogadoContrario',
      'protecao', ...CAMPOS_DA_PI, 'observacoes'] }
];
/** Erros só dos campos de uma etapa (o que impede de seguir para a próxima). */
export function errosDaEtapaProcesso(etapa: EtapaProcesso, c: CamposProcesso): Partial<Record<keyof CamposProcesso, string>> {
  const campos = ETAPAS_PROCESSO.find(e => e.id === etapa)!.campos, erros = validarProcesso(c);
  return Object.fromEntries(Object.entries(erros).filter(([campo]) => campos.includes(campo as keyof CamposProcesso)));
}
/** Posição da primeira etapa com erro (para voltar a ela ao salvar), ou -1 se pode salvar. */
export const primeiraEtapaComErroProcesso = (c: CamposProcesso) => ETAPAS_PROCESSO.findIndex(e => Object.keys(errosDaEtapaProcesso(e.id, c)).length > 0);

// ---------- cartão e histórico ----------
type ParaNomear = Pick<ProcessoLista, 'titulo' | 'cliente_nome' | 'numero'>;
/** O nome do cartão: o que a pessoa deu; sem isso, os clientes. */
export const nomeDoProcesso = (p: ParaNomear) => p.titulo || clientesPorExtenso(p.cliente_nome) || p.numero;

// ---------- ligar um processo que já existe a outro cartão (#294) ----------
type ParaDetalhar = Pick<ProcessoLista, 'tipo' | 'numero' | 'codigo'>;
/** Embaixo do nome, na busca de processo: o tipo, o número e o código, para distinguir processos do mesmo cliente. */
export const detalheDoProcesso = (p: ParaDetalhar) => [TIPOS_PROCESSO[p.tipo].nome, p.numero, p.codigo].filter(Boolean).join(' · ');
/** O que a busca oferece: os achados que ainda não estão ligados ao cartão, na ordem em que vieram. */
export const processosParaOferecer = <T extends { id: string }>(achados: readonly T[], ligados: readonly string[]) =>
  achados.filter(p => !ligados.includes(p.id));
/** O que gravar ao salvar um cadastro: os processos que entraram e os que saíram (os que ficaram não mudam). */
export const mudancasNosProcessos = (antes: readonly string[], depois: readonly string[]) => ({
  ligar: depois.filter(id => !antes.includes(id)),
  desligar: antes.filter(id => !depois.includes(id))
});
/** Se ainda cabe outro processo: a tarefa e o compromisso têm um só; a demanda e o contrato, vários (sem máximo). */
export const cabeOutroProcesso = (ligados: number, maximo?: number) => maximo === undefined || ligados < maximo;

/** Nome de cada campo no histórico de alterações. */
export const CAMPOS_PROCESSO: Record<string, string> = {
  numero: 'Número', titulo: 'Nome do cartão', responsavel_id: 'Responsável', colaboradores: 'Colaboradores', clientes: 'Clientes', orgao: 'Órgão', sistema: 'Sistema',
  polo: 'Polo do cliente', area: 'Área do direito', meio: 'Meio de tramitação', natureza: 'Natureza processual', gratuidade: 'Gratuidade de justiça', comarca: 'Comarca',
  vara: 'Vara', classe: 'Classe', assunto: 'Assunto', juiz: 'Juiz ou relator', distribuicao: 'Distribuição', valor_causa: 'Valor da causa', instancia: 'Instância',
  segredo: 'Segredo de justiça', advogado_contrario: 'Advogado contrário', observacoes: 'Observações', etapa: 'Situação', arquivado_em: 'Arquivamento',
  partes: 'Pessoas do processo', origem_id: 'Processo de origem', ligacao: 'Ligação com o processo de origem', papeis_clientes: 'Papel do cliente',
  // Propriedade intelectual (#317).
  protecao: 'Tipo de proteção', deposito: 'Depósito', concessao: 'Concessão', publicacao: 'Publicação', criacao: 'Criação', apresentacao_marca: 'Apresentação da marca',
  natureza_marca: 'Natureza da marca', classes_nice: 'Classes de Nice', especificacao: 'Especificação', variacoes: 'Variações do desenho', linguagem: 'Linguagem de programação'
};
/** O que o campo vazio quer dizer no histórico, quando não é só um traço: a origem fica vazia quando é excluída (#316) ou desligada (#425). */
const VAZIO_NO_HISTORICO: Record<string, string> = { origem_id: 'sem ligação' };
/** A pessoa com papel como o histórico a guarda (#316): o nome e o papel. */
const parteNoHistorico = (v: unknown) => {
  const x = v as { nome?: string; papel?: string };
  return `${x.nome ?? 'pessoa excluída'} (${PAPEIS_DA_PARTE[x.papel as PapelDaParte] ?? x.papel})`;
};
const naLista = (lista: Record<string, string>) => (v: unknown) => lista[String(v)] ?? String(v);
const FORMATOS: Record<string, (v: unknown) => string> = {
  polo: naLista(POLOS), meio: naLista(MEIOS), gratuidade: naLista(GRATUIDADES), distribuicao: v => fmtData(String(v)), arquivado_em: v => fmtData(String(v)),
  valor_causa: v => fmtDinheiro(Number(v)), segredo: v => v ? 'Sim' : 'Não', partes: parteNoHistorico,
  // O banco guarda o papel pelo id de cada cliente (#426): o histórico mostra os papéis.
  papeis_clientes: v => papeisDosClientesPorExtenso(v as PapeisDosClientes) || '—',
  // O histórico guarda o id da origem: mostra só que estava ligado (o processo de origem pode já não existir).
  origem_id: () => 'ligado', ligacao: v => LIGACOES[v as LigacaoDeProcesso]?.nome ?? String(v),
  protecao: v => TIPOS_DE_PROTECAO[v as keyof typeof TIPOS_DE_PROTECAO]?.nome ?? String(v), apresentacao_marca: naLista(APRESENTACOES_DA_MARCA),
  natureza_marca: naLista(NATUREZAS_DA_MARCA), deposito: v => fmtData(String(v)), concessao: v => fmtData(String(v)), publicacao: v => fmtData(String(v)),
  criacao: v => fmtData(String(v)), classes_nice: v => Array.isArray(v) && v.length ? fmtClassesNice(v as number[]) : '—'
};
/** Como cada campo aparece no cartão e no histórico (o que não está aqui aparece como foi guardado). */
export const valorLegivelProcesso = (campo: string, v: unknown) =>
  v === null || v === undefined || v === '' ? VAZIO_NO_HISTORICO[campo] ?? '—' : (FORMATOS[campo] ?? String)(v);

/** Os campos da seção de dados do cartão, na ordem. */
// O papel de cada cliente (#426) aparece ao lado dele, na seção Clientes; o antigo polo, um só para o processo, não aparece mais.
const CAMPOS_NO_CARTAO: (keyof Processo)[] = ['numero', 'orgao', 'sistema', 'meio', 'area', 'protecao', 'deposito', 'publicacao', 'concessao', 'criacao',
  'apresentacao_marca', 'natureza_marca', 'classes_nice', 'especificacao', 'variacoes', 'linguagem', 'natureza', 'gratuidade', 'comarca', 'vara', 'classe', 'assunto', 'juiz', 'distribuicao', 'valor_causa', 'instancia', 'segredo', 'advogado_contrario', 'observacoes'];
/** O dado está preenchido: nem vazio, nem falso (segredo de justiça), nem lista vazia (classes de Nice). */
const preenchido = (v: unknown) => ![null, undefined, '', false].includes(v as never) && !(Array.isArray(v) && !v.length);
/** Os dados do cartão, só os preenchidos (segredo de justiça aparece só quando há). */
export const linhasDoProcesso = (p: Processo): [string, string][] => CAMPOS_NO_CARTAO
  .filter(campo => preenchido(p[campo]))
  .map(campo => [CAMPOS_PROCESSO[campo], valorLegivelProcesso(campo, p[campo])]);

// ---------- pessoas do processo ----------
export const PAPEIS_NO_PROCESSO: Record<PapelNoProcesso, string> = { cliente: 'Cliente', responsavel: 'Responsável', colaborador: 'Colaborador' };
/**
 * Os papéis de uma pessoa no processo, além dos clientes (#316), na ordem da lista do cadastro. A lista do banco é a mesma
 * (regra check de processo_partes): papel novo = entrada nova aqui e lá.
 */
export const PAPEIS_DA_PARTE: Record<PapelDaParte, string> = {
  autor: 'Autor', reu: 'Réu', terceiro: 'Terceiro interessado', testemunha: 'Testemunha', perito: 'Perito', assistente_tecnico: 'Assistente técnico',
  vitima: 'Vítima', investigado: 'Investigado', apenado: 'Apenado', advogado_contrario: 'Advogado da parte contrária', outro: 'Outro papel',
  // Só nos processos de propriedade intelectual (#317): veja papeisParaEscolher.
  titular: 'Titular', inventor: 'Inventor', autor_da_criacao: 'Autor da criação'
};
export const PAPEIS = Object.keys(PAPEIS_DA_PARTE) as PapelDaParte[];
export const ehPapelDaParte = (v: unknown): v is PapelDaParte => typeof v === 'string' && Object.hasOwn(PAPEIS_DA_PARTE, v);

// ---------- o papel de cada cliente (#426) ----------
/** A recusa de salvar o processo com algum cliente sem papel. */
export const PAPEL_DO_CLIENTE_OBRIGATORIO = 'O papel do cliente é obrigatório: escolha o papel de cada cliente.';
/**
 * A lista do "Papel do cliente": a mesma das pessoas com papel (decisão do dono), inteira, porque a área do processo (que separa os
 * papéis de propriedade intelectual) só é escolhida depois, nos detalhes. O "Outro papel" fica por último.
 */
export const PAPEIS_DO_CLIENTE: PapelDaParte[] = [...PAPEIS.filter(x => x !== 'outro'), 'outro'];
/** Os clientes escolhidos que ainda estão sem papel. */
export const clientesSemPapel = (c: Pick<CamposProcesso, 'clientes' | 'papeisClientes'>) => escolhidos(c.clientes).filter(id => !c.papeisClientes[id]);
/** O que vai para o banco: o papel de cada cliente escolhido (o de quem saiu da lista fica de fora). */
const papeisDosEscolhidos = (c: Pick<CamposProcesso, 'clientes' | 'papeisClientes'>): PapeisDosClientes =>
  Object.fromEntries(escolhidos(c.clientes).flatMap(id => c.papeisClientes[id] ? [[id, c.papeisClientes[id]]] : []));
/**
 * Como o gatilho preparar_papeis do banco (migração papel_do_cliente, #426): só os clientes do processo guardam papel, e o cliente
 * sem papel recebe o antigo polo do processo, se houver (é assim que a versão anterior do site, que só conhece o polo, continua
 * funcionando). Vale também para a conversão dos processos de antes.
 */
export const papeisAoGravar = (papeis: PapeisDosClientes, clientes: readonly string[], polo: PoloProcesso | null): PapeisDosClientes =>
  Object.fromEntries(clientes.flatMap(id => { const papel = papeis[id] ?? polo; return papel ? [[id, papel]] : []; }));
/** Ao trocar a pessoa de uma linha de cliente no cadastro, o papel escolhido na linha passa para a nova (se ela ainda não tem um). */
export const papeisAoTrocarCliente = (papeis: PapeisDosClientes, antes: string, depois: string): PapeisDosClientes =>
  !antes || !depois || !papeis[antes] || papeis[depois] ? papeis : { ...papeis, [depois]: papeis[antes] };
/**
 * O papel que a pergunta já traz escolhido quando alguém entra como cliente pelo cartão (#426): o dos clientes que o processo já tem
 * (o primeiro deles), que costumam estar do mesmo lado; sem nenhum, o primeiro da lista (Autor). A pessoa confere e pode trocar.
 */
export const papelSugeridoDoCliente = (papeis: PapeisDosClientes | undefined): PapelDaParte =>
  Object.values(papeis ?? {}).find(ehPapelDaParte) ?? PAPEIS_DO_CLIENTE[0];
/** O papel escolhido para um cliente no cadastro; a opção vazia tira o papel. */
export const comPapelDoCliente = (papeis: PapeisDosClientes, clienteId: string, valor: string): PapeisDosClientes =>
  ({ ...papeis, [clienteId]: ehPapelDaParte(valor) ? valor : undefined });
/** Os papéis dos clientes por extenso (#426): cada papel uma vez, na ordem da lista ("Autor, Réu"). Nenhum papel: vazio. */
export const papeisDosClientesPorExtenso = (papeis: PapeisDosClientes) => {
  const usados = new Set(Object.values(papeis));
  return PAPEIS_DO_CLIENTE.filter(x => usados.has(x)).map(x => PAPEIS_DA_PARTE[x]).join(', ');
};
/** O que o cartão do processo diz embaixo do nome de cada cliente: o papel dele, ou que ainda falta informá-lo. */
export const clienteNoCartao = (papel: PapelDaParte | undefined) => papel ? `Cliente · ${PAPEIS_DA_PARTE[papel]}` : 'Cliente · papel a informar';
/** Os selos da miniatura do processo (quadro e lista, #426), na ordem: o órgão, o sistema e o papel dos clientes. Os vazios saem. */
export const selosDoProcesso = (p: Pick<ProcessoLista, 'orgao' | 'sistema' | 'papeis_clientes'>) =>
  [p.orgao, p.sistema, papeisDosClientesPorExtenso(p.papeis_clientes ?? {})].filter((x): x is string => !!x);
/**
 * Os papéis que o formulário oferece no processo: os de qualquer processo e, nos de propriedade intelectual, os do tipo de
 * proteção (#317; ex.: inventor só em patente e modelo de utilidade). O "Outro papel" fica por último.
 */
export function papeisParaEscolher(p: { area?: string | null; protecao?: Processo['protecao'] }): PapelDaParte[] {
  const comuns = PAPEIS.filter(x => !PAPEIS_DA_PI.includes(x) && x !== 'outro');
  return [...comuns, ...papeisDaProtecao(p), 'outro'];
}
/** A recusa de pôr a pessoa com um papel que ela já tem no processo (a mesma no banco e no fictício). */
export const PAPEL_REPETIDO = 'Esta pessoa já tem esse papel neste processo.';
/** O que o cartão da pessoa diz do papel dela em cada processo: cliente, equipe e os papéis com pessoa (#316). */
export const papeisPorExtenso = (p: { papeis: PapelNoProcesso[]; partes?: PapelDaParte[] }) =>
  [...p.papeis.map(x => PAPEIS_NO_PROCESSO[x]), ...(p.partes ?? []).map(x => PAPEIS_DA_PARTE[x])].join(', ');
/** Os papéis que a pessoa ainda não tem no processo (o mesmo papel duas vezes, o banco recusa). */
export const papeisQueFaltam = (partes: readonly { papel: PapelDaParte; pessoa: { id: string } }[], pessoaId: string) =>
  PAPEIS.filter(papel => !partes.some(x => x.pessoa.id === pessoaId && x.papel === papel));
/** Se ainda cabe outra pessoa com papel no processo (o banco tem o mesmo máximo). */
export const cabeOutraParte = (partes: number) => partes < PARTES_MAXIMAS;

// ---------- recursos e incidentais (#316) e o judicial que nasceu do administrativo (#425) ----------
interface ComoLiga {
  /** No cadastro ("Este processo é") e no histórico. */
  nome: string;
  /** O botão do cartão de origem. */
  novo: string;
  /** De que tipos de processo ele nasce. */
  daOrigem: readonly TipoProcesso[];
  /** O tipo do processo novo; sem ele, o mesmo da origem. */
  tipo?: TipoProcesso;
  /** Como a origem aparece no cartão do processo novo. */
  origem: RelacaoEntreProcessos;
}
/** Cada ligação entre processos (a lista do banco é a mesma: migração processo_judicial_do_administrativo). Ligação nova = entrada nova. */
export const LIGACOES: Record<LigacaoDeProcesso, ComoLiga> = {
  recurso: { nome: 'Recurso', novo: 'Novo recurso', daOrigem: ['judicial', 'administrativo'], origem: 'origem' },
  incidental: { nome: 'Incidental', novo: 'Novo incidental', daOrigem: ['judicial', 'administrativo'], origem: 'origem' },
  // O judicial ligado ao administrativo inteiro (#425), de qualquer área: nasce dele ou é ligado depois, e se desliga.
  judicial: { nome: 'Processo judicial a partir do administrativo', novo: 'Novo processo judicial a partir deste', daOrigem: ['administrativo'], tipo: 'judicial',
    origem: 'administrativo' }
};
export const TIPOS_DE_LIGACAO = Object.keys(LIGACOES) as LigacaoDeProcesso[];
/** As ligações que um processo deste tipo oferece aos que nascem dele (no cadastro e nos botões do cartão). */
export const ligacoesDaOrigem = (tipo: TipoProcesso) => TIPOS_DE_LIGACAO.filter(l => LIGACOES[l].daOrigem.includes(tipo));
/** O tipo do processo que nasce de outro: o da ligação (o judicial do administrativo) ou, sem ela, o da origem. */
export const tipoDoDerivado = (ligacao: LigacaoDeProcesso | '', tipoDaOrigem: TipoProcesso): TipoProcesso => (ligacao && LIGACOES[ligacao].tipo) || tipoDaOrigem;
/** O "+" do título da seção no cartão: o que o cadastro vai perguntar. */
export const ROTULO_DO_NOVO_DERIVADO: Record<TipoProcesso, string> = {
  judicial: 'Novo recurso ou incidental deste processo',
  administrativo: 'Novo recurso, incidental ou processo judicial a partir deste'
};
/** Como cada processo ligado aparece no cartão do outro. */
export const RELACOES: Record<RelacaoEntreProcessos, string> = {
  origem: 'Processo de origem', recurso: 'Recurso deste processo', incidental: 'Incidental deste processo',
  administrativo: 'Processo administrativo de origem', judicial: 'Processo judicial deste administrativo'
};
/** As recusas da ligação "judicial", as mesmas no banco e no fictício (#425). */
export const SO_JUDICIAL_NO_ADMINISTRATIVO = 'Só um processo judicial pode ser ligado a um processo administrativo.';
export const JUDICIAL_JA_LIGADO = 'Este processo judicial já está ligado a outro processo.';
export const ARQUIVADO_SEM_LIGACAO = 'Processo arquivado não recebe ligação nova.';
/**
 * Como o processo achado se relaciona com o aberto: é a origem dele (o administrativo, se o aberto é o judicial que nasceu dele), ou
 * nasceu dele (recurso, incidental ou judicial). null quando não há ligação entre os dois.
 */
export function relacaoEntreProcessos(achado: Pick<Processo, 'id' | 'origem_id' | 'ligacao'>, aberto: Pick<Processo, 'id' | 'origem_id' | 'ligacao'>): RelacaoEntreProcessos | null {
  if (achado.id === aberto.origem_id) return aberto.ligacao ? LIGACOES[aberto.ligacao].origem : 'origem';
  return achado.origem_id === aberto.id ? achado.ligacao ?? 'recurso' : null;
}
/**
 * Se a ligação com o processo relacionado se desfaz no cartão (#425) e qual é o judicial dela (quem guarda a origem). null: não se
 * desfaz (a origem do recurso e do incidental, e os que nasceram como eles).
 */
const QUEM_GUARDA_A_LIGACAO: Record<RelacaoEntreProcessos, (relacionadoId: string, abertoId: string) => string | null> = {
  administrativo: (_r, aberto) => aberto, judicial: r => r, origem: () => null, recurso: () => null, incidental: () => null
};
export const judicialParaDesligar = (relacionado: Pick<ProcessoRelacionado, 'id' | 'relacao'>, abertoId: string): string | null =>
  QUEM_GUARDA_A_LIGACAO[relacionado.relacao](relacionado.id, abertoId);
/** O judicial que pode ser ligado ao administrativo: ativo e ainda sem origem (o recurso e o incidental já têm a deles). */
export const judicialParaLigar = (p: Pick<Processo, 'tipo' | 'origem_id' | 'arquivado_em'>) => p.tipo === 'judicial' && !p.origem_id && !p.arquivado_em;
/** As relações em que o processo achado é a origem do aberto. */
const SAO_ORIGEM: readonly RelacaoEntreProcessos[] = Object.values(LIGACOES).map(l => l.origem);
const ehOrigem = (r: RelacaoEntreProcessos) => Number(SAO_ORIGEM.includes(r));
/** A ordem no cartão: a origem primeiro; depois os que nasceram dele, dos mais novos aos mais antigos. */
export const ordemDosRelacionados = <T extends { relacao: RelacaoEntreProcessos; criado_em: string }>(lista: readonly T[]) =>
  lista.toSorted((a, b) => ehOrigem(b.relacao) - ehOrigem(a.relacao) || b.criado_em.localeCompare(a.criado_em));
/** O endereço do cadastro de um processo que nasce deste (recurso, incidental, judicial); sem a ligação, o cadastro pergunta qual. */
export const cadastroDoDerivado = (origemId: string, ligacao?: LigacaoDeProcesso) =>
  `/processos/novo/?processo=${encodeURIComponent(origemId)}${ligacao ? '&ligacao=' + ligacao : ''}`;
/** A ligação que vem do endereço (?ligacao=); fora da lista, nenhuma (a pessoa escolhe no cadastro). */
export const ligacaoDoEndereco = (valor: string | null): LigacaoDeProcesso | '' => TIPOS_DE_LIGACAO.find(l => l === valor) ?? '';
/**
 * A ligação do endereço que vale para a origem lida: a que este tipo de origem não oferece (o judicial pedido de uma origem judicial,
 * num link antigo ou mudado à mão) volta a nenhuma, e a pessoa escolhe no cadastro, em vez de só o banco recusar ao salvar.
 */
export const ligacaoDaOrigem = (ligacao: LigacaoDeProcesso | '', tipoDaOrigem: TipoProcesso): LigacaoDeProcesso | '' =>
  ligacao && ligacoesDaOrigem(tipoDaOrigem).includes(ligacao) ? ligacao : '';
/**
 * O processo que nasce de outro (#316): do mesmo tipo, com os mesmos clientes e o papel de cada um (#426), a área, o sistema e o meio, e
 * a equipe ativa dele (quem cadastra fica de responsável se o de lá saiu da equipe). O número, o órgão, os andamentos e o resto são do
 * processo novo.
 */
export const processoDoProcesso = (o: Pick<Processo, 'id' | 'tipo' | 'responsavel_id' | 'colaboradores' | 'papeis_clientes' | 'area' | 'sistema' | 'meio'> & { clientes: { id: string }[] },
  ativos: readonly string[], eu: string): Partial<CamposProcesso> => {
  const responsavelId = ativos.includes(o.responsavel_id) ? o.responsavel_id : eu;
  return {
    origemId: o.id, tipo: o.tipo, responsavelId, colaboradores: o.colaboradores.filter(id => ativos.includes(id) && id !== responsavelId),
    clientes: o.clientes.length ? o.clientes.map(x => x.id) : [''], papeisClientes: { ...o.papeis_clientes }, area: o.area ?? '', sistema: o.sistema ?? '', meio: o.meio ?? ''
  };
};
interface PessoasDoProcesso { clientes: string[]; responsavel_id: string; colaboradores: string[] }
const CONFERE_PAPEL: Record<PapelNoProcesso, (p: PessoasDoProcesso, pessoaId: string, perfilId: string | null) => boolean> = {
  cliente: (p, id) => p.clientes.includes(id),
  responsavel: (p, _id, perfil) => !!perfil && p.responsavel_id === perfil,
  colaborador: (p, _id, perfil) => !!perfil && p.colaboradores.includes(perfil)
};
/** Os papéis da pessoa no processo (vazio: ela não está nele). */
/**
 * Quem altera o processo (como a regra do banco): os administradores, quem criou, o responsável, os colaboradores e quem está num
 * grupo da equipe posto nele (`meusGrupos`, #378).
 */
export const alteraOProcesso = (p: { criado_por: string | null; responsavel_id: string; colaboradores: string[]; grupos?: string[] }, m: { id: string; papel: string },
  meusGrupos: readonly string[] = []) =>
  m.papel === 'master' || m.papel === 'admin' || m.id === p.criado_por || m.id === p.responsavel_id || p.colaboradores.includes(m.id)
  || estaPeloGrupo(p.grupos, meusGrupos);
/**
 * Por que o membro não pode ser mencionado no processo (null se pode, #362): só quem o vê por estar nele (quem o criou, o
 * responsável e os colaboradores) e os administradores, como o gatilho privado.mencao_no_processo do banco. Com as chaves da
 * equipe ("equipe_ve_tudo" ou "equipe_edita_tudo"), o cartão não passa esta regra: todos podem ser mencionados.
 */
export const motivoSemMencaoNoProcesso = (p: { criado_por: string | null; responsavel_id: string; colaboradores: string[] }) =>
  (m: Membro) => alteraOProcesso(p, { id: m.id, papel: m.papel ?? 'usuario' }) ? null : 'não participa; inclua como colaborador';
/** A mensagem de quando alguém que não está no processo aparece num comentário dele (a mesma do banco). */
export const mencaoNegadaNoProcesso = (nome: string) => `Não é possível mencionar ${nome} neste processo: inclua essa pessoa como colaboradora antes.`;

export const papeisNoProcesso = (p: PessoasDoProcesso, pessoaId: string, perfilId: string | null = null) =>
  (Object.keys(CONFERE_PAPEL) as PapelNoProcesso[]).filter(papel => CONFERE_PAPEL[papel](p, pessoaId, perfilId));

// ---------- o que as duas pontas de dados montam (supabase.ts e falso.ts, #316) ----------
type ProcessoDaPessoa = Pick<Processo, 'id' | 'codigo' | 'tipo' | 'numero' | 'titulo' | 'cliente_nome' | 'etapa_id' | 'arquivado_em' | 'criado_em' | 'responsavel_id' | 'colaboradores'>
  & { clientes: string[] };
/**
 * Os processos do cartão da pessoa: os em que ela é cliente ou da equipe (`daEquipe`) e os em que tem um papel (`partes`), cada
 * processo uma vez só, com tudo o que ela é nele, dos mais novos aos mais antigos.
 */
export function processosComPartes(daEquipe: readonly ProcessoDaPessoa[], partes: readonly { papel: PapelDaParte; processo: ProcessoDaPessoa }[],
  pessoaId: string, perfilId: string | null): ProcessoLigado[] {
  const porId = new Map<string, ProcessoDaPessoa>();
  for (const p of [...daEquipe, ...partes.map(x => x.processo)]) porId.set(p.id, p);
  return [...porId.values()].map(({ clientes, responsavel_id, colaboradores, ...p }): ProcessoLigado => ({
    ...p, papeis: papeisNoProcesso({ clientes, responsavel_id, colaboradores }, pessoaId, perfilId),
    partes: PAPEIS.filter(papel => partes.some(x => x.processo.id === p.id && x.papel === papel))
  })).filter(p => p.papeis.length || p.partes?.length).toSorted((a, b) => b.criado_em.localeCompare(a.criado_em));
}
/** Os processos ligados ao aberto, cada um com a relação (os sem ligação com ele saem), na ordem do cartão. */
export function relacionadosDoProcesso(achados: readonly (Omit<ProcessoRelacionado, 'relacao'> & Pick<Processo, 'origem_id' | 'ligacao'>)[],
  aberto: Pick<Processo, 'id' | 'origem_id' | 'ligacao'>): ProcessoRelacionado[] {
  return ordemDosRelacionados(achados.flatMap(({ origem_id, ligacao, ...p }) => {
    const relacao = relacaoEntreProcessos({ id: p.id, origem_id, ligacao }, aberto);
    return relacao ? [{ ...p, relacao }] : [];
  }));
}
