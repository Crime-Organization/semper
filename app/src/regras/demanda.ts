// Regras da demanda (módulo Demandas): o cadastro por etapas, os papéis de cada pessoa, o prazo e quem pode ser
// mencionado nos comentários. Tudo puro, sem tela nem banco.
import type { DadosDemanda, Demanda, EquipeDoContrato, Lembrete, Membro, PapelNaDemanda } from '../dados/tipos';
import { contratosEmQueEsta } from './contrato';
import { pessoasAoGravar, type CartaoAntes } from './sairDoCartao';
import { CLIENTES_MAXIMOS, COLABORADORES_MAXIMOS, TAMANHO_DEMANDA } from '../dados/limites';
import { fmtData, lerData } from './pessoa';
import { CONFERENCIAS_DO_LEMBRETE, horaELembreteAoGravar, horaELembreteDoCartao, lerLembrete, prazoComHora, textoDoLembrete } from './lembrete';
import { fmtHora } from './compromisso';
import { erroDaDataDeInicio, inicioAoGravar, ROTULO_DO_INICIO } from './dataDeInicio';
import { estaPeloGrupo } from './gruposDaEquipe';

/** Rótulo das demandas fora das colunas do quadro. */
export const SEM_SITUACAO_DEMANDA = 'Sem situação';
/**
 * A demanda sem contrato fica sinalizada no quadro e na tabela de Demandas (#311), com este selo e a opção do filtro. Só com o módulo
 * Contratos ligado no escritório: sem ele (um núcleo de inovação, por exemplo), nenhuma demanda teria contrato, e o selo não diz nada.
 */
export const SEM_CONTRATO = 'Sem contrato';
export const semContrato = (d: { contrato_codigo: string | null }, comContratos: boolean) => comContratos && !d.contrato_codigo;

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
  /** A data de início, dd/mm/aaaa (#357). null no cadastro novo: a demanda começa no dia em que é criada (o padrão do banco). */
  inicio: string | null;
  responsavelId: string;
  colaboradores: string[];
  /** Um por linha (o id da pessoa escolhida; linha vazia ainda sem pessoa). */
  clientes: string[];
  contratoId: string;
}
export const DEMANDA_VAZIA: CamposDemanda = { titulo: '', descricao: '', prazo: '', hora: '', lembrete: null, inicio: null, responsavelId: '', colaboradores: [], clientes: [''], contratoId: '' };

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
  inicio: [c => c.inicio === null ? null : erroDaDataDeInicio(c.inicio) || null],
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
    titulo: c.titulo.trim(), descricao: c.descricao.trim() || null, prazo, ...horaELembreteAoGravar(prazo, c), ...inicioAoGravar(c), responsavel_id: c.responsavelId,
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
  titulo: d.titulo, descricao: d.descricao || '', prazo: fmtData(d.prazo), ...horaELembreteDoCartao(d), inicio: fmtData(d.data_inicio), responsavelId: d.responsavel_id,
  colaboradores: [...d.colaboradores], clientes: d.clientes.length ? d.clientes.map(p => p.id) : [''], contratoId: d.contrato_id || ''
});

// ---------- etapas do cadastro ----------
export type EtapaDemanda = 'demanda' | 'pessoas' | 'contrato';
export interface DefinicaoEtapaDemanda { id: EtapaDemanda; titulo: string; texto: string; campos: (keyof CamposDemanda)[] }
/** As etapas do cadastro de demanda, na ordem, como nos cadastros de pessoa e de contrato. */
export const ETAPAS_DEMANDA: DefinicaoEtapaDemanda[] = [
  { id: 'demanda', titulo: 'A demanda', texto: 'O que precisa ser feito e, se houver, o prazo de entrega, com a hora e um lembrete.', campos: ['titulo', 'descricao', 'prazo', 'hora', 'lembrete', 'inicio'] },
  { id: 'pessoas', titulo: 'Pessoas', texto: 'Quem responde pela demanda, quem da equipe ajuda e para quais clientes.',
    campos: ['responsavelId', 'colaboradores', 'clientes'] },
  { id: 'contrato', titulo: 'Contrato e processos', texto: 'Se a demanda vem de um contrato ou trabalha num processo que já existe, ligue aqui. Não é obrigatório.', campos: ['contratoId'] }
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
  titulo: 'Título', descricao: 'Descrição', prazo: 'Prazo', prazo_hora: 'Hora do prazo', lembrete: 'Lembrete', data_inicio: ROTULO_DO_INICIO, responsavel_id: 'Responsável', colaboradores: 'Colaboradores',
  clientes: 'Clientes', contrato: 'Contrato', etapa: 'Situação', arquivado_em: 'Arquivamento'
};
/** O histórico guarda a hora como o banco (hh:mm:ss) e o lembrete em minutos: aqui eles ganham o formato da tela. */
const FORMATOS: Record<string, (v: unknown) => string> = {
  prazo: v => fmtData(String(v)),
  data_inicio: v => fmtData(String(v)),
  prazo_hora: v => fmtHora(String(v)),
  lembrete: v => textoDoLembrete(lerLembrete(String(v)))
};
/** Como cada campo aparece no cartão e no histórico (o que não está aqui aparece como foi guardado). */
export const valorLegivelDemanda = (campo: string, v: unknown) =>
  v === null || v === undefined || v === '' ? '—' : (FORMATOS[campo] ?? String)(v);

