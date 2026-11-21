// A equipe do contrato mudada no topo do cartão (#356), nas bolinhas: pôr um participante, tirá-lo, trocar o responsável e (#388)
// tornar responsável um participante que é advogado, sem abrir o lápis. Valem as regras do lápis do contrato: o participante é uma pessoa do cadastro (a de alguém da equipe), com o seu %
// da divisão; o indicador não pode ser também participante; a lista tem o máximo do banco; o responsável é um advogado da equipe,
// e trocá-lo não mexe nos participantes. Decisão do dono (18/11): quem entra pela bolinha fica com 0%, e o % de cada um continua
// sendo mudado no lápis. A mudança que deixaria quem grava fora do contrato é recusada, e a bolinha já aparece desligada, com o
// motivo (IMPEDIMENTO_NO_CONTRATO): o contrato não tem a saída em dois passos dos outros cartões (#276), que pergunta antes e
// sai, e o banco recusa a gravação com que a pessoa deixaria de vê-lo. A regra daqui é a de alterar (alteraOContrato), um pouco
// mais rígida que a de ver do banco: quem foi mencionado num comentário continuaria vendo, mas a tela não sabe das menções, e
// sem estar no contrato ninguém mais o altera. Por isso o motivo fala em deixar de poder alterá-lo, e não em deixar de vê-lo.
// A tela lê o contrato logo antes de gravar, para não apagar o que outra pessoa acabou de pôr; estas regras dizem o que gravar.
import { SEM_PERMISSAO } from '../dados/erros';
import { PARTICIPANTES_MAXIMOS } from '../dados/limites';
import type { Contrato, DadosContrato, ParticipanteGravado } from '../dados/tipos';
import { alteraOContrato, PARTICIPANTES_DEMAIS } from './contrato';
import type { PedidoNaEquipe, TipoDeMudanca } from './equipeNoCartao';

/** Decisão do dono (18/11): quem entra no contrato pela bolinha com "+" fica com 0% na divisão; o % se muda no lápis. */
export const PERCENTUAL_DE_QUEM_ENTRA = 0;

/** A equipe do contrato como está gravada: quem o criou, o responsável (usuário), o indicador e os participantes (pessoas, com o %). */
export interface EquipeDoContratoGravada {
  criado_por: string | null;
  responsavel_id: string;
  indicador_id: string | null;
  participantes: ParticipanteGravado[];
}
/** O que gravar, pela função de dados do lápis: os participantes (pôr e tirar) ou o responsável (trocar). */
export type EquipeDoContratoAGravar = Pick<DadosContrato, 'responsavel_id' | 'participantes'>;
/**
 * Uma mudança pedida na tela. Em pôr e tirar, o `id` é o da pessoa no cadastro (o contrato guarda o participante pela pessoa); na
 * troca do responsável e no tornar responsável, o do usuário.
 */
export type PedidoNoContrato = PedidoNaEquipe;
/**
 * A pessoa do cadastro de um usuário da equipe (o contrato guarda o responsável pelo usuário e o participante pela pessoa): serve
 * para o responsável de antes continuar como participante ao tornar outro responsável (#388). null: sem cadastro em Pessoas.
 */
export type PessoaDoUsuario = (perfilId: string) => string | null | undefined;
/** Sem saber a pessoa de ninguém (as mudanças que não precisam dela). */
const SEM_PESSOA: PessoaDoUsuario = () => null;
/** O que uma mudança dá: o que gravar, ou o aviso de por que nada é gravado (já estava assim: 'info'; não pode: 'erro'). */
export type MudancaNoContrato = { gravar: EquipeDoContratoAGravar } | { aviso: string; tipo: 'info' | 'erro' };
/**
 * Quem está mudando: o usuário, a pessoa dele no cadastro e o papel (administrador ou não). `financeiro`: o escritório dele tem o
 * módulo financeiro ligado, e aí a trava da divisão do banco também decide quem muda o contrato (FICARIA_FORA).
 */
export interface QuemMuda { id: string; pessoa_id?: string | null; papel: string; financeiro?: boolean }

