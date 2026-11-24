// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { acharEditor, editorDe, escreverNoEditor, textoDoEditor, trocarTextoDoEditor } from '../../testes/editorAoVivo';
import { Avisos } from '../avisos';
import { Janelas } from '../janela';
import { TextoEditavel } from './TextoEditavel';

const TEXTO = 'Levar a **procuração**.\n- [ ] Conferir o RG\n\nVeja [o tribunal](https://www.exemplo.jus.br).';

/** O texto num cartão: o que é salvo passa a ser o texto mostrado, e as caixinhas marcam sem abrir a edição. */
function Cartao({ inicial = TEXTO, aoSalvar = vi.fn(), aoMarcar = vi.fn(), rascunhos }: {
  inicial?: string; aoSalvar?: (t: string) => unknown; aoMarcar?: (t: string) => void; rascunhos?: (r: string | null) => void
}) {
  const [texto, setTexto] = useState(inicial);
  return <>
    <Avisos />
    <Janelas />
    <TextoEditavel texto={texto} aoMudarRascunho={rascunhos} aoMarcar={t => { setTexto(t); aoMarcar(t); }}
      aoSalvar={async t => { const r = await aoSalvar(t); if (r !== false) setTexto(t); return r; }} />
  </>;
}
/** A caixa aberta: desde a #433, o editor ao vivo das anotações, e não mais uma caixa de texto comum. */
const caixa = (nome = 'Texto') => acharEditor(nome);
/** O texto (o Markdown) na caixa aberta. */
const naCaixa = async (nome = 'Texto') => textoDoEditor(await caixa(nome));
const escrever = async (texto: string) => escreverNoEditor(await caixa(), texto);

