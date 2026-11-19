// A equipe no topo dos cartões de tarefa, demanda, processo, compromisso e anotação (#132), com a bolinha "+" e as ações de cada
// bolinha para quem pode alterar o cartão (#356): a do responsável troca, a de um participante o tira na hora. O cartão diz se a pessoa muda a equipe (as mesmas regras que mostram o lápis) e
// como ela sai dele (as do lápis do módulo); esta peça grava (equipeNoCartao.ts) e avisa o cartão para ler de novo.
import { useRef, useState } from 'react';
import { EQUIPE_DO_MODULO, planoDaMudanca, tirarPelaBolinha, type EquipeGravada, type ModuloDaEquipe, type PedidoNaEquipe, type SaidaDaPessoa } from '../regras/equipeNoCartao';
import { candidatosDaEquipe } from '../regras/equipe';
import { falha } from '../ui/avisos';
import { EquipeDoCartao, naEquipe } from '../ui/EquipeDoCartao';
import { confirmar } from '../ui/janela';
import { useCtx } from '../ui/sessao';
import { mudarAEquipe } from './equipeNoCartao';

/** Quem muda a equipe ali mesmo: como sai do cartão e o que o cartão faz depois. */
export interface MudancaNoTopo {
  saida: Omit<SaidaDaPessoa, 'eu'>;
  /** Depois de mudar (ou de não mudar, porque alguém mudou antes): o cartão lê de novo e o histórico também. */
  depois: () => void;
  /** A pessoa saiu do cartão e pode não vê-lo mais. */
  aoSair: () => void;
}

interface Props {
  modulo: ModuloDaEquipe;
  id: string;
  equipe: EquipeGravada;
  /** null: a pessoa só lê o cartão (ou ele está arquivado), e as bolinhas são só para ver. */
  mudar: MudancaNoTopo | null;
}

export function EquipeNoTopo({ modulo, id, equipe, mudar }: Props) {
  const ctx = useCtx();
  const m = EQUIPE_DO_MODULO[modulo], eu = ctx.perfil.id;
  // Sem responsável gravado (o usuário foi excluído), a bolinha dele aparece vazia, para escolher outro.
  const responsavel = equipe.responsavel_id ? naEquipe(ctx.equipe, equipe.responsavel_id, 'Responsável') : null;
  const participantes = equipe.lista.map(x => naEquipe(ctx.equipe, x, m.papel));
  // Uma mudança de cada vez: cada uma lê a equipe e grava a lista inteira, e duas ao mesmo tempo leriam a mesma equipe, com a
  // segunda apagando o que a primeira pôs. A referência barra o segundo clique antes de a tela se desenhar de novo; o estado
  // desliga as bolinhas enquanto grava.
  const gravando = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  if (!mudar) return <EquipeDoCartao responsavel={responsavel} participantes={participantes} />;

  async function pedir(pedido: PedidoNaEquipe) {
    if (gravando.current) return;
    gravando.current = true;
    setOcupado(true);
    try {
      const saida = { eu, ...mudar!.saida };
      // Quem sai do cartão com isto pode deixar de vê-lo: pergunta antes (o lápis pergunta pelo Salvar).
      const previsto = planoDaMudanca(modulo, pedido, equipe, saida);
      if ('sai' in previsto && previsto.sai
        && !await confirmar(`${m.sair}?`, `Sem estar ${m.noItem}, você pode deixar de ver este cartão. A saída fica no histórico.`, m.sair)) return;
      const fim = await mudarAEquipe(modulo, id, pedido, saida);
      if (fim === 'saiu') mudar!.aoSair(); else mudar!.depois();
    } catch (e) {
      falha(e);
      mudar!.depois();
    } finally {
      gravando.current = false;
      setOcupado(false);
    }
  }

  const noCartao = [equipe.responsavel_id, ...equipe.lista];
  return <EquipeDoCartao responsavel={responsavel} participantes={participantes} mudar={{
    por: m.por,
    candidatos: termo => candidatosDaEquipe(ctx.equipe, termo, noCartao),
    responsaveis: termo => candidatosDaEquipe(ctx.equipe, termo, [equipe.responsavel_id]),
    tirar: p => tirarPelaBolinha(modulo, p, eu),
    cheia: equipe.lista.length >= m.maximo ? m.cheia : undefined,
    ocupado,
    aoPor: x => pedir({ tipo: 'por', id: x.id, nome: x.nome }),
    aoTirar: p => pedir({ tipo: 'tirar', id: p.id, nome: p.nome }),
    aoTrocarResponsavel: x => pedir({ tipo: 'responsavel', id: x.id, nome: x.nome })
  }} />;
}