/** A equipe gravada de um contrato lido do banco. */
export const equipeDoContrato = (k: Pick<Contrato, 'criado_por' | 'responsavel_id' | 'indicador_id' | 'participantes'>): EquipeDoContratoGravada => ({
  criado_por: k.criado_por, responsavel_id: k.responsavel_id, indicador_id: k.indicador_id,
  participantes: k.participantes.map(p => ({ pessoa_id: p.pessoa.id, percentual: p.percentual }))
});

const participa = (atual: EquipeDoContratoGravada, pessoaId: string) => atual.participantes.some(p => p.pessoa_id === pessoaId);

/** Cada mudança, sobre a equipe gravada agora (`atual`). Uma entrada por tipo: tipo novo = entrada nova. */
export const MUDANCAS_NO_CONTRATO: Record<TipoDeMudanca, (atual: EquipeDoContratoGravada, id: string, nome: string, pessoaDe?: PessoaDoUsuario) => MudancaNoContrato> = {
  // Põe no fim da lista, com 0%, sem repetir, sem o indicador e até o máximo do banco.
  por: (atual, id, nome) => {
    if (id === atual.indicador_id) return { aviso: `${nome} é o indicador deste contrato, e o indicador não pode ser também participante.`, tipo: 'erro' };
    if (participa(atual, id)) return { aviso: `${nome} já participa do contrato.`, tipo: 'info' };
    if (atual.participantes.length >= PARTICIPANTES_MAXIMOS) return { aviso: PARTICIPANTES_DEMAIS, tipo: 'erro' };
    return { gravar: { participantes: [...atual.participantes, { pessoa_id: id, percentual: PERCENTUAL_DE_QUEM_ENTRA }] } };
  },
  // Tira da lista (com o % dele); quem outra pessoa já tirou fica como está.
  tirar: (atual, id, nome) => participa(atual, id)
    ? { gravar: { participantes: atual.participantes.filter(p => p.pessoa_id !== id) } }
    : { aviso: `${nome} já não participava do contrato.`, tipo: 'info' },
  // Troca o responsável, como o lápis: os participantes e os % deles ficam como estão.
  responsavel: (atual, id, nome) => id === atual.responsavel_id
    ? { aviso: `${nome} já é o advogado responsável pelo contrato.`, tipo: 'info' }
    : { gravar: { responsavel_id: id } },
  // Decisão do dono (#388): o participante passa a responder (e continua participante, com o % dele), e o responsável de antes
  // continua no contrato como participante, com 0% (como quem entra pelo "+"), se tem cadastro em Pessoas, ainda não participa e
  // não é o indicador.
  tornarResponsavel: (atual, id, nome, pessoaDe = SEM_PESSOA) => {
    if (id === atual.responsavel_id) return { aviso: `${nome} já é o advogado responsável pelo contrato.`, tipo: 'info' };
    const antigo = pessoaDe(atual.responsavel_id);
    if (!antigo || participa(atual, antigo) || antigo === atual.indicador_id) return { gravar: { responsavel_id: id } };
    if (atual.participantes.length >= PARTICIPANTES_MAXIMOS) return { aviso: PARTICIPANTES_DEMAIS, tipo: 'erro' };
    return { gravar: { responsavel_id: id, participantes: [...atual.participantes, { pessoa_id: antigo, percentual: PERCENTUAL_DE_QUEM_ENTRA }] } };
  }
};

/** Com o módulo financeiro do escritório ligado ou desligado: a trava da divisão do banco só vale com ele ligado. */
export type SituacaoDoFinanceiro = 'semFinanceiro' | 'comFinanceiro';
/**
 * Por que a mudança é recusada quando deixaria quem grava fora do contrato (pôr alguém nunca deixa), e a quem pedir (#274).
 * - Sem o financeiro: quem está no contrato (quem o criou, o responsável, os participantes) e os administradores o alteram, e
 *   qualquer um deles tira a pessoa ou troca o responsável.
 * - Com o financeiro, vale também a trava da divisão (privado.trava_da_divisao): só o responsável de agora ou um administrador troca o
 *   responsável, e, se o contrato já tem parcelas, só um administrador muda os participantes ou o responsável. Quem participa não vê as
 *   parcelas (só o responsável e os administradores as veem), então o texto diz os dois casos.
 */
