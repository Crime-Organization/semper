// Para os testes de componente que escrevem no editor ao vivo (ui/base/EditorAoVivo, #364). O jsdom não desenha nem mede texto,
// então digitar letra por letra num editor de verdade (o CodeMirror) não funciona aqui: a escrita entra como entraria pelo teclado,
// uma mudança do próprio editor (com o foco nele), e o texto é lido do editor, e não da tela, onde os sinais do Markdown somem.
// Os testes de ponta a ponta (e2e/) digitam de verdade, no navegador.
import { EditorView } from '@codemirror/view';
import { act, screen } from '@testing-library/react';

/** O editor de uma caixa (achada pelo papel e pelo nome, como a pessoa a acha). */
export function editorDe(caixa: HTMLElement): EditorView {
  const v = EditorView.findFromDOM(caixa);
  if (!v) throw new Error('A caixa não é um editor ao vivo.');
  return v;
}

/** Espera o editor chegar (ele é baixado à parte) e devolve a caixa. */
export const acharEditor = (nome = 'Texto') => screen.findByRole('textbox', { name: nome });

/** O texto guardado no editor (o Markdown, com os sinais). */
export const textoDoEditor = (caixa: HTMLElement) => editorDe(caixa).state.doc.toString();

/** Escreve no fim do texto, com o foco no editor, como a pessoa que clica no fim e digita. */
export function escreverNoEditor(caixa: HTMLElement, texto: string) {
  const v = editorDe(caixa);
  act(() => {
    v.focus();
    const fim = v.state.doc.length;
    v.dispatch({ changes: { from: fim, insert: texto }, selection: { anchor: fim + texto.length }, userEvent: 'input.type' });
  });
}

/** Troca o texto todo, com o foco no editor (como a pessoa que escolhe tudo e escreve outro texto por cima). */
export function trocarTextoDoEditor(caixa: HTMLElement, texto: string) {
  const v = editorDe(caixa);
  act(() => {
    v.focus();
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: texto }, selection: { anchor: texto.length }, userEvent: 'input.type' });
  });
}
