// Regras do compromisso (módulo Compromissos, a agenda): os tipos, o cadastro por etapas, o que aparece no cartão, os papéis
// de cada pessoa e quem vê. Tudo puro, sem tela nem banco. As contas de data da agenda ficam em regras/agenda.ts.
import type { Compromisso, CompromissoLigado, DadosCompromisso, Membro, ModalidadeCompromisso, PapelNoCompromisso, ProcessoDoCompromisso, TipoCompromisso } from '../dados/tipos';
import { pessoasAoGravar, type CartaoAntes } from './sairDoCartao';
import { CLIENTES_MAXIMOS, COLABORADORES_MAXIMOS, TAMANHO_COMPROMISSO } from '../dados/limites';
import { clientesPorExtenso } from './contrato';
import { fmtData, lerData } from './pessoa';

/** O fuso da agenda: a data e a hora dos compromissos são as do relógio de Brasília. */
export const FUSO_DA_AGENDA = 'America/Sao_Paulo';

/** Rótulo dos compromissos fora das colunas do quadro. */
export const SEM_SITUACAO_COMPROMISSO = 'Sem situação';

/**
 * O que cada tipo tem de próprio. "doProcesso": exige um processo e a modalidade, tem resultado e pode ficar sem título
 * (o cartão mostra o tipo e as pessoas). "exigeHora": sem ela, vale o dia inteiro. As regras do banco são as mesmas (migração).
 */
export const TIPOS_COMPROMISSO: Record<TipoCompromisso, { nome: string; doProcesso: boolean; exigeHora: boolean }> = {
  audiencia: { nome: 'Audiência', doProcesso: true, exigeHora: true },
  pericia: { nome: 'Perícia', doProcesso: true, exigeHora: true },
  reuniao: { nome: 'Reunião', doProcesso: false, exigeHora: true },
  outro: { nome: 'Outro', doProcesso: false, exigeHora: false }
};
export const TIPOS = Object.keys(TIPOS_COMPROMISSO) as TipoCompromisso[];
export const MODALIDADES: Record<ModalidadeCompromisso, string> = { presencial: 'Presencial', virtual: 'Virtual' };

// ---------- formulário ----------
/** Campos do formulário de compromisso, como digitados. */
export interface CamposCompromisso {
  tipo: TipoCompromisso;
  titulo: string;
  /** dd/mm/aaaa. */
  data: string;
  /** hh:mm, ou vazio. */
  hora: string;
  horaFim: string;
  modalidade: ModalidadeCompromisso | '';
  local: string;
  processoId: string;
  responsavelId: string;
  participantes: string[];
  /** Uma por linha (o id da pessoa escolhida; linha vazia ainda sem pessoa). */
  pessoas: string[];
  geral: boolean;
  resultado: string;
  observacoes: string;
}
export const compromissoVazio = (tipo: TipoCompromisso = 'reuniao'): CamposCompromisso => ({
  tipo, titulo: '', data: '', hora: '', horaFim: '', modalidade: '', local: '', processoId: '', responsavelId: '', participantes: [], pessoas: [''], geral: false, resultado: '', observacoes: ''
});

type Conferencia = (c: CamposCompromisso) => string | null;
const escolhidos = (lista: string[]) => lista.filter(Boolean);
const repetido = (lista: string[]) => new Set(escolhidos(lista)).size < escolhidos(lista).length;
const ateTamanho = (campo: keyof typeof TAMANHO_COMPROMISSO, nome: string): Conferencia => c =>
  c[campo].trim().length > TAMANHO_COMPROMISSO[campo] ? `${nome} pode ter até ${TAMANHO_COMPROMISSO[campo]} caracteres.` : null;
const doTipo = (c: Pick<CamposCompromisso, 'tipo'>) => TIPOS_COMPROMISSO[c.tipo];

