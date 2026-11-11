// Regras do processo (módulo Processos): os dois tipos, as listas prontas, o cadastro por etapas e o que aparece no cartão.
// Tudo puro, sem tela nem banco. O número no padrão do CNJ fica em regras/numeroCNJ.ts.
import type { CampoDeOpcao, DadosProcesso, GratuidadeProcesso, MeioProcesso, Modulo, PapelNoProcesso, PoloProcesso, Processo, ProcessoLista, TipoProcesso } from '../dados/tipos';
import { pessoasAoGravar, type CartaoAntes } from './sairDoCartao';
import { CLIENTES_MAXIMOS, COLABORADORES_MAXIMOS, TAMANHO_PROCESSO, VALOR_CAUSA_LIMITE } from '../dados/limites';
import { clientesPorExtenso, dinheiroNoCampo, fmtDinheiro, lerDinheiro } from './contrato';
import { cnjValido, erroDoCNJ, fmtCNJ, orgaoDoCNJ, partesDoCNJ } from './numeroCNJ';
import { fmtData, lerData } from './pessoa';
import { normal } from './texto';

/** Rótulo dos processos fora das colunas do quadro. */
export const SEM_SITUACAO_PROCESSO = 'Sem situação';

/** O que cada tipo de processo tem de próprio: o nome, o quadro e o endereço. */
export const TIPOS_PROCESSO: Record<TipoProcesso, { nome: string; titulo: string; quadro: Extract<Modulo, 'processos_judiciais' | 'processos_administrativos'>; caminho: string }> = {
  judicial: { nome: 'Judicial', titulo: 'Processos judiciais', quadro: 'processos_judiciais', caminho: '/processos/judicial/' },
  administrativo: { nome: 'Administrativo', titulo: 'Processos administrativos', quadro: 'processos_administrativos', caminho: '/processos/administrativo/' }
};
export const TIPOS = Object.keys(TIPOS_PROCESSO) as TipoProcesso[];

export const POLOS: Record<PoloProcesso, string> = { autor: 'Autor', reu: 'Réu', terceiro: 'Terceiro' };
export const MEIOS: Record<MeioProcesso, string> = { eletronico: 'Eletrônico', fisico: 'Físico' };
export const GRATUIDADES: Record<GratuidadeProcesso, string> = { nao_pedida: 'Não pedida', pedida: 'Pedida', concedida: 'Concedida', negada: 'Negada' };

/** As listas prontas; o administrador acrescenta outras opções a cada uma. */
export const OPCOES_PRONTAS: Record<CampoDeOpcao, string[]> = {
  sistema: ['PJe', 'eproc', 'Projudi', 'SEI', 'e-SAJ', 'e-INSS', 'e-Marcas', 'e-Patentes', 'Físico (sem sistema)'],
  natureza: ['Procedimento comum', 'Procedimento especial', 'Juizado especial', 'Execução', 'Cumprimento de sentença', 'Mandado de segurança', 'Ação trabalhista', 'Ação penal'],
  area: ['Cível', 'Consumidor', 'Empresarial', 'Família e sucessões', 'Previdenciário', 'Propriedade intelectual', 'Trabalhista', 'Tributário', 'Penal', 'Administrativo']
};
/** O nome de cada lista no cadastro. */
export const LISTAS_DO_PROCESSO: Record<CampoDeOpcao, { rotulo: string }> = {
  sistema: { rotulo: 'Sistema de tramitação' }, natureza: { rotulo: 'Natureza processual' }, area: { rotulo: 'Área do direito' }
};
/** A lista de um campo: as prontas, as do escritório e o valor atual, se ele tiver saído da lista. */
export const opcoesDoCampo = (campo: CampoDeOpcao, doEscritorio: string[], atual = ''): string[] =>
  [...new Set([...OPCOES_PRONTAS[campo], ...doEscritorio, ...(atual ? [atual] : [])])];
/** A opção da lista com esse texto, sem contar maiúsculas nem acentos (para não repetir "PJE" e "PJe", "Civel" e "Cível"). */
export const opcaoNaLista = (lista: string[], texto: string) => {
  const procurado = normal(texto.trim());
  return lista.find(o => normal(o) === procurado) ?? null;
};

// ---------- formulário ----------
/** Campos do formulário de processo, como digitados. */
export interface CamposProcesso {
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
  polo: PoloProcesso | '';
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
}
export const processoVazio = (tipo: TipoProcesso): CamposProcesso => ({
  tipo, numero: '', numeroAntigo: false, titulo: '', orgao: '', responsavelId: '', colaboradores: [], clientes: [''], polo: '', sistema: '', meio: '', area: '',
  natureza: '', gratuidade: '', comarca: '', vara: '', classe: '', assunto: '', juiz: '', distribuicao: '', valorCausa: '', instancia: '', segredo: false,
  advogadoContrario: '', observacoes: '', extras: {}
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
  }))]
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
    polo: c.polo || null, sistema: textoOuNulo(c.sistema), meio: c.meio || null, area: textoOuNulo(c.area), observacoes: textoOuNulo(c.observacoes),
    ...soDoJudicial(c)
  };
}

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
  responsavelId: p.responsavel_id, colaboradores: [...p.colaboradores], clientes: p.clientes.length ? p.clientes.map(x => x.id) : [''], polo: p.polo || '',
  sistema: p.sistema || '', meio: p.meio || '', area: p.area || '', natureza: p.natureza || '', gratuidade: p.gratuidade || '', comarca: p.comarca || '', vara: p.vara || '',
  classe: p.classe || '', assunto: p.assunto || '', juiz: p.juiz || '', distribuicao: fmtData(p.distribuicao), valorCausa: dinheiroNoCampo(p.valor_causa),
  instancia: p.instancia || '', segredo: p.segredo, advogadoContrario: p.advogado_contrario || '', observacoes: p.observacoes || '', extras: {}
});

