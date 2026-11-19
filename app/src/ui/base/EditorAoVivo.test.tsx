// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. O jsdom não desenha nem mede texto: aqui se confere o que ele
// aguenta (o nome, o texto, as mudanças, a barra, as caixinhas e os sinais escondidos); a escrita de verdade, letra por letra, fica
// nos testes de ponta a ponta (e2e/documentos.spec.ts).
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { acharEditor, editorDe, escreverNoEditor, textoDoEditor } from '../../testes/editorAoVivo';
import { EditorAoVivo } from './EditorAoVivo';

/** O editor com o texto guardado na tela, como a anotação o usa. */
function Nota({ inicial = '', aoMudar = vi.fn(), maximo }: { inicial?: string; aoMudar?: (t: string) => void; maximo?: number }) {
  const [valor, setValor] = useState(inicial);
  return <EditorAoVivo id="texto" rotulo="Texto" valor={valor} maximo={maximo} aoMudar={t => { setValor(t); aoMudar(t); }} />;
}
/** Escolhe um trecho do texto no editor (como a pessoa que arrasta o mouse por cima). */
function escolher(caixa: HTMLElement, inicio: number, fim: number) {
  const v = editorDe(caixa);
  act(() => { v.focus(); v.dispatch({ selection: { anchor: inicio, head: fim } }); });
}

describe('O editor ao vivo enquanto chega (ele é baixado à parte)', () => {
  it('dado o editor ainda chegando, quando a pessoa pede o texto (o Enter no título), então o cursor vai para ele quando chegar', async () => {
    // Dado: um editor que ainda não foi baixado nesta página (os módulos são lidos de novo)
    vi.resetModules();
    const { EditorAoVivo: Chegando } = await import('./EditorAoVivo');
    render(<Chegando id="texto-chegando" rotulo="Texto" valor="Levar o RG" aoMudar={vi.fn()} />);
    // Quando: o foco vai para o lugar do texto antes de o editor chegar
    act(() => { document.getElementById('texto-chegando')?.focus(); });
    // Então
    const caixa = await acharEditor();
    await waitFor(() => expect(caixa).toHaveFocus());
  });
});

