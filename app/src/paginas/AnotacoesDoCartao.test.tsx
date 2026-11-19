// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnotacaoLigada, AnotacaoParaLigar, DadosAnotacoes, DadosSessao } from '../dados';
import { ITENS_DA_ANOTACAO } from '../dados/limites';
import { Avisos, desfazerUltimo, sinalizarMudanca } from '../ui/avisos';
import { iniciarPreferencias } from '../ui/preferencias';
import { AnotacoesDoCartao, JA_ESTAVA_LIGADA, preferenciaDasAnotacoes } from './AnotacoesDoCartao';

// A seção lê as anotações do item (sem o texto, para o número; com ele, só aberta), busca as que se podem ligar, liga (e desfaz) e,
// ao abrir, guarda a preferência; o mock declara exatamente essas operações. A leitura com o texto devolve as mesmas da leitura
// leve, cada uma com o texto que o caso põe em `textos`.
const textos = vi.hoisted((): Record<string, string> => ({}));
const { anotacoesDoItem, anotacoesDoItemComTexto, anotacoesParaLigar, anotacaoLigar, anotacaoDesligar, salvarPreferencia } = vi.hoisted(() => ({
  anotacoesDoItem: vi.fn<DadosAnotacoes['anotacoesDoItem']>(), anotacoesDoItemComTexto: vi.fn<DadosAnotacoes['anotacoesDoItemComTexto']>(),
  anotacoesParaLigar: vi.fn<DadosAnotacoes['anotacoesParaLigar']>(),
  anotacaoLigar: vi.fn<DadosAnotacoes['anotacaoLigar']>(async () => true), anotacaoDesligar: vi.fn<DadosAnotacoes['anotacaoDesligar']>(async () => {}),
  salvarPreferencia: vi.fn<DadosSessao['salvarPreferencia']>(async () => {})
}));
vi.mock('../dados', () => ({
  SD: { anotacoesDoItem, anotacoesDoItemComTexto, anotacoesParaLigar, anotacaoLigar, anotacaoDesligar, salvarPreferencia } satisfies
    Pick<DadosAnotacoes & DadosSessao, 'anotacoesDoItem' | 'anotacoesDoItemComTexto' | 'anotacoesParaLigar' | 'anotacaoLigar' | 'anotacaoDesligar' | 'salvarPreferencia'>
}));
// O módulo Documentos está ligado no escritório, salvo quando o caso diz que não.
const sessao = vi.hoisted(() => ({ anotacoes: true }));
vi.mock('../ui/sessao', () => ({ useCtx: () => ({ perfil: { id: 'u-mateus' }, equipe: [{ id: 'u-mateus', nome: 'Mateus Freitas Gonçalves' }], ehAdmin: false, escritorio: { modulos: { anotacoes: sessao.anotacoes } } }) }));

const ligada = (id: string, titulo: string, campos: Partial<AnotacaoLigada> = {}): AnotacaoLigada => ({
  id, codigo: 'C-' + id, titulo, criado_por: 'u-mateus', criado_em: '2026-11-10T12:00:00Z', atualizado_em: '2026-11-16T12:00:00Z', arquivado_em: null, ...campos
});
const paraLigar = (id: string, titulo: string, itens = 1): AnotacaoParaLigar => ({ id, codigo: 'C-' + id, titulo, atualizado_em: '2026-11-16T12:00:00Z', itens });
const montar = (props: Partial<Parameters<typeof AnotacoesDoCartao>[0]> = {}) =>
  render(<MemoryRouter><AnotacoesDoCartao modulo="demandas" id="d1" {...props} /></MemoryRouter>);
const titulo = () => screen.getByRole('button', { name: /^Anotações/ });