/** Regras do cadastro, uma lista por campo (a primeira que falhar dá a mensagem). Campo novo = entrada nova aqui. */
const CONFERENCIAS: Partial<Record<keyof CamposCompromisso, Conferencia[]>> = {
  titulo: [
    c => doTipo(c).doProcesso || c.titulo.trim() ? null : 'Dê um título ao compromisso.',
    ateTamanho('titulo', 'O título')
  ],
  data: [
    c => c.data.trim() ? null : 'Informe a data.',
    c => { try { lerData(c.data); return null; } catch (e) { return (e as Error).message; } }
  ],
  hora: [c => doTipo(c).exigeHora && !c.hora ? 'Informe a hora.' : null],
  horaFim: [
    c => c.horaFim && !c.hora ? 'O fim só vale com a hora do início.' : null,
    c => c.horaFim && c.horaFim <= c.hora ? 'O fim precisa ser depois do início.' : null
  ],
  processoId: [c => !doTipo(c).doProcesso || c.processoId ? null : `${doTipo(c).nome} precisa de um processo.`],
  modalidade: [c => !doTipo(c).doProcesso || c.modalidade ? null : 'Escolha a modalidade.'],
  local: [ateTamanho('local', 'O local')],
  responsavelId: [c => c.responsavelId ? null : 'Escolha o responsável.'],
  participantes: [
    c => repetido(c.participantes) ? 'A mesma pessoa aparece duas vezes nos participantes.' : null,
    c => escolhidos(c.participantes).length > COLABORADORES_MAXIMOS ? `Um compromisso pode ter até ${COLABORADORES_MAXIMOS} participantes.` : null
  ],
  pessoas: [
    c => repetido(c.pessoas) ? 'A mesma pessoa aparece duas vezes.' : null,
    c => escolhidos(c.pessoas).length > CLIENTES_MAXIMOS ? `Um compromisso pode ter até ${CLIENTES_MAXIMOS} pessoas ligadas.` : null
  ],
  resultado: [ateTamanho('resultado', 'O resultado')],
  observacoes: [ateTamanho('observacoes', 'As observações')]
};

/** Erros do cadastro, por campo. Vazio: pode salvar. */
export function validarCompromisso(c: CamposCompromisso): Partial<Record<keyof CamposCompromisso, string>> {
  const erros: Partial<Record<keyof CamposCompromisso, string>> = {};
  for (const [campo, regras] of Object.entries(CONFERENCIAS) as [keyof CamposCompromisso, Conferencia[]][]) {
    const erro = regras.map(r => r(c)).find(Boolean);
    if (erro) erros[campo] = erro;
  }
  return erros;
}

const textoOuNulo = (t: string) => t.trim() || null;
/** O que vai para o banco (só depois de validarCompromisso sem erros). O responsável não entra nos participantes, e o resultado só existe em quem é do processo. */
export function dadosDoCompromisso(c: CamposCompromisso): DadosCompromisso & Pick<Compromisso, 'tipo' | 'data' | 'responsavel_id'> {
  return {
    tipo: c.tipo, titulo: textoOuNulo(c.titulo), data: lerData(c.data)!, hora: c.hora || null, hora_fim: c.horaFim || null, modalidade: c.modalidade || null,
    local: textoOuNulo(c.local), resultado: doTipo(c).doProcesso ? textoOuNulo(c.resultado) : null, observacoes: textoOuNulo(c.observacoes), geral: c.geral,
    responsavel_id: c.responsavelId, participantes: [...new Set(escolhidos(c.participantes))].filter(id => id !== c.responsavelId),
    pessoas: [...new Set(escolhidos(c.pessoas))], processo_id: c.processoId || null
  };
}

/** A hora como aparece na tela e no formulário: hh:mm (o banco guarda também os segundos). */
export const fmtHora = (hora: string | null | undefined) => hora ? hora.slice(0, 5) : '';

