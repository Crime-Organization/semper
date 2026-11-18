// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Avisos } from '../avisos';
import { TextoEditavel } from './TextoEditavel';

const TEXTO = 'Levar a **procuração**.\n- [ ] Conferir o RG\n\nVeja [o tribunal](https://www.exemplo.jus.br).';

/** O texto num cartão: o que é salvo passa a ser o texto mostrado, e as caixinhas marcam sem abrir a edição. */
function Cartao({ inicial = TEXTO, aoSalvar = vi.fn(), aoMarcar = vi.fn(), rascunhos }: {
  inicial?: string; aoSalvar?: (t: string) => unknown; aoMarcar?: (t: string) => void; rascunhos?: (r: string | null) => void
}) {
  const [texto, setTexto] = useState(inicial);
  return <>
    <Avisos />
    <TextoEditavel texto={texto} aoMudarRascunho={rascunhos} aoMarcar={t => { setTexto(t); aoMarcar(t); }}
      aoSalvar={async t => { const r = await aoSalvar(t); if (r !== false) setTexto(t); return r; }} />
  </>;
}
const caixa = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Texto' });

describe('Texto que se muda no próprio lugar (#339)', () => {
  it('dado quem pode alterar, quando clica no texto, então ele vira a caixa de escrever ali mesmo, com o Markdown como foi escrito', async () => {
    // Dado
    render(<Cartao />);
    // Quando
    await userEvent.click(screen.getByText('procuração'));
    // Então
    expect(caixa()).toHaveValue(TEXTO);
    expect(caixa()).toHaveFocus();
    expect(screen.getByRole('toolbar', { name: 'Formatação do texto' })).toBeInTheDocument();
    expect(screen.queryByText('procuração')).not.toBeInTheDocument();
  });

  it('dado o texto em edição, quando a pessoa escreve e clica em Salvar, então salva o texto novo e volta a mostrá-lo formatado', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao inicial="Primeira versão" aoSalvar={aoSalvar} />);
    await userEvent.click(screen.getByText('Primeira versão'));
    // Quando
    await userEvent.clear(caixa());
    await userEvent.type(caixa(), 'Segunda **versão**');
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
    await userEvent.type(caixa(), ' final');
    // Quando
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    // Então
    expect(aoSalvar).toHaveBeenCalledWith('Rascunho final');
  });

  it('dado o texto em edição, quando a pessoa clica em Cancelar, então nada é salvo e o texto gravado volta', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao inicial="Como estava" aoSalvar={aoSalvar} />);
    await userEvent.click(screen.getByText('Como estava'));
    await userEvent.type(caixa(), ' e o que não fica');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    // Então
    expect(aoSalvar).not.toHaveBeenCalled();
    expect(screen.getByText('Como estava')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('dado o texto em edição sem mudança, quando a pessoa aperta Esc, então a edição fecha, sem o Esc chegar ao cartão em volta', async () => {
    // Dado
    const cartaoFechou = vi.fn();
    const escNoCartao = (e: KeyboardEvent) => { if (e.key === 'Escape') cartaoFechou(); };
    document.addEventListener('keydown', escNoCartao);
    render(<Cartao inicial="Sem mudança" />);
    await userEvent.click(screen.getByText('Sem mudança'));
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(cartaoFechou).not.toHaveBeenCalled();
    document.removeEventListener('keydown', escNoCartao);
  });

  it('dado o texto em edição com mudança, quando a pessoa aperta Esc, então o que ela escreveu não se perde', async () => {
    // Dado
    render(<Cartao inicial="Com mudança" />);
    await userEvent.click(screen.getByText('Com mudança'));
    await userEvent.type(caixa(), '!');
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(caixa()).toHaveValue('Com mudança!');
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

  it('dado o teclado, quando a pessoa usa o botão "Mudar o texto", então a edição abre e, ao cancelar, o foco volta ao botão', async () => {
    // Dado
    render(<Cartao />);
    // Quando
    screen.getByRole('button', { name: 'Mudar o texto' }).focus();
    await userEvent.keyboard('{Enter}');
    // Então
    expect(caixa()).toHaveFocus();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    // Então
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Mudar o texto' })).toHaveFocus());
  });

  it('dado o texto vazio e quem pode escrever, quando clica no convite, então a caixa abre vazia', async () => {
    // Dado
    render(<Cartao inicial="" />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Clique para escrever.' }));
    // Então
    expect(caixa()).toHaveValue('');
  });

  it('dada uma gravação que não deu certo, quando a pessoa salva, então a edição continua aberta com o que ela escreveu', async () => {
    // Dado
    render(<Cartao inicial="Antes" aoSalvar={() => false} />);
    await userEvent.click(screen.getByText('Antes'));
    await userEvent.type(caixa(), ' e depois');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    // Então
    expect(caixa()).toHaveValue('Antes e depois');
  });

  it('dada uma gravação que falha, quando a pessoa salva, então o erro aparece e a edição continua aberta', async () => {
    // Dado
    render(<Cartao inicial="Antes" aoSalvar={() => Promise.reject(new Error('Sem conexão.'))} />);
    await userEvent.click(screen.getByText('Antes'));
    await userEvent.type(caixa(), '!');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    // Então
    expect(await screen.findByText('Sem conexão.')).toBeInTheDocument();
    expect(caixa()).toHaveValue('Antes!');
  });

  it('quando a pessoa abre, escreve e cancela, então o cartão fica sabendo do rascunho a cada passo', async () => {
    // Dado
    const rascunhos = vi.fn();
    render(<Cartao inicial="A" rascunhos={rascunhos} />);
    // Quando
    await userEvent.click(screen.getByText('A'));
    await userEvent.type(caixa(), 'B');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
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
    await userEvent.type(caixa(), 'B');
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
