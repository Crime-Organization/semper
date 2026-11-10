// Regras da demanda (módulo Demandas): o cadastro por etapas, os papéis de cada pessoa, o prazo e quem pode ser
// mencionado nos comentários. Tudo puro, sem tela nem banco.
import type { DadosDemanda, Demanda, Lembrete, Membro, PapelNaDemanda } from '../dados/tipos';
import { pessoasAoGravar, type CartaoAntes } from './sairDoCartao';
import { CLIENTES_MAXIMOS, COLABORADORES_MAXIMOS, TAMANHO_DEMANDA } from '../dados/limites';
import { fmtData, lerData } from './pessoa';
import { CONFERENCIAS_DO_LEMBRETE, horaELembreteAoGravar, horaELembreteDoCartao, lerLembrete, prazoComHora, textoDoLembrete } from './lembrete';
import { fmtHora } from './compromisso';

/** Rótulo das demandas fora das colunas do quadro. */
export const SEM_SITUACAO_DEMANDA = 'Sem situação';

// ---------- formulário ----------
/** Campos do formulário de demanda, como digitados. */
export interface CamposDemanda {
  titulo: string;
  descricao: string;
  /** dd/mm/aaaa, ou vazio. */
  prazo: string;
  /** hh:mm, ou vazio (só vale com o prazo). */
  hora: string;
  /** Minutos antes do prazo, ou null sem lembrete (só vale com o prazo). */
  lembrete: Lembrete | null;
  responsavelId: string;
  colaboradores: string[];
  /** Um por linha (o id da pessoa escolhida; linha vazia ainda sem pessoa). */
  clientes: string[];
  contratoId: string;
}
export const DEMANDA_VAZIA: CamposDemanda = { titulo: '', descricao: '', prazo: '', hora: '', lembrete: null, responsavelId: '', colaboradores: [], clientes: [''], contratoId: '' };

/** Confere um campo: devolve a mensagem de erro ou null. */
type Conferencia = (c: CamposDemanda) => string | null;
const escolhidos = (lista: string[]) => lista.filter(Boolean);
const repetido = (lista: string[]) => new Set(escolhidos(lista)).size < escolhidos(lista).length;

/** Regras do cadastro, uma lista por campo (a primeira que falhar dá a mensagem). Campo novo = entrada nova aqui. */
const CONFERENCIAS: Partial<Record<keyof CamposDemanda, Conferencia[]>> = {
  titulo: [
    c => c.titulo.trim() ? null : 'Dê um título à demanda.',
    c => c.titulo.trim().length > TAMANHO_DEMANDA.titulo ? `O título pode ter até ${TAMANHO_DEMANDA.titulo} caracteres.` : null
  ],
  descricao: [c => c.descricao.length > TAMANHO_DEMANDA.descricao ? `A descrição pode ter até ${TAMANHO_DEMANDA.descricao} caracteres.` : null],
  prazo: [c => { try { lerData(c.prazo); return null; } catch (e) { return (e as Error).message; } }],
  ...CONFERENCIAS_DO_LEMBRETE,
  responsavelId: [c => c.responsavelId ? null : 'Escolha o responsável.'],
  colaboradores: [
    c => repetido(c.colaboradores) ? 'A mesma pessoa aparece duas vezes nos colaboradores.' : null,
    c => escolhidos(c.colaboradores).length > COLABORADORES_MAXIMOS ? `Uma demanda pode ter até ${COLABORADORES_MAXIMOS} colaboradores.` : null
  ],
  clientes: [
    c => repetido(c.clientes) ? 'O mesmo cliente aparece duas vezes.' : null,
    c => escolhidos(c.clientes).length > CLIENTES_MAXIMOS ? `Uma demanda pode ter até ${CLIENTES_MAXIMOS} clientes.` : null
  ]
};

/** Erros do cadastro, por campo. Vazio: pode salvar. */
export function validarDemanda(c: CamposDemanda): Partial<Record<keyof CamposDemanda, string>> {
  const erros: Partial<Record<keyof CamposDemanda, string>> = {};
  for (const [campo, regras] of Object.entries(CONFERENCIAS) as [keyof CamposDemanda, Conferencia[]][]) {
    const erro = regras.map(r => r(c)).find(Boolean);
    if (erro) erros[campo] = erro;
  }
  return erros;
}

