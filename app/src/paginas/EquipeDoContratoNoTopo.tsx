// A equipe no topo do cartão do contrato (#132), com as ações de cada bolinha para quem pode alterar o contrato (#356), como nos
// outros cartões (EquipeNoTopo): a bolinha com "+" põe alguém da equipe como participante, com 0% na divisão (decisão do dono, 18/11);
// a de um participante o tira na hora; a do responsável troca o advogado responsável. O % de cada um continua sendo mudado no lápis.
// O contrato não tem a saída que pergunta antes, dos outros cartões: a bolinha com que a pessoa sairia dele sem poder (não é
// administradora nem o cadastrou) vem desligada, com o motivo na dica (IMPEDIMENTO_NO_CONTRATO).
// O contrato guarda o participante pela pessoa do cadastro, e só os da equipe viram bolinha (os de fora ficam nas Partes).
// Esta peça grava (equipeDoContrato.ts) e avisa o cartão para ler de novo.
import type { Contrato } from '../dados';
import { PARTICIPANTES_MAXIMOS } from '../dados/limites';
import { fmtPercentual, PARTICIPANTES_DEMAIS } from '../regras/contrato';
import { candidatosAoContrato, responsaveisAoContrato } from '../regras/equipe';
import { equipeDoContrato, IMPEDIMENTO_NO_CONTRATO, tirarDoContrato, type PedidoNoContrato } from '../regras/equipeDoContrato';
import { EquipeDoCartao, naEquipe } from '../ui/EquipeDoCartao';
import { useCtx } from '../ui/sessao';
import { mudarAEquipeDoContrato } from './equipeDoContrato';
import { useUmaMudancaDeCadaVez } from './EquipeNoTopo';

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
  const responsavel = naEquipe(ctx.equipe, k.responsavel_id, PAPEL_DO_RESPONSAVEL);
  // Cada participante da equipe vira bolinha pelo usuário dele; a pessoa do cadastro é o que o contrato guarda.
  const daEquipe = k.participantes.flatMap(p => {
    const m = ctx.equipe.find(x => x.pessoa_id === p.pessoa.id);
    return m ? [{ pessoaId: p.pessoa.id, percentual: p.percentual, bolinha: naEquipe(ctx.equipe, m.id, papelDoParticipante(p.percentual)) }] : [];
  });
  const daBolinha = (perfilId: string) => daEquipe.find(x => x.bolinha.id === perfilId);
  const participantes = daEquipe.map(x => x.bolinha);
  if (!depois) return <EquipeDoCartao responsavel={responsavel} participantes={participantes} />;

  const pedir = (pedido: PedidoNoContrato) => umaDeCadaVez(async () => {
    await mudarAEquipeDoContrato(k.id, pedido, ctx.perfil);
    depois();
  }, depois);

  // Quem já está no contrato como participante ou indicador não entra de novo (o banco recusa a mesma pessoa duas vezes).
  const noContrato = [...k.participantes.map(p => p.pessoa.id), ...(k.indicador_id ? [k.indicador_id] : [])];
  // A bolinha que deixaria quem muda fora do contrato já vem desligada, com o motivo (a mesma conta que a gravação refaz).
  const atual = equipeDoContrato(k);
  return <EquipeDoCartao responsavel={responsavel} participantes={participantes} mudar={{
    por: 'Pôr participante',
    candidatos: termo => candidatosAoContrato(ctx.equipe, termo, noContrato),
    responsaveis: termo => responsaveisAoContrato(ctx.equipe, termo, k.responsavel_id),
    tirar: p => tirarDoContrato(p, ctx.perfil.id, daBolinha(p.id)?.percentual ?? null),
    cheia: k.participantes.length >= PARTICIPANTES_MAXIMOS ? PARTICIPANTES_DEMAIS : undefined,
    ocupado,
    impedeTirar: p => {
      const pessoa = daBolinha(p.id);
      return pessoa && IMPEDIMENTO_NO_CONTRATO.tirar(atual, pessoa.pessoaId, ctx.perfil);
    },
    impedeTrocar: IMPEDIMENTO_NO_CONTRATO.responsavel(atual, ctx.perfil),
    aoPor: m => m.pessoa_id && pedir({ tipo: 'por', id: m.pessoa_id, nome: m.nome }),
    aoTirar: p => {
      const pessoa = daBolinha(p.id);
      return pessoa && pedir({ tipo: 'tirar', id: pessoa.pessoaId, nome: p.nome });
    },
    aoTrocarResponsavel: m => pedir({ tipo: 'responsavel', id: m.id, nome: m.nome })
  }} />;
}