// ---------- etapas do cadastro ----------
export type EtapaProcesso = 'processo' | 'pessoas' | 'detalhes';
export interface DefinicaoEtapaProcesso { id: EtapaProcesso; titulo: string; texto: string; campos: (keyof CamposProcesso)[] }
/** As etapas do cadastro, na ordem. São obrigatórios o tipo, o número e o cliente, e sempre há um responsável (começa com quem cadastra). */
export const ETAPAS_PROCESSO: DefinicaoEtapaProcesso[] = [
  { id: 'processo', titulo: 'O processo', texto: 'O tipo, o número e, se quiser, um nome para o cartão.', campos: ['tipo', 'numero', 'numeroAntigo', 'titulo', 'orgao'] },
  { id: 'pessoas', titulo: 'Pessoas', texto: 'De quais clientes é o processo e quem da equipe cuida dele.', campos: ['clientes', 'polo', 'responsavelId', 'colaboradores'] },
  { id: 'detalhes', titulo: 'Detalhes', texto: 'Nada aqui é obrigatório: dá para preencher depois.',
    campos: ['sistema', 'meio', 'area', 'natureza', 'gratuidade', 'comarca', 'vara', 'classe', 'assunto', 'juiz', 'distribuicao', 'valorCausa', 'instancia', 'segredo', 'advogadoContrario', 'observacoes'] }
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
  segredo: 'Segredo de justiça', advogado_contrario: 'Advogado contrário', observacoes: 'Observações', etapa: 'Situação', arquivado_em: 'Arquivamento'
};
const naLista = (lista: Record<string, string>) => (v: unknown) => lista[String(v)] ?? String(v);
const FORMATOS: Record<string, (v: unknown) => string> = {
  polo: naLista(POLOS), meio: naLista(MEIOS), gratuidade: naLista(GRATUIDADES), distribuicao: v => fmtData(String(v)), arquivado_em: v => fmtData(String(v)),
  valor_causa: v => fmtDinheiro(Number(v)), segredo: v => v ? 'Sim' : 'Não'
};
/** Como cada campo aparece no cartão e no histórico (o que não está aqui aparece como foi guardado). */
export const valorLegivelProcesso = (campo: string, v: unknown) =>
  v === null || v === undefined || v === '' ? '—' : (FORMATOS[campo] ?? String)(v);

/** Os campos da seção de dados do cartão, na ordem. */
const CAMPOS_NO_CARTAO: (keyof Processo)[] = ['numero', 'orgao', 'sistema', 'meio', 'polo', 'area', 'natureza', 'gratuidade', 'comarca', 'vara', 'classe', 'assunto', 'juiz', 'distribuicao', 'valor_causa', 'instancia', 'segredo', 'advogado_contrario', 'observacoes'];
/** Os dados do cartão, só os preenchidos (segredo de justiça aparece só quando há). */
export const linhasDoProcesso = (p: Processo): [string, string][] => CAMPOS_NO_CARTAO
  .filter(campo => ![null, undefined, '', false].includes(p[campo] as never))
  .map(campo => [CAMPOS_PROCESSO[campo], valorLegivelProcesso(campo, p[campo])]);

// ---------- pessoas do processo ----------
export const PAPEIS_NO_PROCESSO: Record<PapelNoProcesso, string> = { cliente: 'Cliente', responsavel: 'Responsável', colaborador: 'Colaborador' };
interface PessoasDoProcesso { clientes: string[]; responsavel_id: string; colaboradores: string[] }
const CONFERE_PAPEL: Record<PapelNoProcesso, (p: PessoasDoProcesso, pessoaId: string, perfilId: string | null) => boolean> = {
  cliente: (p, id) => p.clientes.includes(id),
  responsavel: (p, _id, perfil) => !!perfil && p.responsavel_id === perfil,
  colaborador: (p, _id, perfil) => !!perfil && p.colaboradores.includes(perfil)
};
/** Os papéis da pessoa no processo (vazio: ela não está nele). */
/** Quem altera o processo (como a regra do banco): os administradores, quem criou, o responsável e os colaboradores. */
export const alteraOProcesso = (p: { criado_por: string | null; responsavel_id: string; colaboradores: string[] }, m: { id: string; papel: string }) =>
  m.papel === 'master' || m.papel === 'admin' || m.id === p.criado_por || m.id === p.responsavel_id || p.colaboradores.includes(m.id);

export const papeisNoProcesso = (p: PessoasDoProcesso, pessoaId: string, perfilId: string | null = null) =>
  (Object.keys(CONFERE_PAPEL) as PapelNoProcesso[]).filter(papel => CONFERE_PAPEL[papel](p, pessoaId, perfilId));
