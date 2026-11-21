// O círculo de concluir antes do título (#350), como no Trello: na miniatura do quadro e na linha da tabela de Tarefas e de
// Demandas. Vazio, ele conclui; verde com o visto, reabre. É o mesmo Concluir/Reabrir do ✓ do cartão (#397, ConcluirNaSituacao):
// o mesmo ícone (o visto), os mesmos nomes e as mesmas regras (regras/conclusaoNoCartao.ts); o ícone é o visto nos dois estados,
// porque o círculo mostra o estado e o troca, como uma caixa de marcar.
// - Não abre o cartão: é um botão, e o clique num controle de dentro do item não abre (ui/abrirItem.tsx); o Enter e o Espaço nele
//   também não (o Kanban só abre com a tecla no próprio cartão).
// - Não arrasta a miniatura: ele mesmo é "arrastável" e cancela o próprio arrasto, e o do cartão nem começa.
// - Enquanto grava, já mostra o estado de destino e ignora novos cliques (aria-busy, sem desligar: desligado, perderia o foco).
// - Um clique de cada vez: o segundo clique de um clique duplo não vale, nem o clique do mouse num círculo que apareceu embaixo
//   dele sem ele se mexer. No quadro, o item concluído sai da coluna e o de baixo sobe para o lugar dele: sem isto, o segundo
//   clique concluiria também o de baixo (e, na tabela, reabriria o que acabou de concluir).
// - Pelo teclado, o foco segue o item até a coluna nova (no quadro, ele sai de uma coluna e entra em outra), se a pessoa ainda não
//   foi para outro lugar.
// - Quem só lê, ou o item arquivado: sem botão; o concluído mostra só o visto (uma imagem, fora do Tab), e o aberto, só o lugar
//   do círculo, vazio (na tabela e no toque, onde os círculos ficam à vista, os títulos continuam alinhados).
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { NOME_DA_ACAO, rotuloDaAcaoNoItem, type AcaoDeConclusao, type CirculoDoItem } from '../../regras/conclusaoNoCartao';
import { propsDaDica } from '../base';
import { Icone, ICONE_NO_QUADRO } from '../Icone';
import { FOCO_DEPOIS_DE_MOVER } from '../tempos';

/** O que o círculo mostra enquanto a ação grava: o estado a que ela leva (concluir pinta de verde; reabrir esvazia). */
const ESTADO_DURANTE: Record<AcaoDeConclusao, AcaoDeConclusao> = { concluir: 'reabrir', reabrir: 'concluir' };

/** O item cujo círculo foi acionado pelo teclado: o círculo dele, ao aparecer de novo (na coluna nova), recebe o foco, até a hora
 *  marcada em `ate` (depois disso, o foco não é mais tomado). Um só para o sistema todo: é um foco só. */
let focoPendente: { id: string; ate: number } | null = null;

interface Props {
  /** O id do item (para o foco segui-lo até a coluna nova). */
  id: string;
  /** O título do item, que entra no nome do botão ("Concluir Emitir a GRU"). */
  titulo: string;
  /** O que mostrar (circuloDoItem): o botão de concluir ou de reabrir, só o visto ('concluida') ou nada (null). */
  estado: CirculoDoItem;
  /** O nome do visto só para ver ("Tarefa concluída"). */
  concluida: string;
  /** Faz a ação (leva o item à coluna dela); o círculo espera ela terminar. `peloTeclado`: a pessoa usou o teclado (o foco segue
   *  o item, ou vai para perto dele). */
  aoAgir: (acao: AcaoDeConclusao, peloTeclado: boolean) => Promise<unknown>;
}

/** O clique do teclado (Enter, Espaço) chega com detail 0; o do mouse e o do dedo, com o número de cliques seguidos. */
const PELO_TECLADO = 0;
/** O primeiro clique; do segundo em diante (o clique duplo ou triplo), o clique é repetido. */
const PRIMEIRO_CLIQUE = 1;

/** Se o clique no círculo vale. O do teclado, sempre; o repetido (o segundo do clique duplo), nunca; o do mouse, só se ele andou
 *  sobre o círculo antes (um círculo que apareceu embaixo do mouse parado não é o que a pessoa mirou). */
export const cliqueVale = (detalhe: number, peloMouse: boolean, mouseAndou: boolean) =>
  detalhe === PELO_TECLADO || (detalhe === PRIMEIRO_CLIQUE && (!peloMouse || mouseAndou));

export function ConcluirNaMiniatura({ id, titulo, estado, concluida, aoAgir }: Props) {
  const [ocupado, setOcupado] = useState(false);
  const agindo = useRef(false);
  const botao = useRef<HTMLButtonElement>(null);
  /** Se o último ponteiro a apertar o círculo foi o mouse, e se o mouse andou sobre o círculo desde que entrou nele. */
  const peloMouse = useRef(false);
  const mouseAndou = useRef(false);

  useEffect(() => {
    if (focoPendente?.id !== id || !botao.current) return;
    // Só se o foco se perdeu (o botão antigo saiu da tela): se a pessoa já foi para outro lugar, ele fica lá.
    const perdido = !document.activeElement || document.activeElement === document.body;
    if (Date.now() <= focoPendente.ate && perdido) botao.current.focus();
    focoPendente = null;
  }, [id, estado]);

  if (!estado) return <span className="circulo-de-concluir" data-estado="nenhum" aria-hidden="true" />;
  if (estado === 'concluida') return <span className="circulo-de-concluir" data-estado="concluida" role="img" aria-label={concluida}>
    <Icone nome="check" tam={ICONE_NO_QUADRO} />
  </span>;
  const acao = estado;

  async function agir(peloTeclado: boolean) {
    if (agindo.current) return;
    agindo.current = true;
    setOcupado(true);
    if (peloTeclado) focoPendente = { id, ate: Date.now() + FOCO_DEPOIS_DE_MOVER };
    try {
      await aoAgir(acao, peloTeclado);
    } finally {
      agindo.current = false;
      setOcupado(false);
    }
  }

  function aoClicar(e: MouseEvent) {
    if (cliqueVale(e.detail, peloMouse.current, mouseAndou.current)) void agir(e.detail === PELO_TECLADO);
  }

  return <button ref={botao} type="button" className="circulo-de-concluir" data-estado={ocupado ? ESTADO_DURANTE[acao] : acao}
    aria-label={rotuloDaAcaoNoItem(acao, titulo)} {...propsDaDica(NOME_DA_ACAO[acao])} aria-busy={ocupado || undefined}
    draggable onDragStart={e => { e.preventDefault(); e.stopPropagation(); }}
    onPointerDown={e => { peloMouse.current = e.pointerType === 'mouse'; }}
    onPointerMove={e => { if (e.pointerType === 'mouse') mouseAndou.current = true; }}
    onPointerLeave={() => { mouseAndou.current = false; }}
    onClick={aoClicar}>
    <Icone nome="check" tam={ICONE_NO_QUADRO} />
  </button>;
}
