// A equipe no topo do cartão do contrato (#132), com as ações de cada bolinha para quem pode alterar o contrato (#356), como nos
// outros cartões (EquipeNoTopo): a bolinha com "+" põe alguém da equipe como participante, com 0% na divisão (decisão do dono, 18/11);
// o menu da de um participante (#388) o torna responsável (só se ele é advogado: o responsável do contrato é um advogado; o de antes
// continua como participante) ou o tira; o da do responsável troca o advogado responsável. O % de cada um continua sendo mudado no lápis.
// O contrato não tem a saída que pergunta antes, dos outros cartões: a ação com que a pessoa sairia dele sem poder (não é
// administradora nem o cadastrou) aparece no menu com o motivo no lugar dela (IMPEDIMENTO_NO_CONTRATO).
// O contrato guarda o participante pela pessoa do cadastro, e só os da equipe viram bolinha (os de fora ficam nas Partes).
// Esta peça grava (equipeDoContrato.ts) e avisa o cartão para ler de novo.
// Os grupos da equipe (#378) aparecem em pílulas, como nos outros cartões; só quem é parte por conta própria (quem altera o
// contrato) os põe e tira, e o grupo não entra na divisão nem no %: quem está só pelo grupo participa sem os valores.
import type { Contrato } from '../dados';
import { PARTICIPANTES_MAXIMOS } from '../dados/limites';
import { fmtPercentual, PARTICIPANTES_DEMAIS } from '../regras/contrato';
import { candidatosAoContrato, responsaveisAoContrato } from '../regras/equipe';
import { equipeDoContrato, IMPEDIMENTO_NO_CONTRATO, tirarDoContrato, type PedidoNoContrato, type PessoaDoUsuario, type QuemMuda } from '../regras/equipeDoContrato';
import { ACOES_NA_BOLINHA, acoesSem } from '../regras/menuDaBolinha';
import { EquipeDoCartao, naEquipe } from '../ui/EquipeDoCartao';
import { useCtx } from '../ui/sessao';
import { mudarAEquipeDoContrato } from './equipeDoContrato';
import { useGruposNoTopo, usePerfilNaBolinha, useUmaMudancaDeCadaVez } from './EquipeNoTopo';

/** O papel do responsável na bolinha do contrato. */
const PAPEL_DO_RESPONSAVEL = 'Advogado responsável';
/** O papel de um participante, com o % dele na divisão: "Participante · 10%". */
const papelDoParticipante = (percentual: number | null) => percentual === null ? 'Participante' : `Participante · ${fmtPercentual(percentual)}`;

interface Props {
  contrato: Contrato;
  /** Depois de mudar (ou de não mudar, porque alguém mudou antes): o cartão lê de novo, com o histórico. null: só para ver. */
  depois: (() => void) | null;
}

export function EquipeDoContratoNoTopo({ contrato: k, depois }: Props) {
  const ctx = useCtx();
  const { ocupado, umaDeCadaVez } = useUmaMudancaDeCadaVez();
  const perfil = usePerfilNaBolinha();
  const responsavel = naEquipe(ctx.equipe, k.responsavel_id, PAPEL_DO_RESPONSAVEL);
  // Cada participante da equipe vira bolinha pelo usuário dele; a pessoa do cadastro é o que o contrato guarda.
  const daEquipe = k.participantes.flatMap(p => {
    const m = ctx.equipe.find(x => x.pessoa_id === p.pessoa.id);
    return m ? [{ pessoaId: p.pessoa.id, bolinha: naEquipe(ctx.equipe, m.id, papelDoParticipante(p.percentual)) }] : [];
  });
  const daBolinha = (perfilId: string) => daEquipe.find(x => x.bolinha.id === perfilId);
  const participantes = daEquipe.map(x => x.bolinha);
  // Quem põe e tira os grupos é parte do contrato e continua nele sem o grupo: nunca sai por isso.
  const grupos = useGruposNoTopo('contratos', k.id, { responsavel_id: k.responsavel_id, lista: participantes.map(p => p.id) }, k.grupos, depois && {
    por: 'Pôr participante ou grupo', podeSair: true, umaDeCadaVez, depois
  });
  if (!depois) return <EquipeDoCartao responsavel={responsavel} participantes={participantes} grupos={grupos} />;

  // Quem muda, com o financeiro do escritório: com ele ligado, a trava da divisão muda a quem o motivo manda pedir (#274).
  const eu: QuemMuda = { ...ctx.perfil, financeiro: !!ctx.escritorio?.modulos?.financeiro };
  // A pessoa do cadastro de cada usuário: o responsável de antes continua como participante ao tornar outro responsável (#388).
  const pessoaDe: PessoaDoUsuario = perfilId => ctx.equipe.find(m => m.id === perfilId)?.pessoa_id;
  const pedir = (pedido: PedidoNoContrato) => umaDeCadaVez(async () => {
    await mudarAEquipeDoContrato(k.id, pedido, eu, pessoaDe);
    depois();
  }, depois);

  // Quem já está no contrato como participante ou indicador não entra de novo (o banco recusa a mesma pessoa duas vezes).
  const noContrato = [...k.participantes.map(p => p.pessoa.id), ...(k.indicador_id ? [k.indicador_id] : [])];
  // A bolinha que deixaria quem muda fora do contrato já vem desligada, com o motivo (a mesma conta que a gravação refaz).
  const atual = equipeDoContrato(k);
  // Só um advogado pode responder pelo contrato: "Tornar responsável" aparece só para quem a busca do responsável também acharia.
  const podemResponder = responsaveisAoContrato(ctx.equipe, '', k.responsavel_id).map(m => m.id);
  return <EquipeDoCartao responsavel={responsavel} participantes={participantes} grupos={grupos} mudar={{
    por: 'Pôr participante',
    candidatos: termo => candidatosAoContrato(ctx.equipe, termo, noContrato),
    responsaveis: termo => responsaveisAoContrato(ctx.equipe, termo, k.responsavel_id),
    acoes: p => podemResponder.includes(p.id) ? ACOES_NA_BOLINHA.participante : acoesSem(ACOES_NA_BOLINHA.participante, 'tornarResponsavel'),
    acoesDoResponsavel: ACOES_NA_BOLINHA.responsavel,
    tirar: p => tirarDoContrato(p, ctx.perfil.id),
    perfil,
    cheia: k.participantes.length >= PARTICIPANTES_MAXIMOS ? PARTICIPANTES_DEMAIS : undefined,
    ocupado,
    impedeTirar: p => {
      const pessoa = daBolinha(p.id);
      return pessoa && IMPEDIMENTO_NO_CONTRATO.tirar(atual, pessoa.pessoaId, eu);
    },
    impedeTrocar: IMPEDIMENTO_NO_CONTRATO.responsavel(atual, eu),
    impedeTornar: p => IMPEDIMENTO_NO_CONTRATO.tornarResponsavel(atual, p.id, eu, pessoaDe),
    aoPor: m => m.pessoa_id && pedir({ tipo: 'por', id: m.pessoa_id, nome: m.nome }),
    aoTirar: p => {
      const pessoa = daBolinha(p.id);
      return pessoa && pedir({ tipo: 'tirar', id: pessoa.pessoaId, nome: p.nome });
    },
    aoTrocarResponsavel: m => pedir({ tipo: 'responsavel', id: m.id, nome: m.nome }),
    aoTornarResponsavel: p => pedir({ tipo: 'tornarResponsavel', id: p.id, nome: p.nome })
  }} />;
}