/** O que vai para o banco (só depois de validarDemanda sem erros). O responsável não entra nos colaboradores. */
export function dadosDaDemanda(c: CamposDemanda): DadosDemanda {
  const prazo = lerData(c.prazo);
  return {
    titulo: c.titulo.trim(), descricao: c.descricao.trim() || null, prazo, ...horaELembreteAoGravar(prazo, c), responsavel_id: c.responsavelId,
    colaboradores: [...new Set(escolhidos(c.colaboradores))].filter(id => id !== c.responsavelId),
    clientes: [...new Set(escolhidos(c.clientes))], contrato_id: c.contratoId || null
  };
}

/**
 * Quem não é administrador nem criou a demanda só a vê enquanto participa, e o banco recusa a gravação que o tiraria
 * dela. Por isso, ao passar a demanda adiante ou sair dos colaboradores, esta gravação ainda a mantém como colaboradora. A saída vem depois, por SD.cartaoSair: assim o resto é gravado e ela sai de verdade (#276).
 */
export function semSairDaDemanda(d: DadosDemanda, eu: string, podeSair: boolean, antes: CartaoAntes): { dados: DadosDemanda; ficou: boolean } {
  const colaboradores = d.colaboradores ?? [];
  const r = pessoasAoGravar(colaboradores, d.responsavel_id, eu, antes, podeSair);
  return { dados: r.lista === colaboradores ? d : { ...d, colaboradores: r.lista }, ficou: r.ficou };
}

/** Campos do formulário a partir de uma demanda salva (para atualizar). */
export const camposDaDemanda = (d: Demanda): CamposDemanda => ({
  titulo: d.titulo, descricao: d.descricao || '', prazo: fmtData(d.prazo), ...horaELembreteDoCartao(d), responsavelId: d.responsavel_id,
  colaboradores: [...d.colaboradores], clientes: d.clientes.length ? d.clientes.map(p => p.id) : [''], contratoId: d.contrato_id || ''
});

// ---------- etapas do cadastro ----------
export type EtapaDemanda = 'demanda' | 'pessoas' | 'contrato';
export interface DefinicaoEtapaDemanda { id: EtapaDemanda; titulo: string; texto: string; campos: (keyof CamposDemanda)[] }
/** As etapas do cadastro de demanda, na ordem, como nos cadastros de pessoa e de contrato. */
export const ETAPAS_DEMANDA: DefinicaoEtapaDemanda[] = [
  { id: 'demanda', titulo: 'A demanda', texto: 'O que precisa ser feito e, se houver, o prazo de entrega, com a hora e um lembrete.', campos: ['titulo', 'descricao', 'prazo', 'hora', 'lembrete'] },
  { id: 'pessoas', titulo: 'Pessoas', texto: 'Quem responde pela demanda, quem da equipe ajuda e para quais clientes.',
    campos: ['responsavelId', 'colaboradores', 'clientes'] },
  { id: 'contrato', titulo: 'Contrato', texto: 'Se a demanda vem de um contrato, ligue-o aqui. Não é obrigatório.', campos: ['contratoId'] }
];
/** Erros só dos campos de uma etapa (o que impede de seguir para a próxima). */
export function errosDaEtapaDemanda(etapa: EtapaDemanda, c: CamposDemanda): Partial<Record<keyof CamposDemanda, string>> {
  const campos = ETAPAS_DEMANDA.find(e => e.id === etapa)!.campos, erros = validarDemanda(c);
  return Object.fromEntries(Object.entries(erros).filter(([campo]) => campos.includes(campo as keyof CamposDemanda)));
}
/** Posição da primeira etapa com erro (para voltar a ela ao salvar), ou -1 se pode salvar. */
export const primeiraEtapaComErroDemanda = (c: CamposDemanda) =>
  ETAPAS_DEMANDA.findIndex(e => Object.keys(errosDaEtapaDemanda(e.id, c)).length > 0);

