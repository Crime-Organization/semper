// A equipe no topo dos cartões de tarefa, demanda, processo, compromisso e anotação (#132), com a bolinha "+" e o menu de cada
// bolinha para quem pode alterar o cartão (#356, #388): no do responsável, trocá-lo; no de um participante, torná-lo responsável (o
// de antes continua no cartão) ou tirá-lo; nos dois, ver o perfil. O cartão diz se a pessoa muda a equipe (as mesmas regras que mostram o lápis) e
// como ela sai dele (as do lápis do módulo); esta peça grava (equipeNoCartao.ts) e avisa o cartão para ler de novo. O contrato tem a
// sua (EquipeDoContratoNoTopo), porque lá cada participante tem o seu % da divisão; as duas fazem uma mudança de cada vez (useUmaMudancaDeCadaVez).
// Os grupos da equipe do item (#378) vêm em pílulas depois dos participantes; quem altera o cartão os põe pelo "+" e os tira pela
// lista da pílula (useGruposNoTopo, que serve também ao contrato).
// Na tarefa (#313), cada participante tem uma função (`funcoes`): ela vai no papel da bolinha, quem executa fica em destaque e quem
// altera o cartão troca a função no menu da bolinha (ou a tira: "Sem função", #421) e escolhe a de quem entra pelo "+".
import { useRef, useState } from 'react';
import type { FuncaoNaTarefa, GrupoDaEquipe, ModuloDoPedido } from '../dados';
import { funcaoDe } from '../regras/funcoesNaTarefa';
import {
  candidatosDeGrupo, estaPeloGrupo, gruposDoItem, meusGrupos, notaDoGrupoNoTopo, SAIRIA_SEM_O_GRUPO, saiComOGrupo,
  type TipoDeMudancaNosGrupos
} from '../regras/gruposDaEquipe';
import { GRUPOS_POR_ITEM } from '../dados/limites';
import type { GruposDoCartao } from '../ui/EquipeDoCartao';
import { ACOES_NA_BOLINHA, impedeResponder, perfilNaBolinha } from '../regras/menuDaBolinha';
import { EQUIPE_DO_MODULO, planoDaMudanca, tirarPelaBolinha, type EquipeGravada, type ModuloDaEquipe, type PedidoNaEquipe, type SaidaDaPessoa } from '../regras/equipeNoCartao';
import { candidatosDaEquipe } from '../regras/equipe';
import { falha } from '../ui/avisos';
import { EquipeDoCartao, naEquipe, type PessoaDaEquipe } from '../ui/EquipeDoCartao';
import { confirmar } from '../ui/janela';
import { useCtx } from '../ui/sessao';
import { mudarAEquipe, mudarOsGrupos } from './equipeNoCartao';

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
  /** Os grupos da equipe postos no item (#378). */
  grupos?: string[];
  /** null: a pessoa só lê o cartão (ou ele está arquivado), e as bolinhas são só para ver. */
  mudar: MudancaNoTopo | null;
  /** As funções dos participantes (na tarefa, #313): as do escritório, a de cada participante e como gravar a troca. */
  funcoes?: { opcoes: readonly FuncaoNaTarefa[]; de: Readonly<Record<string, string>>; trocar: (perfil: string, funcao: string | null) => Promise<void> };
}

/**
 * Uma mudança na equipe de cada vez: cada uma lê a equipe e grava a lista inteira, e duas ao mesmo tempo leriam a mesma equipe,
 * com a segunda apagando o que a primeira pôs. A referência barra o segundo clique antes de a tela se desenhar de novo; `ocupado`
 * desliga as bolinhas enquanto grava. Se a gravação falha, o erro aparece e `aoFalhar` relê o cartão. Vale também no contrato.
 */
