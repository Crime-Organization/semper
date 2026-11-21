// O círculo de concluir antes do título (#350), como no Trello: na miniatura do quadro e na linha da tabela de Tarefas e de
// Demandas. Vazio, ele conclui; verde com o visto, reabre. É o mesmo Concluir/Reabrir do ✓ do cartão (#397, ConcluirNaSituacao):
// o mesmo ícone (o visto), os mesmos nomes e as mesmas regras (regras/conclusaoNoCartao.ts); o ícone é o visto nos dois estados,
// porque o círculo mostra o estado e o troca, como uma caixa de marcar.
// - Não abre o cartão: é um botão, e o clique num controle de dentro do item não abre (ui/abrirItem.tsx); o Enter e o Espaço nele
//   também não (o Kanban só abre com a tecla no próprio cartão).
// - Não arrasta a miniatura: ele mesmo é "arrastável" e cancela o próprio arrasto, e o do cartão nem começa.
// - Enquanto grava, já mostra o estado de destino e ignora novos cliques (aria-busy, sem desligar: desligado, perderia o foco).
// - Pelo teclado, o foco segue o item até a coluna nova (no quadro, ele sai de uma coluna e entra em outra).
// - Quem só lê, ou o item arquivado: sem botão; o concluído mostra só o visto (uma imagem, fora do Tab).
import { useEffect, useRef, useState } from 'react';
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
  /** Faz a ação (leva o item à coluna dela); o círculo espera ela terminar. */
  aoAgir: (acao: AcaoDeConclusao) => Promise<unknown>;
}

export function ConcluirNaMiniatura({ id, titulo, estado, concluida, aoAgir }: Props) {
  const [ocupado, setOcupado] = useState(false);
  const agindo = useRef(false);
  const botao = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focoPendente?.id !== id || !botao.current) return;
    if (Date.now() <= focoPendente.ate) botao.current.focus();
    focoPendente = null;
  }, [id, estado]);

  if (!estado) return null;
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
      await aoAgir(acao);
    } finally {
      agindo.current = false;
      setOcupado(false);
    }
  }

  // O clique do teclado (Enter, Espaço) chega com detail 0; o do mouse e o do dedo, com o número de cliques.
  return <button ref={botao} type="button" className="circulo-de-concluir" data-estado={ocupado ? ESTADO_DURANTE[acao] : acao}
    aria-label={rotuloDaAcaoNoItem(acao, titulo)} {...propsDaDica(NOME_DA_ACAO[acao])} aria-busy={ocupado || undefined}
    draggable onDragStart={e => { e.preventDefault(); e.stopPropagation(); }} onClick={e => void agir(e.detail === 0)}>
    <Icone nome="check" tam={ICONE_NO_QUADRO} />
  </button>;
}