// ---------- cartão e histórico ----------
/** Nome de cada campo no histórico de alterações da demanda. */
export const CAMPOS_DEMANDA: Record<string, string> = {
  titulo: 'Título', descricao: 'Descrição', prazo: 'Prazo', prazo_hora: 'Hora do prazo', lembrete: 'Lembrete', responsavel_id: 'Responsável', colaboradores: 'Colaboradores',
  clientes: 'Clientes', contrato: 'Contrato', etapa: 'Situação', arquivado_em: 'Arquivamento'
};
/** O histórico guarda a hora como o banco (hh:mm:ss) e o lembrete em minutos: aqui eles ganham o formato da tela. */
const FORMATOS: Record<string, (v: unknown) => string> = {
  prazo: v => fmtData(String(v)),
  prazo_hora: v => fmtHora(String(v)),
  lembrete: v => textoDoLembrete(lerLembrete(String(v)))
};
/** Como cada campo aparece no cartão e no histórico (o que não está aqui aparece como foi guardado). */
export const valorLegivelDemanda = (campo: string, v: unknown) =>
  v === null || v === undefined || v === '' ? '—' : (FORMATOS[campo] ?? String)(v);

/** Situação do prazo em relação a hoje (aaaa-mm-dd): vencido, vence hoje, em dia, ou null sem prazo. */
export type SituacaoPrazo = 'vencido' | 'hoje' | 'em_dia';
export function situacaoDoPrazo(prazo: string | null, hoje: string): SituacaoPrazo | null {
  if (!prazo) return null;
  return prazo < hoje ? 'vencido' : prazo === hoje ? 'hoje' : 'em_dia';
}
export const ROTULOS_PRAZO: Record<SituacaoPrazo, string> = { vencido: 'Prazo vencido', hoje: 'Vence hoje', em_dia: 'Prazo' };
/** O prazo como aparece no selo e nas listas: "Prazo: 15/11/2030 às 14:00" (null sem prazo). */
export const rotuloDoPrazoComHora = (prazo: string | null, hora: string | null | undefined, hoje: string) => {
  const s = situacaoDoPrazo(prazo, hoje);
  return s ? `${ROTULOS_PRAZO[s]}: ${prazoComHora(prazo, hora)}` : null;
};

// ---------- pessoas da demanda ----------
export const PAPEIS_NA_DEMANDA: Record<PapelNaDemanda, string> = { cliente: 'Cliente', responsavel: 'Responsável', colaborador: 'Colaborador' };
interface PessoasDaDemanda { clientes: string[]; responsavel_id: string; colaboradores: string[] }
/** O que confere cada papel: a pessoa (ou o usuário dela, no responsável e nos colaboradores) no campo certo. */
const CONFERE_PAPEL: Record<PapelNaDemanda, (d: PessoasDaDemanda, pessoaId: string, perfilId: string | null) => boolean> = {
  cliente: (d, p) => d.clientes.includes(p),
  responsavel: (d, _p, perfil) => !!perfil && d.responsavel_id === perfil,
  colaborador: (d, _p, perfil) => !!perfil && d.colaboradores.includes(perfil)
};
/** Os papéis da pessoa na demanda, na ordem de PAPEIS_NA_DEMANDA (vazio: ela não está nela). */
export const papeisNaDemanda = (d: PessoasDaDemanda, pessoaId: string, perfilId: string | null = null) =>
  (Object.keys(CONFERE_PAPEL) as PapelNaDemanda[]).filter(papel => CONFERE_PAPEL[papel](d, pessoaId, perfilId));

/** Quem vê a demanda: os administradores, quem criou, o responsável e os colaboradores (como a regra do banco). */
export const veADemanda = (d: Pick<Demanda, 'criado_por' | 'responsavel_id' | 'colaboradores'>, m: Membro) =>
  m.papel === 'master' || m.papel === 'admin' || m.id === d.criado_por || m.id === d.responsavel_id || d.colaboradores.includes(m.id);
/** Por que o membro não pode ser mencionado na demanda (null se pode): só quem vê a demanda. */
export const motivoSemMencaoNaDemanda = (d: Pick<Demanda, 'criado_por' | 'responsavel_id' | 'colaboradores'>) =>
  (m: Membro) => veADemanda(d, m) ? null : 'não participa; inclua como colaborador';
/** A mensagem de quando alguém que não vê a demanda aparece num comentário dela (a mesma do banco). */
export const mencaoNegadaNaDemanda = (nome: string) => `Não é possível mencionar ${nome} nesta demanda: inclua essa pessoa como colaboradora antes.`;
