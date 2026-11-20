// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DadosListas, DadosModelos, DadosSessao, ItemDaLista, ListaDoCartao } from '../dados';
import { Avisos } from '../ui/avisos';
import { iniciarPreferencias, lerPreferencia } from '../ui/preferencias';
import { ListasDoCartao } from './ListasDoCartao';

// A seção lê os checklists do cartão, renomeia o checklist e o item, marca e, ao abrir, guarda a preferência; o mock declara
// exatamente essas operações.
const { listasDoCartao, listaAtualizar, itemAtualizar, modelosListar, salvarPreferencia } = vi.hoisted(() => ({
  listasDoCartao: vi.fn<DadosListas['listasDoCartao']>(), listaAtualizar: vi.fn<DadosListas['listaAtualizar']>(async () => {}),
  itemAtualizar: vi.fn<DadosListas['itemAtualizar']>(), modelosListar: vi.fn<DadosModelos['modelosListar']>(async () => []),
  salvarPreferencia: vi.fn<DadosSessao['salvarPreferencia']>(async () => {})
}));
vi.mock('../dados', () => ({
  SD: { listasDoCartao, listaAtualizar, itemAtualizar, modelosListar, salvarPreferencia } satisfies
    Pick<DadosListas & DadosModelos & DadosSessao, 'listasDoCartao' | 'listaAtualizar' | 'itemAtualizar' | 'modelosListar' | 'salvarPreferencia'>
}));

const item = (id: string, texto: string): ItemDaLista => ({ id, texto, prazo: null, feito_em: null, feito_por: null, ordem: 1, grupo_id: null, criado_em: '' });
const checklist = (): ListaDoCartao => ({ id: 'l1', nome: 'Pessoa jurídica', ordem: 1, itens: [item('i1', 'Atos constitutivos'), item('i2', 'Quadro de sócios')], grupos: [] });
const montar = (somenteLer = false) =>
  render(<MemoryRouter><Avisos /><ListasDoCartao modulo="demandas" id="d1" somenteLer={somenteLer} /></MemoryRouter>);
const secao = () => screen.findByRole('region', { name: 'Checklist Pessoa jurídica' });