export function useUmaMudancaDeCadaVez() {
  const gravando = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  async function umaDeCadaVez(gravar: () => Promise<void>, aoFalhar: () => void) {
    if (gravando.current) return;
    gravando.current = true;
    setOcupado(true);
    try {
      await gravar();
    } catch (e) {
      falha(e);
      aoFalhar();
    } finally {
      gravando.current = false;
      setOcupado(false);
    }
  }
  return { ocupado, umaDeCadaVez };
}

/** O "Ver perfil" do menu das bolinhas (#388): o próprio perfil, ou o de outra pessoa, que só o administrador abre. Vale em todos os cartões. */
export function usePerfilNaBolinha() {
  const ctx = useCtx();
  return (p: PessoaDaEquipe) => perfilNaBolinha(p.id, { eu: ctx.perfil.id, ehAdmin: ctx.ehAdmin }, ctx.equipe);
}

/** O que os grupos do topo precisam saber de quem muda: o "+" com grupos, o que pôr e tirar faz e como a pessoa sai do cartão. */
interface GruposAMudar {
  /** O nome do "+" com grupos no escritório: "Pôr participante ou grupo". */
  por: string;
  /** Quem muda o cartão grava fora dele (administradora, quem criou…): tirar o próprio grupo não a tira do cartão. */
  podeSair: boolean;
  /** Continua no cartão pelo item ligado. */
  peloLigado?: boolean;
  umaDeCadaVez: ReturnType<typeof useUmaMudancaDeCadaVez>['umaDeCadaVez'];
  depois: () => void;
}

/**
 * Os grupos da equipe no topo do cartão (#378): as pílulas, a nota de quem está só pelo grupo e, para quem altera (`mudar`), o pôr
 * pelo "+" e o tirar pela lista. O grupo que é o único caminho de quem muda até o item não tem "Tirar" (ela deixaria de vê-lo, e o banco
 * recusa): no lugar, o motivo, que manda pedir a um administrador, como a saída de quem está só pelo grupo. Sem grupos no escritório e
 * no item, nada (undefined): o topo fica como sempre.
 */
export function useGruposNoTopo(modulo: ModuloDoPedido, id: string, quem: { responsavel_id: string | null; lista: readonly string[] },
  doItem: readonly string[] | undefined, mudar: GruposAMudar | null): GruposDoCartao | undefined {
  const ctx = useCtx();
  const eu = ctx.perfil.id, doEscritorio = ctx.grupos ?? [], grupos = doItem ?? [];
  const lista = gruposDoItem(doEscritorio, grupos);
  if (!doEscritorio.length && !lista.length) return undefined;
  const meus = meusGrupos(doEscritorio, eu);
  const pedir = (m: GruposAMudar, tipo: TipoDeMudancaNosGrupos, g: GrupoDaEquipe) => m.umaDeCadaVez(async () => {
    await mudarOsGrupos(modulo, id, tipo, g);
    m.depois();
  }, m.depois);
  return {
    doItem: lista, equipe: ctx.equipe, eu,
    nota: g => notaDoGrupoNoTopo({ eu, ...quem, meus, podeSair: !!mudar?.podeSair, peloLigado: mudar?.peloLigado }, g, lista),
    mudar: mudar && doEscritorio.length ? {
      candidatos: termo => candidatosDeGrupo(doEscritorio, termo, grupos), cheio: grupos.length >= GRUPOS_POR_ITEM, por: mudar.por,
      aoPor: g => pedir(mudar, 'porGrupo', g), aoTirar: g => pedir(mudar, 'tirarGrupo', g),
      impedeTirar: g => saiComOGrupo({ eu, ...quem, grupos, meus, podeSair: mudar.podeSair, peloLigado: mudar.peloLigado }, g.id) ? SAIRIA_SEM_O_GRUPO : undefined
    } : undefined
  };
}

