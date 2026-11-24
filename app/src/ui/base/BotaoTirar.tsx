// O "x" que tira do cartão o que se pôs ou se ligou nele (#424): a etiqueta, a pessoa, a demanda, o contrato, o processo, o
// compromisso, a anotação, o vínculo... Uma peça só, em todos os cartões: o rótulo é sempre "Tirar <o que sai>" (no aria-label e
// na dica do mouse), e o clique sempre pergunta antes (decisão do dono), numa janela com "Tirar" em vermelho; só o sim tira. Quem
// não pode mudar o cartão não vê o "x": o cartão diz isso uma vez (TirarNoCartao, que o CriarNoCartao de ItensLigados já põe em
// volta de cada cartão), e cada lugar ainda pode dizer o seu (`pode`). Ao passar o mouse na linha ou com o foco nela, o "x" aparece
// (estilo .botao-tirar, em estilo.css); no toque, ele fica sempre à vista.
import { createContext, useContext, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { falha } from '../avisos';
import { Icone } from '../Icone';
import { confirmar } from '../janela';

/** O que tirar e como. */
export interface PedidoDeTirar {
  /** O que sai, com o artigo: "a demanda D-12", "a etiqueta Urgente", "Ana Souza". O rótulo do botão é "Tirar " e isto. */
  oQue: string;
  /** O texto da janela, embaixo da pergunta: o que acontece ao tirar. Sem ele, EXPLICACAO_DO_TIRAR. */
  explicacao?: ReactNode;
  /** A gravação, depois do sim. Uma falha aparece no pé da tela. */
  aoTirar: () => unknown;
}

/** O texto padrão da janela: só a ligação sai, e há o Desfazer. */
export const EXPLICACAO_DO_TIRAR = 'Só a ligação com este cartão sai: o item continua no SEMPER. Dá para desfazer logo depois, no aviso do pé da tela.';
/** O nome do botão que confirma, na janela. */
export const CONFIRMAR_O_TIRAR = 'Tirar';
/** O rótulo do "x" (aria-label e dica): "Tirar a etiqueta Urgente". */
export const rotuloDoTirar = (oQue: string) => `Tirar ${oQue}`;

/** Onde o "x" fica: ao lado de uma linha (os itens ligados) ou dentro de uma pílula (a etiqueta). */
export type FormaDoTirar = 'linha' | 'etiqueta';
const CLASSE: Record<FormaDoTirar, string> = { linha: 'icone-btn botao-tirar', etiqueta: 'etiqueta-tirar' };
/** O tamanho do "x" em cada forma: na pílula da etiqueta, menor. */
const TAMANHO_DO_X: Record<FormaDoTirar, number> = { linha: 14, etiqueta: 11 };

/** Se quem está no cartão pode tirar o que está nele. Fora de um cartão, pode: cada lugar decide. */
const PodeTirar = createContext(true);
/** Em volta do cartão: com `pode={false}` (o cartão arquivado, ou quem só lê), nenhum "x" aparece dentro dele. */
export function TirarNoCartao({ pode, children }: { pode: boolean; children: ReactNode }) {
  return <PodeTirar.Provider value={pode}>{children}</PodeTirar.Provider>;
}

/** Pergunta antes e, com o sim, tira. Para quem tira por outro caminho que não o "x" (o menu de uma bolinha, por exemplo). */
export async function perguntarETirar({ oQue, explicacao, aoTirar }: PedidoDeTirar) {
  if (!await confirmar(`${rotuloDoTirar(oQue)}?`, explicacao ?? EXPLICACAO_DO_TIRAR, CONFIRMAR_O_TIRAR, true)) return;
  try { await aoTirar(); } catch (e) { falha(e); }
}

/** As teclas que apertam o botão: não chegam a quem está em volta (a pílula ou a linha que também abre algo). */
const TECLAS_DO_BOTAO = new Set(['Enter', ' ']);

/**
 * O "x". Sem `pode`, vale o que o cartão diz (TirarNoCartao); com ele, quem o passa já decidiu (ex.: as etiquetas, que têm a
 * permissão própria do topo do cartão). Sem permissão, nada aparece.
 */
export function BotaoTirar({ forma = 'linha', pode, ...pedido }: PedidoDeTirar & { forma?: FormaDoTirar; pode?: boolean }) {
  const doCartao = useContext(PodeTirar);
  if (!(pode ?? doCartao)) return null;
  const rotulo = rotuloDoTirar(pedido.oQue);
  const clicar = (ev: MouseEvent) => { ev.stopPropagation(); void perguntarETirar(pedido); };
  const tecla = (ev: KeyboardEvent) => { if (TECLAS_DO_BOTAO.has(ev.key)) ev.stopPropagation(); };
  return <button type="button" className={CLASSE[forma]} aria-label={rotulo} title={rotulo} onClick={clicar} onKeyDown={tecla}>
    <Icone nome="fechar" tam={TAMANHO_DO_X[forma]} />
  </button>;
}
