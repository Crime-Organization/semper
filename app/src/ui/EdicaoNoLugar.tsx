// O título e a descrição mudados no próprio lugar do cartão (#346), no jeito da anotação (#339), para os cartões de tarefa,
// demanda, processo e compromisso: o cartão usa TituloEditavel e TextoEditavel (ui/base) e, daqui,
// - useEdicaoNoLugar: guarda o que está aberto para editar, e o recomeça quando a pessoa escolhe "Sair sem salvar";
// - AvisoDaEdicaoNoLugar: com algo por salvar, sair do cartão pergunta antes (AvisoAoSair), como na anotação;
// - gravarNoLugar: grava só o campo mudado, com a mesma função e o mesmo aviso (com Desfazer) do lápis.
import { useCallback, useRef, useState, type RefObject } from 'react';
import { edicaoNoLugarPorSalvar, type CampoNoLugar, type GravadoNoLugar, type RascunhosNoLugar } from '../regras/edicaoNoLugar';
import { AvisoAoSair } from './AvisoAoSair';
import { feito, type Mudanca } from './avisos';

export interface EdicaoNoLugar {
  rascunhos: RascunhosNoLugar;
  /** Para o aoMudarRascunho do título ou da descrição. */
  rascunhoDe: (campo: CampoNoLugar) => (rascunho: string | null) => void;
  /** A chave do título e da descrição: muda quando a pessoa escolhe "Sair sem salvar", e a edição aberta recomeça. */
  chave: number;
  descartar: () => void;
  liberada: RefObject<boolean>;
}

export function useEdicaoNoLugar(): EdicaoNoLugar {
  const [rascunhos, setRascunhos] = useState<RascunhosNoLugar>({});
  const [chave, setChave] = useState(0);
  /** O cartão não sai por conta própria no meio de uma edição no lugar: fica sempre false, e o aviso sempre pergunta. */
  const liberada = useRef(false);
  const rascunhoDe = useCallback((campo: CampoNoLugar) => (r: string | null) => setRascunhos(atual => ({ ...atual, [campo]: r })), []);
  // O cartão pode continuar ao fundo (a anotação nova abre por cima dele): o que foi descartado não é salvo depois.
  const descartar = useCallback(() => { setRascunhos({}); setChave(v => v + 1); }, []);
  return { rascunhos, rascunhoDe, chave, descartar, liberada };
}

/** Com o título ou a descrição mudados e ainda não salvos, sair do cartão pergunta antes. */
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