export function EquipeNoTopo({ modulo, id, equipe, grupos, mudar, funcoes }: Props) {
  const ctx = useCtx();
  const m = EQUIPE_DO_MODULO[modulo], eu = ctx.perfil.id;
  // Sem responsável gravado (o usuário foi excluído), a bolinha dele aparece vazia, para escolher outro.
  const responsavel = equipe.responsavel_id ? naEquipe(ctx.equipe, equipe.responsavel_id, 'Responsável') : null;
  // Com funções (#313): o papel diz a função ("Participante · Executa"), e quem executa fica em destaque.
  const participantes = equipe.lista.map(x => {
    const f = funcoes ? funcaoDe(funcoes.opcoes, funcoes.de, x) : null;
    return { ...naEquipe(ctx.equipe, x, f ? `${m.papel} · ${f.nome}` : m.papel), executa: !!f?.executa };
  });
  const { ocupado, umaDeCadaVez } = useUmaMudancaDeCadaVez();
  const perfil = usePerfilNaBolinha();
  // Quem também está no cartão por um grupo dele continua nele ao se tirar da lista (sem o "você pode deixar de ver").
  const peloGrupo = estaPeloGrupo(grupos, meusGrupos(ctx.grupos, eu));
  const doTopo = useGruposNoTopo(modulo, id, { responsavel_id: equipe.responsavel_id || null, lista: equipe.lista }, grupos, mudar && {
    por: m.porOuGrupo, podeSair: mudar.saida.podeSair, peloLigado: mudar.saida.peloLigado, umaDeCadaVez, depois: mudar.depois
  });
  if (!mudar) return <EquipeDoCartao responsavel={responsavel} participantes={participantes} grupos={doTopo} />;

  const pedir = (pedido: PedidoNaEquipe) => umaDeCadaVez(async () => {
    const saida = { eu, ...mudar.saida, peloLigado: mudar.saida.peloLigado || peloGrupo };
    // Quem sai do cartão com isto pode deixar de vê-lo: pergunta antes (o lápis pergunta pelo Salvar).
    const previsto = planoDaMudanca(modulo, pedido, equipe, saida);
    if ('sai' in previsto && previsto.sai
      && !await confirmar(`${m.sair}?`, `Sem estar ${m.noItem}, você pode deixar de ver este cartão. A saída fica no histórico.`, m.sair)) return;
    const fim = await mudarAEquipe(modulo, id, pedido, saida);
    if (fim === 'saiu') mudar.aoSair(); else mudar.depois();
  }, mudar.depois);

  const noCartao = [equipe.responsavel_id, ...equipe.lista];
  return <EquipeDoCartao responsavel={responsavel} participantes={participantes} grupos={doTopo} mudar={{
    por: m.por,
    candidatos: termo => candidatosDaEquipe(ctx.equipe, termo, noCartao),
    responsaveis: termo => candidatosDaEquipe(ctx.equipe, termo, [equipe.responsavel_id]),
    acoes: () => ACOES_NA_BOLINHA.participante,
    acoesDoResponsavel: ACOES_NA_BOLINHA.responsavel,
    tirar: p => tirarPelaBolinha(modulo, p, eu),
    perfil,
    cheia: equipe.lista.length >= m.maximo ? m.cheia : undefined,
    ocupado,
    // Quem foi desativado continua na lista, mas não assume o item (a busca de trocar o responsável também não o acha).
    impedeTornar: p => impedeResponder(p.id, ctx.equipe),
    // Na tarefa (#313), com a função escolhida no "+".
    aoPor: (x, funcao) => pedir({ tipo: 'por', id: x.id, nome: x.nome, funcao }),
    aoTirar: p => pedir({ tipo: 'tirar', id: p.id, nome: p.nome }),
    aoTrocarResponsavel: x => pedir({ tipo: 'responsavel', id: x.id, nome: x.nome }),
    aoTornarResponsavel: p => pedir({ tipo: 'tornarResponsavel', id: p.id, nome: p.nome }),
    funcoes: funcoes && {
      opcoes: funcoes.opcoes, de: p => funcoes.de[p.id] ?? null,
      aoTrocar: (p, f) => umaDeCadaVez(async () => { await funcoes.trocar(p.id, f); mudar.depois(); }, mudar.depois)
    }
  }} />;
}