/** Situação do prazo em relação a hoje (aaaa-mm-dd): vencido, vence hoje, em dia, ou null sem prazo. O cartão concluído
 *  (na coluna-marco "concluido") não vence mais: fica "concluido", qualquer que seja a data. */
export type SituacaoPrazo = 'vencido' | 'hoje' | 'em_dia' | 'concluido';
export function situacaoDoPrazo(prazo: string | null, hoje: string, concluido = false): SituacaoPrazo | null {
  if (!prazo) return null;
  if (concluido) return 'concluido';
  return prazo < hoje ? 'vencido' : prazo === hoje ? 'hoje' : 'em_dia';
}
/** O nome de cada situação ao lado da data. O concluído mostra só "Prazo": quem diz que terminou é o selo ou a coluna. */
export const ROTULOS_PRAZO: Record<SituacaoPrazo, string> = { vencido: 'Prazo vencido', hoje: 'Vence hoje', em_dia: 'Prazo', concluido: 'Prazo' };
/** Cor do selo do prazo: vencido em vermelho, vence hoje em laranja, em dia neutro, concluído em verde. */
export const SELO_DO_PRAZO: Record<SituacaoPrazo, 'ok' | 'erro' | 'pend' | 'arq'> = { vencido: 'erro', hoje: 'pend', em_dia: 'arq', concluido: 'ok' };
/** Como o selo diz que o cartão terminou, em cada módulo. */
export const CONCLUIDO_NO_SELO = { tarefas: 'Concluída', demandas: 'Concluído' } as const;
export type ModuloComPrazo = keyof typeof CONCLUIDO_NO_SELO;

/** O prazo como aparece nas listas: "Prazo: 15/11/2030 às 14:00" (null sem prazo). Concluído, nunca diz "vencido". */
export const rotuloDoPrazoComHora = (prazo: string | null, hora: string | null | undefined, hoje: string, concluido = false) => {
  const s = situacaoDoPrazo(prazo, hoje, concluido);
  return s ? `${ROTULOS_PRAZO[s]}: ${prazoComHora(prazo, hora)}` : null;
};
/** O selo do prazo, cor e texto: concluído, "Concluída · Prazo: 05/11/2026" em verde (null sem prazo). */
export function seloDoPrazo(prazo: string | null, hora: string | null | undefined, hoje: string, concluido: false | ModuloComPrazo = false) {
  const s = situacaoDoPrazo(prazo, hoje, !!concluido), texto = rotuloDoPrazoComHora(prazo, hora, hoje, !!concluido);
  if (!s || !texto) return null;
  return { tipo: SELO_DO_PRAZO[s], texto: concluido ? `${CONCLUIDO_NO_SELO[concluido]} · ${texto}` : texto };
}

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

/**
 * Quem está na demanda (como privado.estou_na_demanda, sem a fase de adaptação): os administradores, quem criou, o responsável, os
 * colaboradores e quem está num grupo da equipe posto nela (`meusGrupos`: os grupos da pessoa, #378). É quem altera a demanda.
 */
export const estaNaDemanda = (d: Pick<Demanda, 'criado_por' | 'responsavel_id' | 'colaboradores' | 'grupos'>, m: Membro, meusGrupos: readonly string[] = []) =>
  m.papel === 'master' || m.papel === 'admin' || m.id === d.criado_por || m.id === d.responsavel_id || d.colaboradores.includes(m.id)
  || estaPeloGrupo(d.grupos, meusGrupos);
/** O contrato do cartão é um daqueles em que a pessoa está (privado.contratos_em_que_estou, #326)? */
export const doContratoEmQueEsta = (contratoId: string | null | undefined, contratosEmQueEsta: readonly string[]) =>
  !!contratoId && contratosEmQueEsta.includes(contratoId);
/**
 * Quem vê a demanda (como a regra de leitura do banco, #326): quem está nela e, só para ler, quem está no contrato ligado a ela
 * (`contratosEmQueEsta`: os contratos que a pessoa criou, de que é responsável ou participante; a menção não conta).
 */
export const veADemanda = (d: Pick<Demanda, 'criado_por' | 'responsavel_id' | 'colaboradores' | 'grupos'> & { contrato_id?: string | null }, m: Membro,
  contratosEmQueEsta: readonly string[] = [], meusGrupos: readonly string[] = []) =>
  estaNaDemanda(d, m, meusGrupos) || doContratoEmQueEsta(d.contrato_id, contratosEmQueEsta);
/**
 * Por que o membro não pode ser mencionado na demanda (null se pode): só quem a vê, como o gatilho do banco (#326: também quem está
 * no contrato dela). O contrato vem com quem está nele (`contrato`) quando quem comenta pode abri-lo; sem ele, conta só quem está
 * na demanda (o banco ainda aceita quem está no contrato, se a menção for escrita à mão).
 */
export const motivoSemMencaoNaDemanda = (d: Pick<Demanda, 'criado_por' | 'responsavel_id' | 'colaboradores'>
  & { contrato_id?: string | null; contrato?: EquipeDoContrato | null }) =>
  (m: Membro) => veADemanda(d, m, contratosEmQueEsta([d.contrato], m)) ? null : 'não participa; inclua como colaborador';
/** A mensagem de quando alguém que não vê a demanda aparece num comentário dela (a mesma do banco). */
export const mencaoNegadaNaDemanda = (nome: string) => `Não é possível mencionar ${nome} nesta demanda: inclua essa pessoa como colaboradora antes.`;