export const FICARIA_FORA: Record<SituacaoDoFinanceiro, Record<TipoDeMudanca, string>> = {
  semFinanceiro: {
    por: 'Sem estar no contrato, você deixaria de poder alterá-lo.',
    tirar: 'Você não pode sair deste contrato sozinho: sem estar nele, deixaria de poder alterá-lo. Peça a outra pessoa do contrato ou a um administrador para tirar você.',
    responsavel: 'Você não pode passar este contrato a outro advogado: sem estar nele, deixaria de poder alterá-lo. Ponha-se antes como participante, ou peça a outra pessoa do contrato ou a um administrador.',
    tornarResponsavel: 'Você não pode passar este contrato a outro advogado: sem cadastro em Pessoas, você não continuaria nele como participante e deixaria de poder alterá-lo. Peça a outra pessoa do contrato ou a um administrador.'
  },
  comFinanceiro: {
    por: 'Sem estar no contrato, você deixaria de poder alterá-lo.',
    tirar: 'Você não pode sair deste contrato sozinho: sem estar nele, deixaria de poder alterá-lo. Peça a outra pessoa do contrato ou a um administrador para tirar você. Se o contrato já tem parcelas, só um administrador pode tirar você.',
    responsavel: 'Você não pode passar este contrato a outro advogado: sem estar nele, deixaria de poder alterá-lo. Ponha-se antes como participante, ou peça a um administrador. Se o contrato já tem parcelas, só um administrador o passa adiante.',
    tornarResponsavel: 'Você não pode passar este contrato a outro advogado: sem cadastro em Pessoas, você não continuaria nele como participante e deixaria de poder alterá-lo. Peça a um administrador.'
  }
};
/** O motivo de ficar fora para quem muda, pela situação do financeiro do escritório dele. */
export const motivoDeFicarFora = (tipo: TipoDeMudanca, eu: Pick<QuemMuda, 'financeiro'>) =>
  FICARIA_FORA[eu.financeiro ? 'comFinanceiro' : 'semFinanceiro'][tipo];

/** A equipe do contrato só com as pessoas (os participantes sem o %), como alteraOContrato a lê. */
const quemEsta = (k: Pick<EquipeDoContratoGravada, 'criado_por' | 'responsavel_id' | 'participantes'>) =>
  ({ criado_por: k.criado_por, responsavel_id: k.responsavel_id, participantes: k.participantes.map(p => p.pessoa_id) });

/**
 * Qual motivo o lápis mostra a quem ficaria fora do contrato, na ordem: vale o primeiro caso que casa (o último casa sempre).
 * - Quem participava e se tirou: o de sair.
 * - Quem não tem cadastro em Pessoas (só podia estar como responsável): o de quem não continuaria como participante, porque ele não
 *   consegue se pôr como participante (o participante é uma pessoa do cadastro).
 * - Quem só era o responsável e passou o contrato adiante: o de passar, que manda pôr-se antes como participante.
 */
const MOTIVO_NO_LAPIS: { tipo: TipoDeMudanca; casa: (antes: EquipeDoContratoGravada, eu: QuemMuda) => boolean }[] = [
  { tipo: 'tirar', casa: (antes, eu) => !!eu.pessoa_id && participa(antes, eu.pessoa_id) },
  { tipo: 'tornarResponsavel', casa: (_antes, eu) => !eu.pessoa_id },
  { tipo: 'responsavel', casa: () => true }
];

/**
 * O lápis do contrato (#274): por que a gravação foi recusada, quando ela deixaria quem grava fora do contrato (o mesmo motivo da
 * bolinha, pela situação do financeiro). O banco recusa com a falta de permissão de sempre, e a pessoa não saberia o que fazer;
 * MOTIVO_NO_LAPIS escolhe o motivo. undefined: a gravação não deixaria a pessoa fora (ou ela nem estava no contrato), e vale o erro
 * do banco.
 */
