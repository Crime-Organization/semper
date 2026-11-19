// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { acharEditor, escreverNoEditor, textoDoEditor, trocarTextoDoEditor } from '../../testes/editorAoVivo';
import { Avisos } from '../avisos';
import { ESPERA_PARA_SALVAR } from '../tempos';
import { EditorDeTexto, type ControleDoEditor } from './EditorDeTexto';

/** A anotação: o que é gravado passa a ser o texto dela. */
function Anotacao({ inicial = 'Levar a procuração.', aoSalvar = vi.fn(), soLe = false, rascunhos, controle, conferir }: {
  inicial?: string; aoSalvar?: (t: string) => unknown; soLe?: boolean; rascunhos?: (r: string | null) => void;
  controle?: React.RefObject<ControleDoEditor | null>; conferir?: (t: string) => string
}) {
  const [texto, setTexto] = useState(inicial);
  return <>
    <Avisos />
    <EditorDeTexto texto={texto} aoMudarRascunho={rascunhos} controle={controle} conferir={conferir} vazio={<p>Sem texto ainda.</p>}
      aoSalvar={soLe ? undefined : async t => { const r = await aoSalvar(t); if (r !== false) setTexto(t); return r; }} />
  </>;
}
const situacao = () => screen.getByRole('status', { name: 'Gravação do texto' });
/** Escreve no fim do texto do editor ao vivo (veja testes/editorAoVivo.ts), depois de ele chegar. */
const escrever = async (texto: string) => escreverNoEditor(await acharEditor(), texto);

afterEach(() => { vi.useRealTimers(); });