describe('Texto que se muda no próprio lugar (#339)', () => {
  // Desde a #433, a caixa aberta é o editor das anotações (sem caixa com borda, a formatação à vista), e não mais a caixa de texto
  // comum com o Markdown à mostra: o teste segue a regra nova.
  it('dado quem pode alterar, quando clica no texto, então escreve ali mesmo, no editor das anotações, com a barra e sem o atalho escrito', async () => {
    // Dado
    render(<Cartao />);
    // Quando
    await userEvent.click(screen.getByText('procuração'));
    // Então: o mesmo Markdown, no editor ao vivo, com o foco nele
    const editor = await caixa();
    expect(textoDoEditor(editor)).toBe(TEXTO);
    expect(editor).toHaveFocus();
    expect(editor).toHaveAttribute('contenteditable', 'true');
    expect(screen.getByRole('toolbar', { name: 'Formatação do texto' })).toBeInTheDocument();
    expect(screen.queryByText('Ctrl+Enter salva')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('dado o texto em edição, quando a pessoa escreve e clica em Salvar, então salva o texto novo e volta a mostrá-lo formatado', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao inicial="Primeira versão" aoSalvar={aoSalvar} />);
    await userEvent.click(screen.getByText('Primeira versão'));
    // Quando
    trocarTextoDoEditor(await caixa(), 'Segunda **versão**');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    // Então
    expect(aoSalvar).toHaveBeenCalledWith('Segunda **versão**');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('versão').tagName).toBe('STRONG');
  });

  it('dado o texto em edição, quando a pessoa aperta Ctrl+Enter, então salva', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao inicial="Rascunho" aoSalvar={aoSalvar} />);
    await userEvent.click(screen.getByText('Rascunho'));
    await escrever(' final');
    // Quando
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    // Então
    expect(aoSalvar).toHaveBeenCalledWith('Rascunho final');
  });

  it('dado o texto em edição, quando a pessoa aperta Ctrl+S, como na anotação, então salva', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao inicial="Rascunho" aoSalvar={aoSalvar} />);
    await userEvent.click(screen.getByText('Rascunho'));
    await escrever(' final');
    // Quando
    await userEvent.keyboard('{Control>}s{/Control}');
    // Então
    expect(aoSalvar).toHaveBeenCalledWith('Rascunho final');
  });

  // Até a #433, o Cancelar apagava o que a pessoa escreveu sem perguntar (só o Esc perguntava). Desde a revisão da #433, o Cancelar
  // faz o mesmo que o Esc: com mudança, pergunta antes de descartar (regra nova).
  it('dado o texto em edição com mudança, quando a pessoa clica em Cancelar e escolhe descartar, então nada é salvo e o texto gravado volta', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao inicial="Como estava" aoSalvar={aoSalvar} />);
    await userEvent.click(screen.getByText('Como estava'));
    await escrever(' e o que não fica');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Descartar as mudanças?' })).getByRole('button', { name: 'Descartar' }));
    // Então
    expect(aoSalvar).not.toHaveBeenCalled();
    expect(screen.getByText('Como estava')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('dado o texto em edição com mudança, quando a pessoa clica em Cancelar e desiste de descartar, então o que ela escreveu fica', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao inicial="Com mudança" aoSalvar={aoSalvar} />);
    await userEvent.click(screen.getByText('Com mudança'));
    await escrever('!');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Descartar as mudanças?' })).getByRole('button', { name: 'Cancelar' }));
    // Então
    expect(await naCaixa()).toBe('Com mudança!');
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it('dado o texto em edição sem mudança, quando a pessoa aperta Esc, então a edição fecha, sem o Esc chegar ao cartão em volta', async () => {
    // Dado
    const cartaoFechou = vi.fn();
    const escNoCartao = (e: KeyboardEvent) => { if (e.key === 'Escape') cartaoFechou(); };
    document.addEventListener('keydown', escNoCartao);
    render(<Cartao inicial="Sem mudança" />);
    await userEvent.click(screen.getByText('Sem mudança'));
    await caixa();
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(cartaoFechou).not.toHaveBeenCalled();
    document.removeEventListener('keydown', escNoCartao);
  });

  // Até a #433, o Esc com mudança não fazia nada (a pessoa escolhia entre Salvar e Cancelar). Desde a #433, o Esc cancela, e pergunta
  // antes: o que a pessoa escreveu continua não se perdendo por engano (regra nova).
  it('dado o texto em edição com mudança, quando a pessoa aperta Esc, então pergunta antes; ao continuar, o que ela escreveu fica', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao inicial="Com mudança" aoSalvar={aoSalvar} />);
    await userEvent.click(screen.getByText('Com mudança'));
    await escrever('!');
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    const pergunta = await screen.findByRole('dialog', { name: 'Descartar as mudanças?' });
    // Quando: a pessoa desiste de descartar
    await userEvent.click(within(pergunta).getByRole('button', { name: 'Cancelar' }));
    // Então
    expect(await naCaixa()).toBe('Com mudança!');
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it('dado o texto em edição com mudança, quando a pessoa aperta Esc e escolhe descartar, então a edição fecha sem salvar e o texto gravado volta', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao inicial="Com mudança" aoSalvar={aoSalvar} />);
    await userEvent.click(screen.getByText('Com mudança'));
    await escrever(' que não fica');
    // Quando
    await userEvent.keyboard('{Escape}');
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Descartar as mudanças?' })).getByRole('button', { name: 'Descartar' }));
    // Então
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('Com mudança')).toBeInTheDocument();
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it('dado um link no texto, quando a pessoa clica nele, então o link abre e o texto não entra em edição', async () => {
    // Dado
    render(<Cartao />);
    const link = screen.getByRole('link', { name: 'o tribunal' });
    link.addEventListener('click', e => e.preventDefault());   // a página de teste não abre a aba nova
    // Quando
    await userEvent.click(link);
    // Então
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('dada uma caixinha de tarefa no texto, quando a pessoa a marca, então ela fica marcada e o texto não entra em edição', async () => {
    // Dado
    const aoMarcar = vi.fn();
    render(<Cartao aoMarcar={aoMarcar} />);
    // Quando
    await userEvent.click(screen.getByRole('checkbox', { name: 'Conferir o RG' }));
    // Então
    expect(aoMarcar).toHaveBeenCalledWith(TEXTO.replace('- [ ]', '- [x]'));
    expect(screen.getByRole('checkbox', { name: 'Conferir o RG' })).toBeChecked();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  // Desde a #385, o caminho do teclado é o próprio texto, e não mais o botão "Mudar o texto" (que saiu): o teste segue a regra nova.
  it('dado quem usa só o teclado, quando chega ao texto com Tab e tecla Enter, então a edição abre e, ao cancelar, o foco volta ao texto', async () => {
    // Dado
    render(<Cartao />);
    // Quando
    await userEvent.tab();
    // Então: o texto tem nome e diz como mudá-lo
    const texto = screen.getByRole('group', { name: 'Texto' });
    expect(texto).toHaveFocus();
    expect(texto).toHaveAccessibleDescription('Tecle Enter para mudar.');
    // Quando
    await userEvent.keyboard('{Enter}');
    // Então
    expect(await caixa()).toHaveFocus();
    expect(await naCaixa()).toBe(TEXTO);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    // Então
    await vi.waitFor(() => expect(screen.getByRole('group', { name: 'Texto' })).toHaveFocus());
  });

  it('dado quem usa só o teclado, quando salva o texto mudado, então o foco volta ao texto', async () => {
    // Dado
    render(<Cartao inicial="Antes" />);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await escrever(' e depois');
    // Quando
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    // Então
    await vi.waitFor(() => expect(screen.getByRole('group', { name: 'Texto' })).toHaveFocus());
    expect(screen.getByText('Antes e depois')).toBeInTheDocument();
  });

  it('dado um link no texto, quando a pessoa chega a ele com Tab e tecla Enter, então o texto não entra em edição', async () => {
    // Dado
    render(<Cartao />);
    const link = screen.getByRole('link', { name: 'o tribunal' });
    link.addEventListener('click', e => e.preventDefault());   // a página de teste não abre a aba nova
    // Quando
    link.focus();
    await userEvent.keyboard('{Enter}');
    // Então
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('dado quem pode alterar, quando o cartão abre, então não há botão para mudar o texto: o próprio texto abre a edição', () => {
    // Quando
    render(<Cartao />);
    // Então: nenhum botão (a caixinha de tarefa é uma caixa de marcar, não um botão)
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Texto' })).toBeInTheDocument();
  });

  it('dado quem usa só o teclado, quando abre o texto com Enter, então o cursor fica no fim, como quem continua a escrever', async () => {
    // Dado
    render(<Cartao inicial="Levar a procuração." />);
    await userEvent.tab();
    // Quando
    await userEvent.keyboard('{Enter}');
    // Então
    const editor = editorDe(await caixa());
    expect(editor.state.selection.main.head).toBe('Levar a procuração.'.length);
  });

  it('dado o texto vazio e quem pode escrever, quando clica no convite, então a caixa abre vazia', async () => {
    // Dado
    render(<Cartao inicial="" />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Clique para escrever.' }));
    // Então
    expect(await naCaixa()).toBe('');
    expect(await caixa()).toHaveFocus();
  });

  it('dada uma gravação que não deu certo, quando a pessoa salva, então a edição continua aberta com o que ela escreveu', async () => {
    // Dado
    render(<Cartao inicial="Antes" aoSalvar={() => false} />);
    await userEvent.click(screen.getByText('Antes'));
    await escrever(' e depois');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    // Então
    expect(await naCaixa()).toBe('Antes e depois');
  });

  it('dada uma gravação que falha, quando a pessoa salva, então o erro aparece e a edição continua aberta', async () => {
    // Dado
    render(<Cartao inicial="Antes" aoSalvar={() => Promise.reject(new Error('Sem conexão.'))} />);
    await userEvent.click(screen.getByText('Antes'));
    await escrever('!');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    // Então
    expect(await screen.findByText('Sem conexão.')).toBeInTheDocument();
    expect(await naCaixa()).toBe('Antes!');
  });

  it('quando a pessoa abre, escreve e cancela, então o cartão fica sabendo do rascunho a cada passo', async () => {
    // Dado
    const rascunhos = vi.fn();
    render(<Cartao inicial="A" rascunhos={rascunhos} />);
    // Quando
    await userEvent.click(screen.getByText('A'));
    await escrever('B');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    // (com mudança, o Cancelar pergunta antes; a pessoa descarta)
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Descartar as mudanças?' })).getByRole('button', { name: 'Descartar' }));
    // Então
    expect(rascunhos.mock.calls.map(([r]) => r)).toEqual(['A', 'AB', null]);
  });

  it('dado quem só lê, quando clica no texto, então nada vira campo e não há botão de editar', async () => {
    // Dado
    render(<TextoEditavel texto="Só para ler." vazio="Sem texto ainda." />);
    // Quando
    await userEvent.click(screen.getByText('Só para ler.'));
    // Então
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('dado quem só lê, quando usa o Tab, então o texto não recebe o foco nem diz como mudá-lo', async () => {
    // Dado
    render(<TextoEditavel texto="Só para ler." vazio="Sem texto ainda." />);
    // Quando
    await userEvent.tab();
    // Então
    expect(document.body).toHaveFocus();
    expect(screen.queryByRole('group', { name: 'Texto' })).not.toBeInTheDocument();
    expect(screen.queryByText('Tecle Enter para mudar.')).not.toBeInTheDocument();
  });

  it('dado quem só lê e o texto vazio, então aparece o aviso de vazio, sem convite para escrever', () => {
    // Dado / Quando
    render(<TextoEditavel texto="" vazio="Sem texto ainda." />);
    // Então
    expect(screen.getByText('Sem texto ainda.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('dado o texto em edição com mudança, quando a edição deixa de ser permitida (a anotação foi arquivada), então a caixa some e o cartão deixa de esperar o rascunho', async () => {
    // Dado
    const aoSalvar = vi.fn(), rascunhos = vi.fn();
    const { rerender } = render(<TextoEditavel texto="A" aoSalvar={aoSalvar} aoMudarRascunho={rascunhos} />);
    await userEvent.click(screen.getByText('A'));
    await escrever('B');
    // Quando
    rerender(<TextoEditavel texto="A" aoMudarRascunho={rascunhos} />);
    // Então
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(rascunhos).toHaveBeenLastCalledWith(null);
    // E, se voltar a poder (desarquivada), a caixa não volta aberta com o rascunho antigo
    rerender(<TextoEditavel texto="A" aoSalvar={aoSalvar} aoMudarRascunho={rascunhos} />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(aoSalvar).not.toHaveBeenCalled();
  });
});

describe('A barra de formatação já no texto lido, como na anotação (#433)', () => {
  it('dado quem pode alterar, quando o texto é lido, então a barra já está no lugar, só para ver: fora do Tab e do leitor de tela', async () => {
    // Quando
    render(<Cartao inicial="Levar a procuração." />);
    // Então: a barra está na tela, escondida do leitor de tela, e o Tab vai direto ao texto
    const barra = screen.getByRole('toolbar', { hidden: true });
    expect(barra).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    await userEvent.tab();
    expect(screen.getByRole('group', { name: 'Texto' })).toHaveFocus();
  });

  it('dado o texto lido, quando a pessoa aperta um botão da barra (Lista), então a edição abre e o botão já vale nela', async () => {
    // Dado
    render(<Cartao inicial="Levar a procuração." />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Lista', hidden: true }));
    // Então: o editor abre com o cursor no fim, e a linha virou item de lista
    const editor = await caixa();
    expect(editor).toHaveFocus();
    expect(textoDoEditor(editor)).toBe('- Levar a procuração.');
    expect(screen.getByRole('toolbar', { name: 'Formatação do texto' })).not.toHaveAttribute('aria-hidden');
  });

  it('dado o texto vazio, quando a pessoa clica na dica, então o editor abre vazio, com a dica de escrever, e a mesma barra', async () => {
    // Dado
    render(<Cartao inicial="" />);
    expect(screen.getByRole('toolbar', { hidden: true })).toBeInTheDocument();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Clique para escrever.' }));
    // Então
    expect(await naCaixa()).toBe('');
    expect(screen.getByText('Escreva aqui.')).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'Formatação do texto' })).toBeInTheDocument();
  });

  it('dado quem só lê, então não há barra nenhuma', () => {
    // Quando
    render(<TextoEditavel texto="Só para ler." />);
    // Então
    expect(screen.queryByRole('toolbar', { hidden: true })).not.toBeInTheDocument();
  });
});

describe('A descrição de um cartão, no mesmo jeito do texto (#346, #385)', () => {
  // Desde a #385, a descrição não tem mais o botão "Mudar a descrição": o nome próprio vai ao texto e à caixa (regra nova).
  it('dado um nome próprio (Descrição), quando a pessoa usa o teclado, então o texto e a caixa têm esse nome, e não há botão "Mudar"', async () => {
    // Dado
    render(<TextoEditavel texto="Pagar até sexta." rotulo="Descrição" aoSalvar={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Mudar/ })).not.toBeInTheDocument();
    // Quando
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    // Então
    expect(await naCaixa('Descrição')).toBe('Pagar até sexta.');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    // Então
    await vi.waitFor(() => expect(screen.getByRole('group', { name: 'Descrição' })).toHaveFocus());
  });
});