/** Campos do formulário a partir de um compromisso salvo (para atualizar). */
export const camposDoCompromisso = (c: Compromisso): CamposCompromisso => ({
  tipo: c.tipo, titulo: c.titulo || '', data: fmtData(c.data), hora: fmtHora(c.hora), horaFim: fmtHora(c.hora_fim), modalidade: c.modalidade || '', local: c.local || '',
  processoId: c.processo_id || '', responsavelId: c.responsavel_id, participantes: [...c.participantes], pessoas: c.pessoas.length ? c.pessoas.map(p => p.id) : [''],
  geral: c.geral, resultado: c.resultado || '', observacoes: c.observacoes || ''
});

/**
 * Depois de gravar, a pessoa continua vendo o compromisso pelo processo ligado? O processo que já estava ligado só vem no
 * compromisso para quem pode abri-lo; o escolhido agora veio da lista de quem o vê.
 */
export const continuaPeloProcesso = (alvo: Pick<Compromisso, 'processo_id' | 'processo'>, processoDepois: string | null | undefined) =>
  !!processoDepois && (processoDepois !== alvo.processo_id || !!alvo.processo);

/**
 * Quem não é administrador, não criou o compromisso e não o vê de outro jeito só o vê enquanto participa, e o banco recusa a
 * gravação que o tiraria dele. Por isso, ao passá-lo adiante ou sair dos participantes, esta gravação ainda a mantém como participante. A saída vem depois, por SD.cartaoSair: assim o resto é gravado e ela sai de verdade (#276).
 */
export function semSairDoCompromisso<D extends DadosCompromisso>(d: D, eu: string, podeSair: boolean, antes: CartaoAntes, continuaPeloLigado = false): { dados: D; ficou: boolean } {
  const participantes = d.participantes ?? [];
  const r = pessoasAoGravar(participantes, d.responsavel_id, eu, antes, podeSair, continuaPeloLigado);
  return { dados: r.lista === participantes ? d : { ...d, participantes: r.lista }, ficou: r.ficou };
}

// ---------- etapas do cadastro ----------
export type EtapaCompromisso = 'compromisso' | 'onde' | 'pessoas' | 'detalhes';
export interface DefinicaoEtapaCompromisso { id: EtapaCompromisso; titulo: string; texto: string; campos: (keyof CamposCompromisso)[] }
/** As etapas do cadastro, na ordem, como nos cadastros de pessoa, de demanda e de processo. */
export const ETAPAS_COMPROMISSO: DefinicaoEtapaCompromisso[] = [
  { id: 'compromisso', titulo: 'O compromisso', texto: 'O tipo, a data e a hora, no horário de Brasília.', campos: ['tipo', 'titulo', 'data', 'hora', 'horaFim'] },
  { id: 'onde', titulo: 'Onde e de qual processo', texto: 'Audiência e perícia precisam de um processo e da modalidade.', campos: ['processoId', 'modalidade', 'local'] },
  { id: 'pessoas', titulo: 'Pessoas', texto: 'Quem da equipe vai, quem ajuda e, se houver, as pessoas do cadastro ligadas ao compromisso.', campos: ['pessoas', 'responsavelId', 'participantes', 'geral'] },
  { id: 'detalhes', titulo: 'Detalhes', texto: 'Nada aqui é obrigatório: dá para preencher depois.', campos: ['resultado', 'observacoes'] }
];
/** Erros só dos campos de uma etapa (o que impede de seguir para a próxima). */
export function errosDaEtapaCompromisso(etapa: EtapaCompromisso, c: CamposCompromisso): Partial<Record<keyof CamposCompromisso, string>> {
  const campos = ETAPAS_COMPROMISSO.find(e => e.id === etapa)!.campos, erros = validarCompromisso(c);
  return Object.fromEntries(Object.entries(erros).filter(([campo]) => campos.includes(campo as keyof CamposCompromisso)));
}
/** Posição da primeira etapa com erro (para voltar a ela ao salvar), ou -1 se pode salvar. */
export const primeiraEtapaComErroCompromisso = (c: CamposCompromisso) =>
  ETAPAS_COMPROMISSO.findIndex(e => Object.keys(errosDaEtapaCompromisso(e.id, c)).length > 0);