export function ficariaForaNoLapis(antes: EquipeDoContratoGravada, gravar: EquipeDoContratoAGravar, eu: QuemMuda): string | undefined {
  const depois = { ...antes, responsavel_id: gravar.responsavel_id ?? antes.responsavel_id, participantes: gravar.participantes ?? antes.participantes };
  if (!alteraOContrato(quemEsta(antes), eu) || alteraOContrato(quemEsta(depois), eu)) return undefined;
  const { tipo } = MOTIVO_NO_LAPIS.find(m => m.casa(antes, eu))!;
  return motivoDeFicarFora(tipo, eu);
}

/**
 * O erro que a tela mostra quando o banco recusa a gravação do lápis: a falta de permissão de quem ficaria fora do contrato vira o
 * motivo claro (ficariaForaNoLapis); qualquer outro erro passa como veio.
 */
export function recusaNoLapis(erro: unknown, antes: EquipeDoContratoGravada, gravar: EquipeDoContratoAGravar, eu: QuemMuda): unknown {
  const motivo = erro instanceof Error && erro.message === SEM_PERMISSAO ? ficariaForaNoLapis(antes, gravar, eu) : undefined;
  return motivo ? Object.assign(new Error(motivo), { original: erro }) : erro;
}

/**
 * O plano da mudança sobre a equipe gravada agora: o que gravar, ou o aviso de por que nada se grava. Como no lápis, quem deixaria
 * de estar no contrato com a gravação (não é administrador, não o cadastrou e sai da equipe dele) não grava.
 */
export function planoNoContrato(pedido: PedidoNoContrato, atual: EquipeDoContratoGravada, eu: QuemMuda, pessoaDe: PessoaDoUsuario = SEM_PESSOA): MudancaNoContrato {
  const r = MUDANCAS_NO_CONTRATO[pedido.tipo](atual, pedido.id, pedido.nome, pessoaDe);
  if ('aviso' in r) return r;
  const depois = {
    criado_por: atual.criado_por, responsavel_id: r.gravar.responsavel_id ?? atual.responsavel_id,
    participantes: (r.gravar.participantes ?? atual.participantes).map(p => p.pessoa_id)
  };
  return alteraOContrato(depois, eu) ? r : { aviso: motivoDeFicarFora(pedido.tipo, eu), tipo: 'erro' };
}

/**
 * Um advogado qualquer que não é quem muda, para saber, antes de abrir a busca, se passar o contrato adiante deixaria quem muda
 * de fora (nenhum usuário tem o id vazio, e a busca do responsável nunca oferece o de agora).
 */
const OUTRO_ADVOGADO = '';

/**
 * Antes do clique, pelo mesmo cálculo de planoNoContrato sobre o contrato carregado: por que a bolinha não faz a mudança (ela
 * deixaria quem muda fora do contrato). Assim a bolinha aparece desligada, com o motivo na dica, e não oferece uma ação que
 * seria recusada. undefined: a bolinha faz a mudança.
 * - Tirar: a pessoa tirada (`pessoaId`, a do cadastro) é quem muda, e ela não ficaria no contrato por outro caminho.
 * - Responsável: quem muda só está no contrato por ser o responsável.
 * - Tornar responsável (o usuário `perfilId`): quem muda é o responsável de agora e não continuaria como participante (sem cadastro).
 */
