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
/**
 * Escreve no lugar do cursor (ou por cima do trecho escolhido), como o teclado ("input.type") ou o Ctrl+V ("input.paste"),
 * uma letra de cada vez, para o editor tratar cada uma.
 */
function digitar(caixa: HTMLElement, texto: string, evento = 'input.type') {
  const v = editorDe(caixa);
  for (const letra of evento === 'input.paste' ? [texto] : texto.split('')) act(() => {
    const { from, to } = v.state.selection.main;
    v.dispatch({ changes: { from, to, insert: letra }, selection: { anchor: from + letra.length }, userEvent: evento });
  });
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

  // A regra mudou (#368, pedido do dono): antes, os sinais apareciam na linha do cursor; agora a formatação fica sempre desenhada.
  it('dado um negrito, um título e um item, quando o cursor vai para cada linha, então os sinais continuam escondidos', async () => {
    // Dado
    render(<Nota inicial={'## Pendências\nLevar o **RG**\n- https://site.com/Cap_1_-_Livro.pdf'} />);
    const caixa = await acharEditor();
    // Quando: o cursor passa pelo título, pelo negrito e pelo item
    for (const posicao of [5, 22, 40]) {
      escolher(caixa, posicao, posicao);
      // Então
      expect(caixa).toHaveTextContent('PendênciasLevar o RGhttps://site.com/Cap_1_-_Livro.pdf');
      expect(caixa.textContent).not.toContain('**');
      expect(caixa.textContent).not.toContain('## ');
      expect(caixa.textContent).not.toContain('- ');
    }
  });

  it('dado o cursor no começo do texto de um item, quando a pessoa tecla Backspace, então a bolinha sai e o texto fica', async () => {
    // Dado
    const aoMudar = vi.fn();
    render(<Nota inicial={'Levar:\n- Procuração'} aoMudar={aoMudar} />);
    const caixa = await acharEditor();
    escolher(caixa, 9, 9);
    // Quando
    await userEvent.keyboard('{Backspace}');
    // Então
    expect(aoMudar).toHaveBeenLastCalledWith('Levar:\nProcuração');
    expect(editorDe(caixa).state.selection.main.head).toBe(7);
  });

  it('dado o cursor logo depois de um negrito, quando a pessoa tecla Backspace, então sai a última letra, e o resto continua em negrito', async () => {
    // Dado
    render(<Nota inicial="Levar o **RG**" />);
    const caixa = await acharEditor();
    escolher(caixa, 14, 14);
    // Quando
    await userEvent.keyboard('{Backspace}');
    // Então
    expect(textoDoEditor(caixa)).toBe('Levar o **R**');
    expect(caixa.textContent).not.toContain('**');
  });

  it('dado o cursor logo depois de um negrito, quando a pessoa digita, então a letra entra no negrito, sem os "**" aparecerem', async () => {
    // Dado
    render(<Nota inicial="Levar o **contrato**" />);
    const caixa = await acharEditor();
    // Quando
    escreverNoEditor(caixa, 's');
    // Então
    expect(textoDoEditor(caixa)).toBe('Levar o **contratos**');
    expect(caixa).toHaveTextContent('Levar o contratos');
  });

  it('dada uma linha vazia, quando a pessoa clica em Negrito e digita "RG", então "RG" sai em negrito, sem divisória e sem "*" à mostra', async () => {
    // Dado
    render(<Nota inicial={'Pendências\n'} />);
    const caixa = await acharEditor();
    escolher(caixa, 11, 11);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Negrito (Ctrl+B)' }));
    // Então: nada entra no texto antes de a pessoa escrever
    expect(textoDoEditor(caixa)).toBe('Pendências\n');
    // Quando
    digitar(caixa, 'RG');
    // Então
    expect(textoDoEditor(caixa)).toBe('Pendências\n**RG**');
    expect(caixa).toHaveTextContent('PendênciasRG');
    expect(caixa.textContent).not.toContain('*');
  });

  it('dado o cursor logo depois de um negrito, quando a pessoa aperta Ctrl+B e digita " hoje", então " hoje" sai sem negrito, sem "****" no texto', async () => {
    // Dado
    render(<Nota inicial="Levar o **RG**" />);
    const caixa = await acharEditor();
    escolher(caixa, 14, 14);
    // Quando
    await userEvent.keyboard('{Control>}b{/Control}');
    digitar(caixa, ' hoje');
    // Então
    expect(textoDoEditor(caixa)).toBe('Levar o **RG** hoje');
    expect(caixa).toHaveTextContent('Levar o RG hoje');
    expect(caixa.textContent).not.toContain('*');
  });

  it('dado o texto todo de um item escolhido junto com a bolinha, quando a pessoa cola um link novo, então a bolinha continua', async () => {
    // Dado
    render(<Nota inicial="- https://velho.com" />);
    const caixa = await acharEditor();
    escolher(caixa, 19, 0);   // do fim para o começo, como o Shift+Home
    // Quando
    digitar(caixa, 'https://novo.com/Cap_1_-_Livro.pdf', 'input.paste');
    // Então
    expect(textoDoEditor(caixa)).toBe('- https://novo.com/Cap_1_-_Livro.pdf');
    expect(screen.getByRole('img', { name: 'Item da lista' })).toBeInTheDocument();
  });

  it('dado um título, uma citação e um item, quando aparecem, então o leitor de tela diz o que cada linha é, sem letras a mais na tela', async () => {
    // Quando
    render(<Nota inicial={'## Pendências\n> Nota\n- RG'} />);
    const caixa = await acharEditor();
    // Então
    expect(screen.getByRole('img', { name: 'Título 2' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Citação' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Item da lista' })).toBeInTheDocument();
    expect(caixa).toHaveTextContent(/^PendênciasNotaRG$/);
  });

  it('dado o cursor no começo de um item, quando a pessoa tecla Backspace, então o leitor de tela avisa que o item foi tirado', async () => {
    // Dado
    render(<Nota inicial={'Levar:\n- Procuração'} />);
    const caixa = await acharEditor();
    escolher(caixa, 9, 9);
    // Quando
    await userEvent.keyboard('{Backspace}');
    // Então
    expect(screen.getByText('Item de lista tirado')).toBeInTheDocument();
  });

  it('dado um clique antes da bolinha de um item, quando o cursor vai para lá, então ele fica no começo do texto do item', async () => {
    // Dado
    render(<Nota inicial={'Antes\n- RG'} />);
    const caixa = await acharEditor();
    // Quando
    escolher(caixa, 6, 6);
    // Então: o que a pessoa digitar entra no item, e não antes do "- "
    expect(editorDe(caixa).state.selection.main.head).toBe(8);
  });

  it('dado o cursor no fim de uma palavra em negrito, quando a pessoa tecla a seta para a direita, então ele passa os "**" escondidos e anda uma letra', async () => {
    // Dado
    render(<Nota inicial="**RG** hoje" />);
    const caixa = await acharEditor();
    escolher(caixa, 4, 4);
    // Quando
    await userEvent.keyboard('{ArrowRight}');
    // Então: depois do espaço (sem parar, sem nada mudar na tela, entre o "G" e os "**")
    expect(editorDe(caixa).state.selection.main.head).toBe(7);
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
