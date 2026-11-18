// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Avisos } from '../avisos';
import { janela, Janelas } from '../janela';
import { TituloEditavel } from './TituloEditavel';

/** O título num cartão: o que é salvo passa a ser o título mostrado, como no cartão da anotação. */
function Cartao({ inicial = 'Plano do caso', aoSalvar = vi.fn(), conferir, rascunhos }: {
  inicial?: string; aoSalvar?: (t: string) => unknown; conferir?: (t: string) => string; rascunhos?: (r: string | null) => void
}) {
  const [valor, setValor] = useState(inicial);
  return <>
    <Avisos />
    <TituloEditavel valor={valor} conferir={conferir} aoMudarRascunho={rascunhos}
      aoSalvar={t => { setValor(t); return aoSalvar(t); }} />
    <button type="button">Outro lugar</button>
  </>;
}
const titulo = () => screen.getByRole('heading', { level: 2 });
const campo = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Título' });

describe('Título que se muda no próprio lugar (#339)', () => {
  it('dado quem pode alterar, quando clica no título, então ele vira um campo ali mesmo, dentro do título, com o texto dele', async () => {
    // Dado
    render(<Cartao />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Plano do caso' }));
    // Então
    expect(campo()).toHaveValue('Plano do caso');
    expect(campo()).toHaveFocus();
    expect(titulo()).toContainElement(campo());
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });

  it('dado o título em edição, quando a pessoa escreve e aperta Enter, então salva só o título novo, sem os espaços das pontas, e o campo some', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Plano do caso' }));
    // Quando
    await userEvent.clear(campo());
    await userEvent.type(campo(), '  Plano novo  {Enter}');
    // Então
    await vi.waitFor(() => expect(aoSalvar).toHaveBeenCalledWith('Plano novo'));
    expect(aoSalvar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(titulo()).toHaveTextContent('Plano novo');
  });

  it('dado o título em edição, quando a pessoa sai do campo, então o que escreveu é salvo', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Plano do caso' }));
    await userEvent.type(campo(), ' revisto');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Outro lugar' }));
    // Então
    await vi.waitFor(() => expect(aoSalvar).toHaveBeenCalledWith('Plano do caso revisto'));
    expect(aoSalvar).toHaveBeenCalledTimes(1);
  });

  it('dado o título em edição, quando a pessoa aperta Esc, então desfaz: nada é salvo, o título volta e o Esc não chega ao cartão em volta', async () => {
    // Dado
    const aoSalvar = vi.fn(), cartaoFechou = vi.fn();
    const escNoCartao = (e: KeyboardEvent) => { if (e.key === 'Escape') cartaoFechou(); };
    document.addEventListener('keydown', escNoCartao);
    render(<Cartao aoSalvar={aoSalvar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Plano do caso' }));
    await userEvent.type(campo(), ' que não fica');
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(titulo()).toHaveTextContent(/^Plano do caso$/);
    expect(aoSalvar).not.toHaveBeenCalled();
    expect(cartaoFechou).not.toHaveBeenCalled();
    document.removeEventListener('keydown', escNoCartao);
  });

  it('dado o título apagado, quando a pessoa aperta Enter, então não salva, avisa e o campo continua aberto', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} conferir={t => t.trim() ? '' : 'Dê um título à anotação.'} />);
    await userEvent.click(screen.getByRole('button', { name: 'Plano do caso' }));
    await userEvent.clear(campo());
    // Quando
    await userEvent.keyboard('{Enter}');
    // Então
    expect(await screen.findByText('Dê um título à anotação.')).toBeInTheDocument();
    expect(aoSalvar).not.toHaveBeenCalled();
    expect(campo()).toHaveValue('');
  });

  it('dado o título apagado, quando a pessoa sai do campo, então não salva, avisa e o título gravado volta', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Plano do caso' }));
    await userEvent.clear(campo());
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Outro lugar' }));
    // Então
    expect(await screen.findByText('O título não pode ficar em branco.')).toBeInTheDocument();
    expect(aoSalvar).not.toHaveBeenCalled();
    expect(titulo()).toHaveTextContent('Plano do caso');
  });

  it('dado o título igual ao gravado, quando a pessoa aperta Enter, então nada é gravado', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Plano do caso' }));
    // Quando
    await userEvent.keyboard('{Enter}');
    // Então
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it('quando a pessoa entra, escreve e sai da edição, então o cartão fica sabendo do rascunho a cada passo', async () => {
    // Dado
    const rascunhos = vi.fn();
    render(<Cartao rascunhos={rascunhos} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Plano do caso' }));
    await userEvent.type(campo(), '!');
    await userEvent.keyboard('{Escape}');
    // Então
    expect(rascunhos.mock.calls.map(([r]) => r)).toEqual(['Plano do caso', 'Plano do caso!', null]);
  });

  it('dado quem só lê, quando clica no título, então nada vira campo', async () => {
    // Dado
    render(<TituloEditavel valor="Plano do caso" />);
    // Quando
    await userEvent.click(titulo());
    // Então
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(titulo()).toHaveTextContent('Plano do caso');
  });

  it('dada uma gravação que falha, quando a pessoa salva, então o erro aparece no pé da tela', async () => {
    // Dado
    render(<Cartao aoSalvar={() => Promise.reject(new Error('Sem conexão.'))} />);
    await userEvent.click(screen.getByRole('button', { name: 'Plano do caso' }));
    await userEvent.type(campo(), ' 2');
    // Quando
    await act(async () => { await userEvent.keyboard('{Enter}'); });
    // Então
    expect(await screen.findByText('Sem conexão.')).toBeInTheDocument();
  });

  it('dado o título em edição, quando a pessoa cola um texto com quebra de linha, então a quebra vira um espaço: o título é uma linha só', async () => {
    // Dado
    render(<Cartao inicial="Ata" />);
    await userEvent.click(screen.getByRole('button', { name: 'Ata' }));
    // Quando
    await userEvent.paste(' da reunião\ncom o cliente');
    // Então
    expect(campo()).toHaveValue('Ata da reunião com o cliente');
  });

  it('dado o título em edição, quando a pessoa aperta Enter, então o campo some e o foco volta ao título', async () => {
    // Dado
    render(<Cartao />);
    await userEvent.click(screen.getByRole('button', { name: 'Plano do caso' }));
    await userEvent.type(campo(), ' novo');
    // Quando
    await userEvent.keyboard('{Enter}');
    // Então
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Plano do caso novo' })).toHaveFocus());
  });

  it('dado o título em edição, quando a pessoa aperta Esc, então o campo some e o foco volta ao título', async () => {
    // Dado
    render(<Cartao />);
    await userEvent.click(screen.getByRole('button', { name: 'Plano do caso' }));
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Plano do caso' })).toHaveFocus());
  });

  it('dado o título mudado, quando uma janela abre por cima e leva o foco (a pergunta "Sair sem salvar?"), então nada é salvo e o título continua em edição', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<><Cartao aoSalvar={aoSalvar} /><Janelas /></>);
    await userEvent.click(screen.getByRole('button', { name: 'Plano do caso' }));
    await userEvent.type(campo(), ' revisto');
    // Quando
    let resposta!: Promise<boolean | null>;
    act(() => { resposta = janela<boolean>({ titulo: 'Sair sem salvar?', acoes: [{ rotulo: 'Continuar no cadastro', valor: false }] }); });
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Continuar no cadastro' })).toHaveFocus());
    // Então: a resposta decide; ao continuar, o foco volta ao campo, com o que a pessoa escreveu
    expect(aoSalvar).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Continuar no cadastro' }));
    expect(await resposta).toBe(false);
    expect(campo()).toHaveValue('Plano do caso revisto');
    await vi.waitFor(() => expect(campo()).toHaveFocus());
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it('dado o título em edição, quando a edição deixa de ser permitida (a anotação foi arquivada), então o campo some e o cartão deixa de esperar o rascunho', async () => {
    // Dado
    const aoSalvar = vi.fn(), rascunhos = vi.fn();
    const { rerender } = render(<TituloEditavel valor="Plano do caso" aoSalvar={aoSalvar} aoMudarRascunho={rascunhos} />);
    await userEvent.click(screen.getByRole('button', { name: 'Plano do caso' }));
    await userEvent.type(campo(), ' revisto');
    // Quando
    rerender(<TituloEditavel valor="Plano do caso" aoMudarRascunho={rascunhos} />);
    // Então
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(rascunhos).toHaveBeenLastCalledWith(null);
    // E, se voltar a poder, o título volta como botão, sem o rascunho antigo
    rerender(<TituloEditavel valor="Plano do caso" aoSalvar={aoSalvar} aoMudarRascunho={rascunhos} />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Plano do caso' })).toBeInTheDocument();
    expect(aoSalvar).not.toHaveBeenCalled();
  });
});