describe('O texto que já abre em edição e salva sozinho (a anotação, como no Obsidian)', () => {
  it('dado quem pode alterar, quando a anotação abre, então o texto já está na caixa de escrever, com a barra de formatação, e "Salvo"', async () => {
    // Quando
    render(<Anotacao />);
    // Então
    expect(textoDoEditor(await acharEditor())).toBe('Levar a procuração.');
    expect(screen.getByRole('toolbar', { name: 'Formatação do texto' })).toBeInTheDocument();
    expect(situacao()).toHaveTextContent('Salvo');
  });

  it('dada uma mudança, quando a pessoa para de digitar por um tempo, então o texto é gravado sozinho, uma vez, e volta a dizer "Salvo"', async () => {
    // Dado: o editor já chegou (ele é baixado à parte) quando o relógio passa a ser o do teste
    const aoSalvar = vi.fn();
    render(<Anotacao aoSalvar={aoSalvar} />);
    const caixa = await acharEditor();
    vi.useFakeTimers();
    // Quando: a pessoa troca o texto
    trocarTextoDoEditor(caixa, 'Levar a procuração e o RG.');
    expect(situacao()).toHaveTextContent('Alterações por salvar');
    await act(async () => { vi.advanceTimersByTime(ESPERA_PARA_SALVAR - 1); });
    expect(aoSalvar).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1); });
    // Então
    expect(aoSalvar).toHaveBeenCalledExactlyOnceWith('Levar a procuração e o RG.');
    expect(situacao()).toHaveTextContent('Salvo');
  });

  it('dada uma mudança, quando a pessoa aperta Ctrl+S, então grava na hora, sem esperar a pausa', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Anotacao aoSalvar={aoSalvar} />);
    await escrever(' Hoje.');
    // Quando
    await userEvent.keyboard('{Control>}s{/Control}');
    // Então
    expect(aoSalvar).toHaveBeenCalledExactlyOnceWith('Levar a procuração. Hoje.');
  });

  it('dada uma mudança, quando a pessoa sai da caixa, então o texto é gravado', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<><Anotacao aoSalvar={aoSalvar} /><button type="button">Outra coisa</button></>);
    await escrever('!');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Outra coisa' }));
    // Então
    expect(aoSalvar).toHaveBeenCalledExactlyOnceWith('Levar a procuração.!');
  });

  it('dada uma gravação que falhou, então o texto continua na caixa, a linha diz que não foi salvo, e o rascunho continua por salvar', async () => {
    // Dado
    const rascunhos = vi.fn();
    render(<Anotacao aoSalvar={() => Promise.reject(new Error('Sem conexão.'))} rascunhos={rascunhos} />);
    await escrever('!');
    // Quando
    await userEvent.keyboard('{Control>}s{/Control}');
    // Então
    expect(textoDoEditor(await acharEditor())).toBe('Levar a procuração.!');
    expect(await screen.findByText('Sem conexão.')).toBeInTheDocument();
    expect(situacao()).toHaveTextContent('Não foi salvo');
    expect(rascunhos).toHaveBeenLastCalledWith('Levar a procuração.!');
  });

  it('dado um texto que a regra recusa, quando a pessoa aperta Ctrl+S, então o aviso diz por quê e nada é gravado', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Anotacao aoSalvar={aoSalvar} conferir={t => t.includes('#') ? 'Sem cerquilha.' : ''} />);
    await escrever(' #');
    // Quando
    await userEvent.keyboard('{Control>}s{/Control}');
    // Então
    expect(await screen.findByText('Sem cerquilha.')).toBeInTheDocument();
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it('dada uma mudança ainda na pausa, quando quem usa pede para gravar antes de sair, então grava e diz que ficou tudo gravado', async () => {
    // Dado
    const aoSalvar = vi.fn();
    const controle = createRef<ControleDoEditor>();
    const rascunhos = vi.fn();
    render(<Anotacao aoSalvar={aoSalvar} controle={controle} rascunhos={rascunhos} />);
    await escrever('!');
    expect(rascunhos).toHaveBeenLastCalledWith('Levar a procuração.!');
    // Quando
    let ok = false;
    await act(async () => { ok = await controle.current!.salvar(); });
    // Então
    expect(ok).toBe(true);
    expect(aoSalvar).toHaveBeenCalledExactlyOnceWith('Levar a procuração.!');
    expect(rascunhos).toHaveBeenLastCalledWith(null);
  });

  it('quando o texto é gravado, então quem usa recebe também o texto gravado de que a pessoa partiu (para a trava otimista)', async () => {
    // Dado
    const aoSalvar = vi.fn(async () => true);
    render(<EditorDeTexto texto="Levar a procuração." aoSalvar={aoSalvar} />);
    await escrever('!');
    // Quando
    await userEvent.keyboard('{Control>}s{/Control}');
    // Então
    expect(aoSalvar).toHaveBeenCalledExactlyOnceWith('Levar a procuração.!', 'Levar a procuração.');
  });

  it('dado que outra pessoa mudou o texto gravado, quando a gravação para, então a linha diz isso e pede a escolha, e não "Não foi salvo"', async () => {
    // Dado: quem usa achou o conflito e não gravou
    render(<EditorDeTexto texto="Levar a procuração." aoSalvar={async () => false} conflito />);
    await escrever('!');
    // Quando
    await userEvent.keyboard('{Control>}s{/Control}');
    // Então
    expect(situacao()).toHaveTextContent('Outra pessoa mudou esta anotação. Escolha qual texto fica.');
    expect(textoDoEditor(await acharEditor())).toBe('Levar a procuração.!');
  });

  // A regra mudou (pedido do dono de 18/11): sem o modo de ler (o livro), a caixinha se marca no próprio editor ao vivo, e o texto
  // marcado é gravado como o resto, sozinho.
  it('dada uma lista de tarefas, quando a pessoa clica na caixinha no editor, então ela fica marcada e, depois da pausa, o texto marcado é gravado sozinho', async () => {
    // Dado: o editor já chegou quando o relógio passa a ser o do teste
    const aoSalvar = vi.fn();
    render(<Anotacao inicial={'- [ ] Conferir o RG'} aoSalvar={aoSalvar} />);
    await acharEditor();
    vi.useFakeTimers();
    // Quando
    fireEvent.mouseDown(screen.getByRole('checkbox', { name: 'Conferir o RG' }));
    await act(async () => { vi.advanceTimersByTime(ESPERA_PARA_SALVAR); });
    // Então
    expect(screen.getByRole('checkbox', { name: 'Conferir o RG' })).toBeChecked();
    expect(aoSalvar).toHaveBeenCalledExactlyOnceWith('- [x] Conferir o RG');
  });

  it('dada uma lista de tarefas, quando a pessoa marca a caixinha sem o mouse (o teclado ou o leitor de tela), então, depois da pausa, o texto marcado é gravado sozinho', async () => {
    // Dado: o editor já chegou quando o relógio passa a ser o do teste
    const aoSalvar = vi.fn();
    render(<Anotacao inicial={'- [ ] Conferir o RG'} aoSalvar={aoSalvar} />);
    await acharEditor();
    vi.useFakeTimers();
    // Quando: o Espaço com a caixinha em foco (ou o leitor de tela) manda só o clique, sem o mouse (o Espaço de verdade está no
    // teste do EditorAoVivo, com o relógio de verdade)
    act(() => { screen.getByRole('checkbox', { name: 'Conferir o RG' }).focus(); });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Conferir o RG' }));
    await act(async () => { vi.advanceTimersByTime(ESPERA_PARA_SALVAR); });
    // Então
    expect(screen.getByRole('checkbox', { name: 'Conferir o RG' })).toBeChecked();
    expect(aoSalvar).toHaveBeenCalledExactlyOnceWith('- [x] Conferir o RG');
  });

  it('dado quem só lê, então vê o texto formatado, sem caixa, e o texto vazio vira o aviso de vazio', () => {
    // Quando
    const { unmount } = render(<Anotacao soLe />);
    // Então
    expect(screen.getByText('Levar a procuração.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    unmount();
    render(<Anotacao soLe inicial="" />);
    expect(screen.getByText('Sem texto ainda.')).toBeInTheDocument();
  });
});