describe('Anotações no cartão de um item', () => {
  beforeEach(() => {
    iniciarPreferencias({});
    sessao.anotacoes = true;
    anotacoesDoItem.mockReset();
    anotacoesDoItem.mockResolvedValue([ligada('a1', 'Estratégia da defesa'), ligada('a2', 'Ata antiga', { arquivado_em: '2026-11-12T12:00:00Z' })]);
    Object.keys(textos).forEach(k => delete textos[k]);
    anotacoesDoItemComTexto.mockReset();
    anotacoesDoItemComTexto.mockImplementation(async (modulo, id) => (await anotacoesDoItem(modulo, id)).map(a => ({ ...a, texto: textos[a.id] ?? '' })));
    anotacoesParaLigar.mockReset();
    anotacoesParaLigar.mockResolvedValue([paraLigar('a7', 'Parecer sobre a prescrição'), paraLigar('a8', 'Resumo cheio', ITENS_DA_ANOTACAO)]);
    anotacaoLigar.mockClear();
    anotacaoDesligar.mockClear();
  });

  it('quando a pessoa liga uma anotação existente achada pelo código, então ela é ligada a este item, a seção mostra na hora e o aviso desfaz (#341)', async () => {
    // Dado
    iniciarPreferencias({ [preferenciaDasAnotacoes('processos')]: true });
    montar({ modulo: 'processos', id: 'pr9' });
    await screen.findByRole('list', { name: 'Anotações ligadas' });
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Ligar anotação existente' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Buscar anotação para ligar' }), 'C-a7');
    await vi.waitFor(() => expect(anotacoesParaLigar).toHaveBeenLastCalledWith('processos', 'pr9', 'C-a7'));
    // Então: quem vê o processo passa a ler a anotação, e a busca avisa antes
    expect(screen.getByText('Quem vê este processo passa a ler a anotação que você ligar.')).toBeInTheDocument();
    // Quando
    anotacoesDoItem.mockResolvedValue([ligada('a7', 'Parecer sobre a prescrição'), ligada('a1', 'Estratégia da defesa')]);
    await userEvent.click(await screen.findByRole('button', { name: /Parecer sobre a prescrição/ }));
    // Então
    expect(anotacaoLigar).toHaveBeenCalledWith('a7', 'processos', 'pr9');
    const lista = screen.getByRole('list', { name: 'Anotações ligadas' });
    expect(await within(lista).findByRole('link', { name: /Parecer sobre a prescrição/ })).toHaveAttribute('href', '/documentos/?id=a7');
    // Quando
    desfazerUltimo();
    // Então
    await vi.waitFor(() => expect(anotacaoDesligar).toHaveBeenCalledWith('a7', 'processos', 'pr9'));
  });

  it('dada uma anotação que outra pessoa ligou ao item enquanto a busca estava aberta, quando a pessoa a escolhe, então o aviso diz que já estava ligada e não oferece Desfazer (#341)', async () => {
    // Dado: o banco não grava nada, porque a ligação já existe
    anotacaoLigar.mockResolvedValueOnce(false);
    iniciarPreferencias({ [preferenciaDasAnotacoes('demandas')]: true });
    render(<MemoryRouter><Avisos /><AnotacoesDoCartao modulo="demandas" id="d1" /></MemoryRouter>);
    await userEvent.click(await screen.findByRole('button', { name: 'Ligar anotação existente' }));
    // Quando
    await userEvent.click(await screen.findByRole('button', { name: /Parecer sobre a prescrição/ }));
    // Então
    const avisos = screen.getByRole('status');
    expect(await within(avisos).findByText(JA_ESTAVA_LIGADA)).toBeInTheDocument();
    expect(within(avisos).queryByText(/Anotação ligada/)).not.toBeInTheDocument();
    expect(within(avisos).queryByRole('button', { name: 'Desfazer' })).not.toBeInTheDocument();
    // E o Ctrl+Z não desliga a anotação que a outra pessoa ligou
    desfazerUltimo();
    await vi.waitFor(() => expect(within(avisos).getByText(/Desfeito|Não há ação para desfazer/)).toBeInTheDocument());
    expect(anotacaoDesligar).not.toHaveBeenCalledWith('a7', 'demandas', 'd1');
  });

  it('dada uma anotação que já tem o máximo de itens, quando a busca abre, então ela aparece desabilitada com o motivo (#341)', async () => {
    // Dado
    iniciarPreferencias({ [preferenciaDasAnotacoes('demandas')]: true });
    montar();
    // Quando
    await userEvent.click(await screen.findByRole('button', { name: 'Ligar anotação existente' }));
    // Então
    const cheia = await screen.findByRole('button', { name: /Resumo cheio/ });
    expect(cheia).toBeDisabled();
    expect(cheia).toHaveTextContent(`Já está ligada a ${ITENS_DA_ANOTACAO} itens, o máximo.`);
    expect(screen.getByRole('button', { name: /Parecer sobre a prescrição/ })).toBeEnabled();
  });

  it('então a seção aberta oferece "Ligar anotação existente" e "Nova anotação"; no cartão só para ler, nenhum dos dois (#341)', async () => {
    // Dado / Quando
    iniciarPreferencias({ [preferenciaDasAnotacoes('pessoas')]: true });
    const { unmount } = montar({ modulo: 'pessoas', id: 'p1' });
    await screen.findByRole('list', { name: 'Anotações ligadas' });
    // Então: a pessoa não abre a anotação, e a busca não tem o que avisar
    expect(screen.getByRole('link', { name: 'Nova anotação' })).toHaveAttribute('href', '/documentos/nova/?pessoa=p1');
    await userEvent.click(screen.getByRole('button', { name: 'Ligar anotação existente' }));
    expect(await screen.findByRole('button', { name: /Parecer sobre a prescrição/ })).toBeInTheDocument();
    expect(screen.queryByText(/passa a ler a anotação/)).not.toBeInTheDocument();
    unmount();
    // Quando
    montar({ modulo: 'pessoas', id: 'p1', somenteLer: true });
    await screen.findByRole('list', { name: 'Anotações ligadas' });
    // Então
    expect(screen.queryByRole('button', { name: 'Ligar anotação existente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Nova anotação' })).not.toBeInTheDocument();
  });

  it('quando o cartão abre, então a seção vem fechada e já mostra quantas anotações estão ligadas ao item', async () => {
    // Quando
    montar();
    // Então
    await vi.waitFor(() => expect(titulo()).toHaveTextContent('2'));
    expect(titulo()).toHaveAttribute('aria-expanded', 'false');
    expect(anotacoesDoItem).toHaveBeenCalledWith('demandas', 'd1');
    // E o texto das anotações, que pode ser longo, não é lido com a seção fechada (#360)
    expect(anotacoesDoItemComTexto).not.toHaveBeenCalled();
  });

  it('dada a seção fechada, quando a pessoa a abre, então só aí o texto das anotações é lido, e cada uma mostra o começo dele (#360)', async () => {
    // Dado
    textos.a1 = 'Ouvir as testemunhas.';
    montar();
    await vi.waitFor(() => expect(titulo()).toHaveTextContent('2'));
    // Quando
    await userEvent.click(titulo());
    // Então
    expect(anotacoesDoItemComTexto).toHaveBeenCalledWith('demandas', 'd1');
    const lista = await screen.findByRole('list', { name: 'Anotações ligadas' });
    expect(within(lista).getByRole('link', { name: 'Abrir a anotação Estratégia da defesa' })).toHaveTextContent('Ouvir as testemunhas.');
  });

  it('dada a preferência de antes da #360 com a seção aberta, quando o cartão abre, então ela vem fechada, como na coluna para todos', async () => {
    // Dado: antes, a seção ficava no corpo do cartão, com outra chave
    iniciarPreferencias({ 'demandas.cartao.anotacoes': true });
    // Quando
    montar();
    // Então
    await vi.waitFor(() => expect(titulo()).toHaveTextContent('2'));
    expect(titulo()).toHaveAttribute('aria-expanded', 'false');
    expect(anotacoesDoItemComTexto).not.toHaveBeenCalled();
  });

  it('quando a pessoa abre a seção, então cada anotação abre o cartão dela em Documentos, e a arquivada vem marcada', async () => {
    // Dado
    montar();
    await vi.waitFor(() => expect(titulo()).toHaveTextContent('2'));
    // Quando
    await userEvent.click(titulo());
    // Então
    const lista = screen.getByRole('list', { name: 'Anotações ligadas' });
    expect(within(lista).getByRole('link', { name: /Estratégia da defesa/ })).toHaveAttribute('href', '/documentos/?id=a1');
    expect(within(lista).getByRole('link', { name: /Ata antiga/ })).toHaveTextContent('Arquivada');
  });

  it('então o "+" leva ao cadastro de anotação já ligada ao item; no cartão só para ler, ele não aparece', async () => {
    // Dado / Quando
    const { unmount } = montar({ modulo: 'processos', id: 'pr9' });
    // Então
    expect(screen.getByRole('link', { name: 'Nova anotação ligada a este item' })).toHaveAttribute('href', '/documentos/nova/?processo=pr9');
    unmount();
    // Quando
    montar({ somenteLer: true });
    // Então
    await vi.waitFor(() => expect(titulo()).toHaveTextContent('2'));
    expect(screen.queryByRole('link', { name: 'Nova anotação ligada a este item' })).not.toBeInTheDocument();
  });

  it('dada uma anotação com um texto longo, quando a seção abre, então ela aparece como um comentário: quem a escreveu, o título e só o começo do texto, sem os sinais do Markdown (#360)', async () => {
    // Dado
    const texto = ['# Linha do tempo', 'Juntar a **procuração** até sexta.', '- Pedir o RG', '- Conferir o CPF', 'Parte que não aparece'].join('\n');
    anotacoesDoItem.mockResolvedValue([ligada('a1', 'Estratégia da defesa')]);
    textos.a1 = texto;
    iniciarPreferencias({ [preferenciaDasAnotacoes('demandas')]: true });
    // Quando
    montar();
    // Então: o link que abre a anotação se chama pelo título; quem escreveu, quando mudou, o código e o começo do texto o descrevem
    const anotacao = await within(await screen.findByRole('list', { name: 'Anotações ligadas' })).findByRole('link', { name: 'Abrir a anotação Estratégia da defesa' });
    expect(anotacao).toHaveAttribute('href', '/documentos/?id=a1');
    expect(anotacao).toHaveAccessibleDescription(/^Mateus Freitas Gonçalves Atualizada .+ C-a1 Linha do tempo/);
    expect(anotacao).toHaveTextContent('Mateus Freitas Gonçalves');
    expect(anotacao).toHaveTextContent(/Atualizada \S/);
    expect(within(anotacao).getByText('Linha do tempo\nJuntar a procuração até sexta.\nPedir o RG…', { normalizer: t => t })).toBeInTheDocument();
    expect(anotacao).not.toHaveTextContent('Conferir o CPF');
    expect(anotacao).not.toHaveTextContent('**');
  });

  it('dada uma anotação sem texto, quando a seção abre, então ela aparece só com o título', async () => {
    // Dado
    anotacoesDoItem.mockResolvedValue([ligada('a1', 'Estratégia da defesa')]);
    iniciarPreferencias({ [preferenciaDasAnotacoes('demandas')]: true });
    // Quando
    montar();
    // Então
    const anotacao = await within(await screen.findByRole('list', { name: 'Anotações ligadas' })).findByRole('link', { name: /Estratégia da defesa/ });
    expect(within(anotacao).getByText('Estratégia da defesa')).toBeInTheDocument();
    expect(anotacao.textContent).not.toContain('…');
  });

  it('dada uma anotação sem ninguém marcado como quem a escreveu, quando a seção abre, então ela diz "Sem autor", e não "Usuário removido"', async () => {
    // Dado: uma sem autor e uma de quem saiu da equipe
    anotacoesDoItem.mockResolvedValue([ligada('a1', 'Estratégia da defesa', { criado_por: null }), ligada('a2', 'Ata antiga', { criado_por: 'u-saiu' })]);
    iniciarPreferencias({ [preferenciaDasAnotacoes('demandas')]: true });
    // Quando
    montar();
    // Então
    const lista = await screen.findByRole('list', { name: 'Anotações ligadas' });
    const semAutor = within(lista).getByRole('link', { name: 'Abrir a anotação Estratégia da defesa' });
    expect(semAutor).toHaveAccessibleDescription(/^Sem autor /);
    expect(semAutor).not.toHaveTextContent('Usuário removido');
    expect(within(lista).getByRole('link', { name: 'Abrir a anotação Ata antiga' })).toHaveAccessibleDescription(/^Usuário removido /);
  });

  it('dado o item sem anotações, quando a seção abre, então ela diz que não há nenhuma', async () => {
    // Dado
    anotacoesDoItem.mockResolvedValue([]);
    iniciarPreferencias({ [preferenciaDasAnotacoes('tarefas')]: true });
    // Quando
    montar({ modulo: 'tarefas', id: 't1' });
    // Então
    expect(await screen.findByText('Nenhuma anotação ligada a esta tarefa.')).toBeInTheDocument();
  });

  it('quando algo muda (a janela do cadastro fechou), então a seção lê de novo e o número acompanha', async () => {
    // Dado
    montar();
    await vi.waitFor(() => expect(titulo()).toHaveTextContent('2'));
    anotacoesDoItem.mockResolvedValue([ligada('a3', 'Nova'), ligada('a1', 'Estratégia da defesa'), ligada('a2', 'Ata antiga')]);
    // Quando
    sinalizarMudanca();
    // Então
    await vi.waitFor(() => expect(titulo()).toHaveTextContent('3'));
  });

  it('dado o módulo Documentos desligado no escritório, então a seção não aparece nem lê nada', () => {
    // Dado
    sessao.anotacoes = false;
    // Quando
    montar();
    // Então
    expect(screen.queryByRole('button', { name: /^Anotações/ })).not.toBeInTheDocument();
    expect(anotacoesDoItem).not.toHaveBeenCalled();
  });
});