export const IMPEDIMENTO_NO_CONTRATO = {
  tirar: (atual: EquipeDoContratoGravada, pessoaId: string, eu: QuemMuda) => impedimento({ tipo: 'tirar', id: pessoaId, nome: '' }, atual, eu),
  responsavel: (atual: EquipeDoContratoGravada, eu: QuemMuda) => impedimento({ tipo: 'responsavel', id: OUTRO_ADVOGADO, nome: '' }, atual, eu),
  tornarResponsavel: (atual: EquipeDoContratoGravada, perfilId: string, eu: QuemMuda, pessoaDe: PessoaDoUsuario) =>
    impedimento({ tipo: 'tornarResponsavel', id: perfilId, nome: '' }, atual, eu, pessoaDe)
};
function impedimento(pedido: PedidoNoContrato, atual: EquipeDoContratoGravada, eu: QuemMuda, pessoaDe: PessoaDoUsuario = SEM_PESSOA) {
  const r = planoNoContrato(pedido, atual, eu, pessoaDe);
  return 'aviso' in r && r.aviso === motivoDeFicarFora(pedido.tipo, eu) ? r.aviso : undefined;
}

/** O aviso de cada mudança gravada. */
export const AVISO_NO_CONTRATO: Record<TipoDeMudanca, (nome: string) => string> = {
  por: nome => `${nome} agora participa do contrato, com ${PERCENTUAL_DE_QUEM_ENTRA}% na divisão. O % se muda em Editar.`,
  tirar: nome => `${nome} saiu do contrato.`,
  responsavel: nome => `Advogado responsável pelo contrato: ${nome}.`,
  tornarResponsavel: nome => `Advogado responsável pelo contrato: ${nome}. Quem respondia antes continua no contrato como participante.`
};

/**
 * O "Tirar" do menu da bolinha de um participante (#388; o nome e o % dele já estão no alto do menu, no papel): "Tirar do
 * contrato", ou "Sair do contrato", na própria.
 */
export const tirarDoContrato = (p: { id: string }, eu: string) => p.id === eu ? 'Sair do contrato' : 'Tirar do contrato';

/**
 * O que o Desfazer grava, com o contrato lido de novo (`atual`): volta só o que esta mudança fez, e o que outra pessoa mudou depois
 * fica como ela deixou. null quando não há o que voltar (quem entrou já saiu; o responsável já foi trocado de novo).
 * - Pôr: tira quem entrou, se ainda está na lista.
 * - Tirar: põe de volta no lugar de antes e com o % de antes, se ainda não voltou (indicador ou lista cheia: `aviso`).
 * - Trocar o responsável: o de antes volta, se o novo ainda é o responsável.
 * - Tornar responsável: o de antes volta a responder, se o novo ainda é o responsável, e sai dos participantes se entrou neles por
 *   esta mudança (quem já participava antes fica, com o % dele).
 */
export function desfazerNoContrato(pedido: PedidoNoContrato, antes: EquipeDoContratoGravada, atual: EquipeDoContratoGravada,
  pessoaDe: PessoaDoUsuario = SEM_PESSOA): EquipeDoContratoAGravar | { aviso: string } | null {
  const DESFAZER: Record<TipoDeMudanca, () => EquipeDoContratoAGravar | { aviso: string } | null> = {
    por: () => participa(atual, pedido.id) ? { participantes: atual.participantes.filter(p => p.pessoa_id !== pedido.id) } : null,
    tirar: () => {
      const lugar = antes.participantes.findIndex(p => p.pessoa_id === pedido.id);
      const r = MUDANCAS_NO_CONTRATO.por(atual, pedido.id, pedido.nome);
      if ('aviso' in r) return r.tipo === 'erro' ? { aviso: r.aviso } : null;
      return { participantes: atual.participantes.toSpliced(Math.min(lugar, atual.participantes.length), 0, antes.participantes[lugar]) };
    },
    responsavel: () => atual.responsavel_id === pedido.id ? { responsavel_id: antes.responsavel_id } : null,
    tornarResponsavel: () => {
      if (atual.responsavel_id !== pedido.id) return null;
      const antigo = pessoaDe(antes.responsavel_id);
      const entrou = !!antigo && !participa(antes, antigo) && participa(atual, antigo);
      return entrou ? { responsavel_id: antes.responsavel_id, participantes: atual.participantes.filter(p => p.pessoa_id !== antigo) } : { responsavel_id: antes.responsavel_id };
    }
  };
  return DESFAZER[pedido.tipo]();
}