describe('O editor ao vivo (a formatação aparece enquanto se escreve, como no Obsidian)', () => {
  it('quando abre, então é uma caixa de texto de várias linhas com o nome "Texto", o id dado e o texto guardado', async () => {
    // Quando
    render(<Nota inicial={'## Pendências\n- RG'} />);
    // Então
    const caixa = await acharEditor();
    expect(caixa).toHaveAttribute('aria-multiline', 'true');
    expect(caixa).toHaveAttribute('id', 'texto');
    expect(textoDoEditor(caixa)).toBe('## Pendências\n- RG');
    expect(screen.getByRole('toolbar', { name: 'Formatação do texto' })).toBeInTheDocument();
  });

  it('quando a pessoa escreve, então quem usa recebe o texto todo, em Markdown', async () => {
    // Dado
    const aoMudar = vi.fn();
    render(<Nota inicial="Levar o RG" aoMudar={aoMudar} />);
    // Quando
    escreverNoEditor(await acharEditor(), ' e o CPF');
    // Então
    expect(aoMudar).toHaveBeenLastCalledWith('Levar o RG e o CPF');
  });

  it('dado um trecho escolhido, quando a pessoa clica em Negrito, então o texto ganha os "**" e o Ctrl+Z os tira', async () => {
    // Dado
    const aoMudar = vi.fn();
    render(<Nota inicial="Levar o RG" aoMudar={aoMudar} />);
    const caixa = await acharEditor();
    escolher(caixa, 8, 10);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Negrito (Ctrl+B)' }));
    // Então
    expect(textoDoEditor(caixa)).toBe('Levar o **RG**');
    expect(aoMudar).toHaveBeenLastCalledWith('Levar o **RG**');
    // Quando
    act(() => { editorDe(caixa).focus(); });
    await userEvent.keyboard('{Control>}z{/Control}');
    // Então
    expect(textoDoEditor(caixa)).toBe('Levar o RG');
  });

  it('dado um trecho escolhido, quando a pessoa aperta Ctrl+I, então o trecho fica em itálico', async () => {
    // Dado
    render(<Nota inicial="Levar o RG" />);
    const caixa = await acharEditor();
    escolher(caixa, 0, 5);
    // Quando
    await userEvent.keyboard('{Control>}i{/Control}');
    // Então
    expect(textoDoEditor(caixa)).toBe('*Levar* o RG');
  });

  it('dado o foco fora do editor, então os sinais do Markdown ficam escondidos; com o cursor na linha, eles aparecem', async () => {
    // Dado
    render(<Nota inicial={'Levar o **RG**\nfim'} />);
    const caixa = await acharEditor();
    // Então: sem o foco, a linha mostra só o texto formatado
    expect(caixa).toHaveTextContent('Levar o RG');
    expect(caixa.textContent).not.toContain('**');
    // Quando: o cursor vai para a linha do negrito
    escolher(caixa, 2, 2);
    // Então
    expect(caixa.textContent).toContain('Levar o **RG**');
  });

  it('dado o negrito escondido numa linha, quando a pessoa aperta o mouse nela (o 1º clique de um clique duplo), então os sinais só aparecem depois do gesto, e o texto não anda debaixo do mouse', async () => {
    // Dado: o cursor fora do editor; a linha mostra "Contrato de honorarios assinado", sem os "**"
    render(<Nota inicial={'Contrato de **honorarios** assinado\nfim'} />);
    const caixa = await acharEditor();
    const v = editorDe(caixa);
    // Quando: o botão do mouse desce na 1ª linha e o cursor vai para "assinado" (como o clique põe)
    act(() => {
      fireEvent.mouseDown(caixa, { button: 0, detail: 1 });
      v.focus();
      v.dispatch({ selection: { anchor: 29 }, userEvent: 'select.pointer' });
    });
    // Então: enquanto o botão está apertado, os "**" continuam escondidos (o 2º clique cai na palavra que a pessoa viu)
    expect(caixa.textContent).not.toContain('**');
    // Quando: o botão sobe, e o 2º clique vem logo (o clique duplo escolhe "assinado")
    act(() => { fireEvent.mouseUp(window, { button: 0 }); });
    act(() => {
      fireEvent.mouseDown(caixa, { button: 0, detail: 2 });
      v.dispatch({ selection: { anchor: 27, head: 35 }, userEvent: 'select.pointer' });
      fireEvent.mouseUp(window, { button: 0 });
    });
    // Então: ainda escondidos logo depois do clique duplo…
    expect(caixa.textContent).not.toContain('**');
    // … e, acabado o gesto, aparecem na linha do cursor, para editar
    await waitFor(() => expect(caixa.textContent).toContain('Contrato de **honorarios** assinado'));
  });

  it('dado um gesto do mouse que acabou de escolher uma palavra, quando a pessoa tecla algo, então os sinais aparecem na hora', async () => {
    // Dado
    render(<Nota inicial={'Levar o **RG** hoje\nfim'} />);
    const caixa = await acharEditor();
    const v = editorDe(caixa);
    act(() => {
      fireEvent.mouseDown(caixa, { button: 0, detail: 1 });
      v.focus();
      v.dispatch({ selection: { anchor: 16 }, userEvent: 'select.pointer' });
      fireEvent.mouseUp(window, { button: 0 });
    });
    expect(caixa.textContent).not.toContain('**');
    // Quando
    act(() => { fireEvent.keyDown(caixa, { key: 'ArrowLeft' }); });
    // Então
    expect(caixa.textContent).toContain('Levar o **RG** hoje');
  });

  it('dada uma lista de tarefas, quando a pessoa clica na caixinha, então ela é marcada no texto, como no texto formatado', async () => {
    // Dado
    const aoMudar = vi.fn();
    render(<Nota inicial={'- [ ] Conferir o RG'} aoMudar={aoMudar} />);
    await acharEditor();
    // Quando
    fireEvent.mouseDown(screen.getByRole('checkbox', { name: 'Conferir o RG' }));
    // Então
    expect(aoMudar).toHaveBeenLastCalledWith('- [x] Conferir o RG');
    expect(screen.getByRole('checkbox', { name: 'Conferir o RG' })).toBeChecked();
  });

  it('dada uma lista de tarefas, quando a pessoa marca a caixinha pelo teclado (o Espaço com ela em foco), então ela é marcada no texto, como com o mouse', async () => {
    // Dado
    const aoMudar = vi.fn();
    render(<Nota inicial={'- [ ] Conferir o RG'} aoMudar={aoMudar} />);
    await acharEditor();
    // Quando
    act(() => { screen.getByRole('checkbox', { name: 'Conferir o RG' }).focus(); });
    await userEvent.keyboard(' ');
    // Então: marcada uma vez só
    expect(aoMudar).toHaveBeenCalledExactlyOnceWith('- [x] Conferir o RG');
    expect(screen.getByRole('checkbox', { name: 'Conferir o RG' })).toBeChecked();
  });

  it('dada uma caixinha marcada, quando o leitor de tela a aciona (só o clique, sem o mouse), então ela é desmarcada no texto', async () => {
    // Dado
    const aoMudar = vi.fn();
    render(<Nota inicial={'- [x] Conferir o RG'} aoMudar={aoMudar} />);
    await acharEditor();
    // Quando
    fireEvent.click(screen.getByRole('checkbox', { name: 'Conferir o RG' }));
    // Então
    expect(aoMudar).toHaveBeenCalledExactlyOnceWith('- [ ] Conferir o RG');
    expect(screen.getByRole('checkbox', { name: 'Conferir o RG' })).not.toBeChecked();
  });

  it('dada uma lista de tarefas, quando a pessoa clica na caixinha com o mouse (o botão apertado e o clique), então ela é marcada uma vez só', async () => {
    // Dado
    const aoMudar = vi.fn();
    render(<Nota inicial={'- [ ] Conferir o RG'} aoMudar={aoMudar} />);
    await acharEditor();
    // Quando: o mouse marca no mousedown; o clique que vem depois (detail 1) não marca de novo
    fireEvent.mouseDown(screen.getByRole('checkbox', { name: 'Conferir o RG' }), { button: 0, detail: 1 });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Conferir o RG' }), { button: 0, detail: 1 });
    // Então
    expect(aoMudar).toHaveBeenCalledExactlyOnceWith('- [x] Conferir o RG');
    expect(screen.getByRole('checkbox', { name: 'Conferir o RG' })).toBeChecked();
  });

  it('dado o cursor no fim de um item, quando a pessoa tecla Enter, então a linha nova já começa a lista', async () => {
    // Dado
    render(<Nota inicial="- RG" />);
    const caixa = await acharEditor();
    escolher(caixa, 4, 4);
    // Quando
    await userEvent.keyboard('{Enter}');
    // Então
    expect(textoDoEditor(caixa)).toBe('- RG\n- ');
  });

  it('dado o limite de tamanho, quando o que a pessoa cola passaria dele, então entra só o que cabe, como na caixa do navegador', async () => {
    // Dado
    const aoMudar = vi.fn();
    render(<Nota inicial="12345" maximo={6} aoMudar={aoMudar} />);
    const caixa = await acharEditor();
    // Quando
    escreverNoEditor(caixa, '6789');
    // Então
    expect(textoDoEditor(caixa)).toBe('123456');
    expect(aoMudar).toHaveBeenLastCalledWith('123456');
  });

  it('dado o texto no limite, quando a pessoa escreve mais uma letra, então ela não entra', async () => {
    // Dado
    const aoMudar = vi.fn();
    render(<Nota inicial="123456" maximo={6} aoMudar={aoMudar} />);
    const caixa = await acharEditor();
    // Quando
    escreverNoEditor(caixa, '7');
    // Então
    expect(textoDoEditor(caixa)).toBe('123456');
    expect(aoMudar).not.toHaveBeenCalled();
  });

  it('dado um texto gravado com quebras "\\r\\n", quando abre e a pessoa escreve, então não aparece linha a mais', async () => {
    // Dado
    const aoMudar = vi.fn();
    render(<Nota inicial={'Linha 1\r\n**Linha 2**\r\nLinha 3'} aoMudar={aoMudar} />);
    const caixa = await acharEditor();
    // Então: as mesmas três linhas
    expect(textoDoEditor(caixa)).toBe('Linha 1\n**Linha 2**\nLinha 3');
    // Quando
    escreverNoEditor(caixa, '!');
    // Então: o texto gravado tem as mesmas linhas, com "\n"
    expect(aoMudar).toHaveBeenLastCalledWith('Linha 1\n**Linha 2**\nLinha 3!');
  });

  it('dado que o React devolve o texto atrasado, quando a pessoa já digitou outra letra, então a letra nova fica onde estava', async () => {
    // Dado: quem usa guarda o texto, mas ainda desenha o de antes
    const aoMudar = vi.fn();
    const { rerender } = render(<EditorAoVivo rotulo="Texto" valor="a" aoMudar={aoMudar} />);
    const caixa = await acharEditor();
    escreverNoEditor(caixa, 'b');
    escreverNoEditor(caixa, 'c');
    // Quando: chega o "ab", atrasado (a pessoa já digitou o "c"), e depois o "abc"
    rerender(<EditorAoVivo rotulo="Texto" valor="ab" aoMudar={aoMudar} />);
    // Então: o "c" continua, com o cursor depois dele
    expect(textoDoEditor(caixa)).toBe('abc');
    expect(editorDe(caixa).state.selection.main.head).toBe(3);
    rerender(<EditorAoVivo rotulo="Texto" valor="abc" aoMudar={aoMudar} />);
    escreverNoEditor(caixa, 'd');
    expect(textoDoEditor(caixa)).toBe('abcd');
  });

  it('dado um texto mudado fora do editor (lido de novo), quando chega, então o editor o mostra sem avisar quem usa', async () => {
    // Dado
    const aoMudar = vi.fn();
    const { rerender } = render(<EditorAoVivo rotulo="Texto" valor="Levar RG" aoMudar={aoMudar} />);
    const caixa = await acharEditor();
    // Quando
    rerender(<EditorAoVivo rotulo="Texto" valor="Levar o RG" aoMudar={aoMudar} />);
    // Então
    expect(textoDoEditor(caixa)).toBe('Levar o RG');
    expect(aoMudar).not.toHaveBeenCalled();
  });

  it('dado "- [ ] Levar **RG**", quando aparece, então a caixinha se chama "Levar RG", como no texto formatado', async () => {
    // Quando
    render(<Nota inicial={'- [ ] Levar **RG**\n- [ ] '} />);
    await acharEditor();
    // Então
    expect(screen.getByRole('checkbox', { name: 'Levar RG' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Item sem texto' })).toBeInTheDocument();
  });

  it('dado um trecho escolhido num item, quando a pessoa tecla Enter, então o trecho sai e o item seguinte começa', async () => {
    // Dado
    render(<Nota inicial="- abcdef" />);
    const caixa = await acharEditor();
    escolher(caixa, 3, 6);
    // Quando
    await userEvent.keyboard('{Enter}');
    // Então
    expect(textoDoEditor(caixa)).toBe('- a\n- ef');
  });
});