// ---------- cartão e histórico ----------
type ParaNomear = Pick<Compromisso, 'tipo' | 'titulo' | 'pessoa_nome' | 'processo_numero'>;
/** O nome do cartão: o título; sem ele, o tipo e as pessoas (ou o número do processo). */
export const nomeDoCompromisso = (c: ParaNomear) =>
  c.titulo || [TIPOS_COMPROMISSO[c.tipo].nome, (c.pessoa_nome && clientesPorExtenso(c.pessoa_nome)) || c.processo_numero].filter(Boolean).join(' · ');

/** O horário por extenso: "14:30", "14:30 às 16:00" ou "Dia inteiro". */
export const horarioDoCompromisso = (c: Pick<Compromisso, 'hora' | 'hora_fim'>) =>
  !c.hora ? 'Dia inteiro' : c.hora_fim ? `${fmtHora(c.hora)} às ${fmtHora(c.hora_fim)}` : fmtHora(c.hora);
/** A data e o horário juntos: "10/11/2026 · 14:30". */
export const quandoDoCompromisso = (c: Pick<Compromisso, 'data' | 'hora' | 'hora_fim'>) => `${fmtData(c.data)} · ${horarioDoCompromisso(c)}`;

/** Nome de cada campo no histórico de alterações. */
export const CAMPOS_COMPROMISSO: Record<string, string> = {
  tipo: 'Tipo', titulo: 'Título', data: 'Data', hora: 'Hora', hora_fim: 'Fim', modalidade: 'Modalidade', local: 'Local', resultado: 'Resultado', observacoes: 'Observações', geral: 'Agenda geral',
  responsavel_id: 'Responsável', participantes: 'Participantes', pessoas: 'Pessoas', processo: 'Processo', etapa: 'Situação', arquivado_em: 'Arquivamento'
};
const naLista = (lista: Record<string, string>) => (v: unknown) => lista[String(v)] ?? String(v);
const FORMATOS: Record<string, (v: unknown) => string> = {
  tipo: v => TIPOS_COMPROMISSO[v as TipoCompromisso]?.nome ?? String(v), modalidade: naLista(MODALIDADES), data: v => fmtData(String(v)),
  // O arquivamento é um instante, não uma data: o dia é o de Brasília, não o de Greenwich.
  arquivado_em: v => new Date(String(v)).toLocaleDateString('pt-BR', { timeZone: FUSO_DA_AGENDA }),
  hora: v => fmtHora(String(v)), hora_fim: v => fmtHora(String(v)), geral: v => v ? 'Sim' : 'Não'
};
/** Como cada campo aparece no histórico (o que não está aqui aparece como foi guardado). */
export const valorLegivelCompromisso = (campo: string, v: unknown) =>
  v === null || v === undefined || v === '' ? '—' : (FORMATOS[campo] ?? String)(v);

/** Os dados do cartão, só os preenchidos. */
export const linhasDoCompromisso = (c: Compromisso): [string, string][] => ([
  ['Data', fmtData(c.data)], ['Horário', horarioDoCompromisso(c)], ['Tipo', TIPOS_COMPROMISSO[c.tipo].nome],
  ['Modalidade', c.modalidade ? MODALIDADES[c.modalidade] : ''], ['Local', c.local ?? ''], ['Observações', c.observacoes ?? ''], ['Agenda geral', c.geral ? 'Todos do escritório veem' : '']
] as [string, string][]).filter(([, valor]) => valor);

// ---------- pessoas do compromisso ----------
export const PAPEIS_NO_COMPROMISSO: Record<PapelNoCompromisso, string> = { pessoa: 'Ligada', responsavel: 'Responsável', participante: 'Participante' };
interface PessoasDoCompromisso { pessoas: string[]; responsavel_id: string; participantes: string[] }
const CONFERE_PAPEL: Record<PapelNoCompromisso, (c: PessoasDoCompromisso, pessoaId: string, perfilId: string | null) => boolean> = {
  pessoa: (c, p) => c.pessoas.includes(p),
  responsavel: (c, _p, perfil) => !!perfil && c.responsavel_id === perfil,
  participante: (c, _p, perfil) => !!perfil && c.participantes.includes(perfil)
};
/** Os papéis da pessoa no compromisso, na ordem de PAPEIS_NO_COMPROMISSO (vazio: ela não está nele). */
export const papeisNoCompromisso = (c: PessoasDoCompromisso, pessoaId: string, perfilId: string | null = null) =>
  (Object.keys(CONFERE_PAPEL) as PapelNoCompromisso[]).filter(papel => CONFERE_PAPEL[papel](c, pessoaId, perfilId));

