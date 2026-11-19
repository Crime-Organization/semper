// O editor ao vivo (#364), como o do Obsidian: a caixa de escrever das anotações, em que a formatação aparece enquanto a pessoa
// escreve (títulos grandes, negrito, listas, caixinhas, citações, links), e os sinais do Markdown (**, ##, "- ") só aparecem na
// linha do cursor, para editar. O texto continua sendo o mesmo Markdown guardado de antes. Por baixo é o CodeMirror (o editor que
// o Obsidian usa), que só é baixado quando um editor aparece na tela: o resto do site não fica mais pesado. Enquanto ele chega,
// o texto aparece formatado no lugar.
import { lazy, Suspense, useRef, type RefObject } from 'react';
import { TextoFormatado } from './TextoFormatado';

export interface PropsEditorAoVivo {
  /** O id da caixa (para o foco e para a barra dizer que a controla). */
  id?: string;
  /** O nome da caixa para o leitor de tela. */
  rotulo: string;
  valor: string;
  aoMudar: (texto: string) => void;
  /** O tamanho máximo do texto: o que passaria dele fica de fora. */
  maximo?: number;
  placeholder?: string;
  className?: string;
}

/** O que o miolo (o CodeMirror) recebe além disso: se a pessoa pediu o foco enquanto ele chegava. */
export interface PropsDoMiolo extends PropsEditorAoVivo {
  focarAoChegar?: RefObject<boolean>;
}

/**
 * Começa a baixar o editor antes de ele aparecer (a página Documentos chama ao abrir): quando a pessoa abre ou cria uma anotação,
 * ele já está pronto. Baixa uma vez só.
 */
export const prepararEditorAoVivo = () => import('./EditorAoVivoCodeMirror');

const Editor = lazy(prepararEditorAoVivo);

/** A caixa de escrever com a formatação ao vivo e a barra de formatação (a mesma da CaixaFormatada). */
export function EditorAoVivo(props: PropsEditorAoVivo) {
  const focarAoChegar = useRef(false);
  // Enquanto o editor chega, o lugar dele recebe o foco (o Enter no título, por exemplo) e o passa ao editor quando ele chegar.
  const espera = <div id={props.id} tabIndex={-1} onFocus={() => { focarAoChegar.current = true; }} aria-busy="true"
    className={['editor-ao-vivo', 'editor-ao-vivo-chegando', props.className].filter(Boolean).join(' ')}>
    <TextoFormatado texto={props.valor} />
  </div>;
  return <Suspense fallback={espera}><Editor {...props} focarAoChegar={focarAoChegar} /></Suspense>;
}