describe('Checklists no cartão (#358)', () => {
  beforeEach(() => {
    iniciarPreferencias({ 'demandas.cartao.listas': true });
    listasDoCartao.mockReset();
    listasDoCartao.mockResolvedValue([checklist()]);
    listaAtualizar.mockClear();
    itemAtualizar.mockReset();
    itemAtualizar.mockImplementation(async (id, campos) => ({ ...item(id, campos.texto ?? ''), ...campos } as ItemDaLista));
  });

  it('quando o cartão abre, então a seção se chama "Checklists" e o botão diz "Adicionar checklist"', async () => {
    // Quando
    montar();
    await secao();
    // Então
    expect(screen.getByRole('button', { name: /^Checklists/ })).toBeInTheDocument();
    // O botão de baixo mostra o nome; desde a #390, o "+" do título tem o mesmo nome (para o leitor de tela), só com o ícone.
    expect(screen.getByText('Adicionar checklist', { selector: 'button' })).toBeInTheDocument();
    expect(within(screen.getByRole('heading', { name: /^Checklists/ })).getByRole('button', { name: 'Adicionar checklist' })).toBeInTheDocument();
    expect(screen.queryByText(/Listas|Adicionar lista/)).not.toBeInTheDocument();
  });

  it('dado um checklist, quando a pessoa olha o nome e um item, então cada um diz que se renomeia com um clique, e o "⋯" de cada um abre o menu', async () => {
    // Quando
    montar();
    const lista = await secao();
    // Então
    expect(within(lista).getByRole('heading', { name: 'Pessoa jurídica', level: 4 })).toBeInTheDocument();
    expect(within(lista).getByRole('button', { name: 'Pessoa jurídica' })).toHaveAttribute('title', 'Clique para renomear');
    expect(within(lista).getByRole('button', { name: 'Atos constitutivos' })).toHaveAttribute('title', 'Clique para renomear');
    expect(within(lista).getByRole('button', { name: 'Ações do checklist Pessoa jurídica' })).toHaveAttribute('aria-haspopup', 'menu');
    // Quando
    await userEvent.click(within(lista).getByRole('button', { name: 'Ações do item Atos constitutivos' }));
    // Então: o menu muda de lugar e exclui; o botão fica marcado como aberto (e à vista)
    const menu = screen.getByRole('menu', { name: 'Ações do item Atos constitutivos' });
    expect(within(menu).getAllByRole('menuitem').map(b => b.textContent?.trim())).toEqual(['Data de entrega', 'Descer', 'Excluir item']);
    expect(within(lista).getByRole('button', { name: 'Ações do item Atos constitutivos' })).toHaveAttribute('aria-expanded', 'true');
    // Quando
    await userEvent.keyboard('{Escape}');
    await userEvent.click(within(lista).getByRole('button', { name: 'Ações do checklist Pessoa jurídica' }));
    // Então: o menu do checklist (o único do cartão, sem subir nem descer) salva como modelo e exclui; renomear é no próprio nome
    const doChecklist = screen.getByRole('menu', { name: 'Ações do checklist Pessoa jurídica' });
    expect(within(doChecklist).getAllByRole('menuitem').map(b => b.textContent?.trim())).toEqual(['Salvar como modelo', 'Excluir checklist']);
    expect(within(lista).getByRole('button', { name: 'Ações do checklist Pessoa jurídica' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('dado um checklist, quando a pessoa clica no nome, escreve outro e aperta Enter, então ele é gravado pela mesma função de dados e aparece na hora', async () => {
    // Dado
    montar();
    const lista = await secao();
    // Quando
    await userEvent.click(within(lista).getByRole('button', { name: 'Pessoa jurídica' }));
    const campo = within(lista).getByRole('textbox', { name: 'Nome do checklist' });
    await userEvent.clear(campo);
    listasDoCartao.mockResolvedValue([{ ...checklist(), nome: 'Documentos da empresa' }]);
    await userEvent.type(campo, 'Documentos da empresa{Enter}');
    // Então
    await vi.waitFor(() => expect(listaAtualizar).toHaveBeenCalledWith('l1', { nome: 'Documentos da empresa' }));
    expect(await screen.findByRole('region', { name: 'Checklist Documentos da empresa' })).toBeInTheDocument();
  });

  it('dado um item, quando a pessoa clica no texto e o muda, então o item é gravado com o texto novo, e a caixa continua marcando à parte', async () => {
    // Dado
    montar();
    const lista = await secao();
    // Quando
    await userEvent.click(within(lista).getByRole('button', { name: 'Quadro de sócios' }));
    const campo = within(lista).getByRole('textbox', { name: 'Texto do item' });
    await userEvent.clear(campo);
    const [atos] = checklist().itens;
    listasDoCartao.mockResolvedValue([{ ...checklist(), itens: [atos, item('i2', 'Quadro societário atualizado')] }]);
    await userEvent.type(campo, 'Quadro societário atualizado{Enter}');
    // Então
    await vi.waitFor(() => expect(itemAtualizar).toHaveBeenCalledWith('i2', { texto: 'Quadro societário atualizado' }));
    expect(within(lista).getByRole('checkbox', { name: 'Quadro societário atualizado' })).not.toBeChecked();
    // Quando
    await userEvent.click(within(lista).getByRole('checkbox', { name: 'Atos constitutivos' }));
    // Então
    expect(itemAtualizar).toHaveBeenCalledWith('i1', { feito: true });
  });

  it('dado dois itens renomeados em seguida, quando a recarga do primeiro volta por último, então o texto novo do segundo continua na tela', async () => {
    // Dado
    const [atos, quadro] = checklist().itens;
    let soltarPrimeira: (l: ListaDoCartao[]) => void = () => {};
    listasDoCartao
      .mockResolvedValueOnce([checklist()])
      .mockReturnValueOnce(new Promise(r => { soltarPrimeira = r; }))
      .mockResolvedValueOnce([{ ...checklist(), itens: [{ ...atos, texto: 'Contrato social' }, { ...quadro, texto: 'Quadro societário' }] }]);
    montar();
    const lista = await secao();
    // Quando: renomeia o primeiro e, antes de a recarga dele voltar, o segundo
    await userEvent.click(within(lista).getByRole('button', { name: 'Atos constitutivos' }));
    await userEvent.clear(within(lista).getByRole('textbox', { name: 'Texto do item' }));
    await userEvent.type(within(lista).getByRole('textbox', { name: 'Texto do item' }), 'Contrato social{Enter}');
    await vi.waitFor(() => expect(listasDoCartao).toHaveBeenCalledTimes(2));
    await userEvent.click(within(lista).getByRole('button', { name: 'Quadro de sócios' }));
    await userEvent.clear(within(lista).getByRole('textbox', { name: 'Texto do item' }));
    await userEvent.type(within(lista).getByRole('textbox', { name: 'Texto do item' }), 'Quadro societário{Enter}');
    await vi.waitFor(() => expect(listasDoCartao).toHaveBeenCalledTimes(3));
    // e a recarga do primeiro chega por último, ainda com o texto antigo do segundo
    await act(async () => { soltarPrimeira([{ ...checklist(), itens: [{ ...atos, texto: 'Contrato social' }, quadro] }]); });
    // Então
    expect(within(lista).getByRole('button', { name: 'Quadro societário' })).toBeInTheDocument();
    expect(within(lista).getByRole('button', { name: 'Contrato social' })).toBeInTheDocument();
    expect(within(lista).queryByRole('button', { name: 'Quadro de sócios' })).not.toBeInTheDocument();
  });

  it('dado um item em edição, quando a pessoa apaga o texto e sai do campo, então nada é gravado e o aviso diz por quê', async () => {
    // Dado
    montar();
    const lista = await secao();
    await userEvent.click(within(lista).getByRole('button', { name: 'Quadro de sócios' }));
    // Quando
    await userEvent.clear(within(lista).getByRole('textbox', { name: 'Texto do item' }));
    await userEvent.tab();
    // Então
    expect(await screen.findByText('O item não pode ficar em branco.')).toBeInTheDocument();
    expect(itemAtualizar).not.toHaveBeenCalled();
    expect(within(lista).getByRole('button', { name: 'Quadro de sócios' })).toBeInTheDocument();
  });

  it('dado quem só lê, quando abre o checklist, então o nome e os itens não viram campo e não há "⋯"', async () => {
    // Quando
    montar(true);
    const lista = await secao();
    // Então
    expect(within(lista).getByRole('heading', { name: 'Pessoa jurídica', level: 4 })).toBeInTheDocument();
    expect(within(lista).queryByRole('button')).not.toBeInTheDocument();
    expect(within(lista).getByRole('checkbox', { name: 'Atos constitutivos' })).toBeDisabled();
  });
});

describe('O "+" do título dos checklists (#390)', () => {
  beforeEach(() => {
    listasDoCartao.mockReset();
    listasDoCartao.mockResolvedValue([checklist()]);
  });
  const doTitulo = () => within(screen.getByRole('heading', { name: /^Checklists/ })).queryByRole('button', { name: 'Adicionar checklist' });

  it('dada a seção fechada, quando a pessoa clica no "+" do título, então a seção abre com o menu de "Adicionar checklist", preso ao "+", e a escolha guardada não muda', async () => {
    // Dado
    iniciarPreferencias({ 'demandas.cartao.listas': false });
    montar();
    // Quando
    await userEvent.click(doTitulo()!);
    // Então
    const menu = await screen.findByRole('menu', { name: 'Adicionar checklist' });
    expect(within(menu).getByRole('menuitem', { name: 'Checklist em branco' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Checklists/ })).toHaveAttribute('aria-expanded', 'true');
    expect(lerPreferencia('demandas.cartao.listas', true)).toBe(false);
    // Quando: o Esc fecha o menu e devolve o foco a quem o abriu
    await userEvent.keyboard('{Escape}');
    // Então
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(doTitulo()).toHaveFocus();
  });

  it('dado o "+" do título, quando o leitor de tela chega a ele, então sabe que ele abre um menu', () => {
    // Quando
    iniciarPreferencias({});
    montar();
    // Então
    expect(doTitulo()).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('dado quem só lê, quando a seção aparece, então não há "+" no título', async () => {
    // Dado
    iniciarPreferencias({ 'demandas.cartao.listas': true });
    // Quando
    montar(true);
    await secao();
    // Então
    expect(doTitulo()).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adicionar checklist' })).not.toBeInTheDocument();
  });
});