/** O que aparece embaixo do nome, no quadrinho de outro cartão: a data, o papel e a situação. */
export const detalheDoLigado = (c: Pick<CompromissoLigado, 'data' | 'hora' | 'hora_fim' | 'papeis'>, situacao: string) =>
  [quandoDoCompromisso(c), c.papeis.map(p => PAPEIS_NO_COMPROMISSO[p]).join(', '), situacao].filter(Boolean).join(' · ');

type QuemEstaNoCompromisso = Pick<Compromisso, 'criado_por' | 'responsavel_id' | 'participantes'>;
type QuemEstaNoProcesso = Pick<ProcessoDoCompromisso, 'criado_por' | 'responsavel_id' | 'colaboradores'>;
const ehAdministrador = (m: Pick<Membro, 'papel'>) => m.papel === 'master' || m.papel === 'admin';
/** Quem muda o compromisso (como a regra do banco): os administradores, quem criou, o responsável, os participantes e quem vê o processo ligado. */
export const participaDoCompromisso = (c: QuemEstaNoCompromisso, m: Membro, processo: QuemEstaNoProcesso | null = null) =>
  ehAdministrador(m) || m.id === c.criado_por || m.id === c.responsavel_id || c.participantes.includes(m.id)
  || (!!processo && (m.id === processo.criado_por || m.id === processo.responsavel_id || processo.colaboradores.includes(m.id)));
/** Na tela: quem pode mudar. Quem o vê pelo processo ligado recebe o processo junto; os outros recebem null. */
export const podeMudarCompromisso = (c: QuemEstaNoCompromisso & Pick<Compromisso, 'processo'>, eu: string, ehAdmin: boolean) =>
  ehAdmin || eu === c.criado_por || eu === c.responsavel_id || c.participantes.includes(eu)
  || (!!c.processo && (eu === c.processo.criado_por || eu === c.processo.responsavel_id || c.processo.colaboradores.includes(eu)));
/**
 * Na lista: o compromisso está aí só porque é da Agenda geral? A lista não sabe se a pessoa vê o processo ligado, então quem o
 * vê por ele muda as etiquetas pelo cartão, e o banco tem a palavra final.
 */
export const soLeNaLista = (c: QuemEstaNoCompromisso & Pick<Compromisso, 'geral'>, eu: string, ehAdmin: boolean) =>
  c.geral && !ehAdmin && eu !== c.criado_por && eu !== c.responsavel_id && !c.participantes.includes(eu);
/** Quem vê o compromisso: quem participa e, na Agenda geral, todos do escritório. */
export const veOCompromisso = (c: QuemEstaNoCompromisso & Pick<Compromisso, 'geral'>, m: Membro, processo: QuemEstaNoProcesso | null = null) =>
  c.geral || participaDoCompromisso(c, m, processo);
/** Por que o membro não pode ser mencionado no compromisso (null se pode): só quem o vê. */
export const motivoSemMencaoNoCompromisso = (c: QuemEstaNoCompromisso & Pick<Compromisso, 'geral'>, processo: QuemEstaNoProcesso | null = null) =>
  (m: Membro) => veOCompromisso(c, m, processo) ? null : 'não participa; inclua como participante';
/** A mensagem de quando alguém que não vê o compromisso aparece num comentário dele (a mesma do banco). */
export const mencaoNegadaNoCompromisso = (nome: string) => `Não é possível mencionar ${nome} neste compromisso: inclua essa pessoa como participante antes.`;
