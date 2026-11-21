// O título e a descrição mudados no próprio lugar do cartão (#346), no jeito da anotação (#339), para os cartões de tarefa,
// demanda, processo e compromisso: o cartão usa TituloEditavel e TextoEditavel (ui/base) e, daqui,
// - useEdicaoNoLugar: guarda o que está aberto para editar, e o recomeça quando a pessoa escolhe "Sair sem salvar";
// - AvisoDaEdicaoNoLugar: com algo por salvar, sair do cartão pergunta antes (AvisoAoSair), como na anotação;
// - gravarNoLugar: grava só o campo mudado, com a mesma função e o mesmo aviso (com Desfazer) do lápis;
// - abrirOLapis (#395): o lápis não abre por cima de uma data mudada e não salva (ele a fecharia sem perguntar); a data continua
//   aberta e lembra de salvar ou cancelar, pelo LembreteDoCartao, que o cartão põe em volta de tudo (LembreteDoLapis).
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { edicaoNoLugarPorSalvar, pedirOLapis, type CampoNoLugar, type DadoNoLugar, type GravadoNoLugar, type RascunhosNoLugar } from '../regras/edicaoNoLugar';
import { AvisoAoSair } from './AvisoAoSair';
import { feito, type Mudanca } from './avisos';
import { LembreteDoCartao } from './useEdicaoUnica';

export interface EdicaoNoLugar {
  rascunhos: RascunhosNoLugar;
  /** Para o aoMudarRascunho do título, da descrição e dos dados do grupo das datas (#361). */
  rascunhoDe: (campo: CampoNoLugar | DadoNoLugar) => (rascunho: string | null) => void;
  /** A chave do título e da descrição: muda quando a pessoa escolhe "Sair sem salvar", e a edição aberta recomeça. */
  chave: number;
  descartar: () => void;
  liberada: RefObject<boolean>;
  /** Abre o lápis (abrir), a não ser que uma data do cartão esteja por salvar: aí ela continua aberta e lembra de salvar ou cancelar. */
  abrirOLapis: (abrir: () => void) => void;
  /** Quantas vezes o lápis foi barrado por uma data por salvar (para o LembreteDoLapis). */
  lembretes: number;
}

export function useEdicaoNoLugar(): EdicaoNoLugar {
  const [rascunhos, setRascunhos] = useState<RascunhosNoLugar>({});
  const [chave, setChave] = useState(0);
  /** O cartão não sai por conta própria no meio de uma edição no lugar: fica sempre false, e o aviso sempre pergunta. */
  const liberada = useRef(false);
  const rascunhoDe = useCallback((campo: CampoNoLugar | DadoNoLugar) => (r: string | null) => setRascunhos(atual => ({ ...atual, [campo]: r })), []);
  // O cartão pode continuar ao fundo (a anotação nova abre por cima dele): o que foi descartado não é salvo depois.
  const descartar = useCallback(() => { setRascunhos({}); setChave(v => v + 1); }, []);
  const [lembretes, setLembretes] = useState(0);
  // O lápis também abre de fora do cartão (a ação "Editar o contrato" do aviso no pé da tela): confere os rascunhos de agora, e
  // não os de quando o aviso apareceu.
  const agora = useRef(rascunhos);
  useEffect(() => { agora.current = rascunhos; }, [rascunhos]);
  const abrirOLapis = useCallback((abrir: () => void) => {
    if (pedirOLapis(agora.current) === 'manter') setLembretes(n => n + 1);
    else abrir();
  }, []);
  return { rascunhos, rascunhoDe, chave, descartar, liberada, abrirOLapis, lembretes };
}

/** Em volta do cartão: leva às datas dele o lembrete do lápis barrado (abrirOLapis). */
export function LembreteDoLapis({ edicao, children }: { edicao: EdicaoNoLugar; children: ReactNode }) {
  return <LembreteDoCartao value={edicao.lembretes}>{children}</LembreteDoCartao>;
}

/** Com o título, a descrição ou um dado do grupo das datas (#361) mudados e ainda não salvos, sair do cartão pergunta antes. */
export function AvisoDaEdicaoNoLugar({ edicao, gravado }: { edicao: EdicaoNoLugar; gravado: GravadoNoLugar }) {
  if (!edicaoNoLugarPorSalvar(gravado, edicao.rascunhos)) return null;
  return <AvisoAoSair preenchido liberada={edicao.liberada} ocupado={false} aoDescartar={edicao.descartar} />;
}

export interface GravacaoNoLugar<D> {
  /** Só o campo que mudou, e como ele estava (para o Desfazer). */
  novo: D;
  antes: D;
  /** A mesma função de atualizar do lápis (ex.: SD.tarefaAtualizar), com o histórico e as regras do banco. */
  gravar: (dados: D) => Promise<unknown>;
  /** O aviso no pé da tela e o nome do que se desfaz: os mesmos do lápis (ex.: "Tarefa atualizada."). */
  aviso: string;
  oQue: string;
  /** O que o Desfazer avisa que mudou, para a tela ler de novo. */
  mudanca: Mudanca;
  /** Mostra os dados no cartão: o novo na hora, e o de antes de volta se a gravação falhar. */
  mostrar: (dados: D) => void;
  /** Depois de gravar (ler o cartão de novo, avisar a lista). */
  depois: () => void;
}

/**
 * Grava o título ou a descrição mudados no próprio lugar. A tela já mostra o novo; se a gravação falhar, o de antes volta e o
 * erro segue para a peça que editava (o título o mostra no pé da tela; a descrição o mostra e continua aberta).
 */
export async function gravarNoLugar<D>(g: GravacaoNoLugar<D>) {
  g.mostrar(g.novo);
  try {
    await g.gravar(g.novo);
  } catch (e) {
    g.mostrar(g.antes);
    throw e;
  }
  feito(g.aviso, g.oQue, async () => { await g.gravar(g.antes); return g.mudanca; });
  g.depois();
}
