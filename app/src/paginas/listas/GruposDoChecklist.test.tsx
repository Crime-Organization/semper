// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Checklists com grupos e subgrupos numerados no cartão (#309), pela seção de checklists inteira (<ListasDoCartao>).
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartaoComListas, DadosListas, DadosModelos, DadosSessao, GrupoDaLista, ItemDaLista, ListaDoCartao } from '../../dados';
import { aplicarPosicoes, NAO_CABE_NO_GRUPO, NIVEIS_DEMAIS, semOGrupo } from '../../regras/gruposDaLista';
import { Avisos } from '../../ui/avisos';
import { Janelas } from '../../ui/janela';
import { iniciarPreferencias } from '../../ui/preferencias';
import { ListasDoCartao } from '../ListasDoCartao';

// Um banco de mentira, só deste checklist: lê, marca, cria, exclui e grava as posições, como o de verdade.
let atual: ListaDoCartao;
let seq = 0;
const { listasDoCartao, itemAtualizar, itemCriar, itemExcluir, grupoDoChecklistCriar, grupoDoChecklistExcluir, listaReordenar, modelosListar, salvarPreferencia } = vi.hoisted(() => ({
  listasDoCartao: vi.fn<DadosListas['listasDoCartao']>(), itemAtualizar: vi.fn<DadosListas['itemAtualizar']>(), itemCriar: vi.fn<DadosListas['itemCriar']>(),
  itemExcluir: vi.fn<DadosListas['itemExcluir']>(), grupoDoChecklistCriar: vi.fn<DadosListas['grupoDoChecklistCriar']>(),
  grupoDoChecklistExcluir: vi.fn<DadosListas['grupoDoChecklistExcluir']>(), listaReordenar: vi.fn<DadosListas['listaReordenar']>(),
  modelosListar: vi.fn<DadosModelos['modelosListar']>(async () => []), salvarPreferencia: vi.fn<DadosSessao['salvarPreferencia']>(async () => {})
}));
vi.mock('../../dados', () => ({
  SD: { listasDoCartao, itemAtualizar, itemCriar, itemExcluir, grupoDoChecklistCriar, grupoDoChecklistExcluir, listaReordenar, modelosListar, salvarPreferencia } satisfies
    Pick<DadosListas & DadosModelos & DadosSessao, 'listasDoCartao' | 'itemAtualizar' | 'itemCriar' | 'itemExcluir' | 'grupoDoChecklistCriar' | 'grupoDoChecklistExcluir'
      | 'listaReordenar' | 'modelosListar' | 'salvarPreferencia'>
}));

const grupo = (id: string, nome: string, pai_id: string | null, ordem: number): GrupoDaLista => ({ id, nome, pai_id, ordem, criado_em: '' });
const item = (id: string, texto: string, grupo_id: string | null, ordem: number): ItemDaLista =>
  ({ id, texto, prazo: null, feito_em: null, feito_por: null, ordem, grupo_id, criado_em: '' });
// O exemplo do dono, com a Procuração solta no fim: 1. Documentos pessoais › 1.1 RG, 1.2 CPF; 2. Benefício › 2.1 Aposentadoria
// por idade › 2.1.1 CNIS, 2.1.2 Carteira de trabalho; 2.2 Auxílio-doença › 2.2.1 Laudo médico; 3. Procuração.
const exemplo = (): ListaDoCartao => ({
  id: 'l1', nome: 'Benefício previdenciário', ordem: 1,
  grupos: [grupo('g1', 'Documentos pessoais', null, 1), grupo('g2', 'Benefício', null, 4), grupo('g3', 'Aposentadoria por idade', 'g2', 5), grupo('g4', 'Auxílio-doença', 'g2', 8)],
  itens: [item('rg', 'RG', 'g1', 2), item('cpf', 'CPF', 'g1', 3), item('cnis', 'CNIS', 'g3', 6), item('ctps', 'Carteira de trabalho', 'g3', 7),
    item('laudo', 'Laudo médico', 'g4', 9), item('proc', 'Procuração', null, 10)]
});
const montar = (modulo: CartaoComListas = 'demandas', somenteLer = false) =>
  render(<MemoryRouter><Avisos /><Janelas /><ListasDoCartao modulo={modulo} id="c1" somenteLer={somenteLer} /></MemoryRouter>);
const secao = () => screen.findByRole('region', { name: 'Checklist Benefício previdenciário' });
/** Se a linha é um grupo (tem o botão que abre e fecha). */
const ehGrupo = (li: HTMLElement) => within(li).queryAllByRole('button', { name: /^(Fechar|Abrir) o grupo/ }).length > 0;
/** O texto de cada linha (o item, ou a cabeça do grupo: o que vem antes do que está dentro dele), na ordem da tela. */
const linhas = (lista: HTMLElement) => within(lista).getAllByRole('listitem').map(li =>
  (ehGrupo(li) ? li.firstElementChild! : li).textContent!.replace(/\s+/g, ' ').trim());

describe('Grupos e numeração do checklist (#309)', () => {
  beforeEach(() => {
    iniciarPreferencias({ 'demandas.cartao.listas': true, 'contratos.cartao.listas': true });
    atual = exemplo();
    seq = 0;
    listasDoCartao.mockReset().mockImplementation(async () => [structuredClone(atual)]);
    itemAtualizar.mockReset().mockImplementation(async (id, { feito, ...campos }) => {
      atual = { ...atual, itens: atual.itens.map(i => i.id === id ? { ...i, ...campos, ...(feito === undefined ? {} : { feito_em: feito ? 'agora' : null }) } : i) };
      return atual.itens.find(i => i.id === id)!;
    });
    itemCriar.mockReset().mockImplementation(async (_lista, texto, onde) => {
      const novo = item(`novo${++seq}`, texto, onde?.pai_id ?? null, onde?.ordem ?? 99);
      atual = { ...atual, itens: [...atual.itens, novo] };
      return novo;
    });
    itemExcluir.mockReset().mockImplementation(async id => { atual = { ...atual, itens: atual.itens.filter(i => i.id !== id) }; });
    grupoDoChecklistCriar.mockReset().mockImplementation(async (_lista, nome, onde) => {
      const novo = grupo(`grupo${++seq}`, nome, onde.pai_id, onde.ordem);
      atual = { ...atual, grupos: [...atual.grupos, novo] };
      return novo;
    });
    grupoDoChecklistExcluir.mockReset().mockImplementation(async id => { atual = { ...atual, ...semOGrupo(atual, id) }; });
    listaReordenar.mockReset().mockImplementation(async (_lista, posicoes) => { atual = { ...atual, ...aplicarPosicoes(atual, posicoes) }; });
  });

  it('dado o exemplo do dono, quando a seção abre, então os grupos, subgrupos e itens aparecem numerados, com a contagem de cada grupo', async () => {
    // Quando
    montar();
    const lista = await secao();
    // Então
    expect(linhas(lista)).toEqual(['1. Documentos pessoais 0 de 2 feitos', '1.1 RG', '1.2 CPF', '2. Benefício 0 de 3 feitos', '2.1 Aposentadoria por idade 0 de 2 feitos',
      '2.1.1 CNIS', '2.1.2 Carteira de trabalho', '2.2 Auxílio-doença 0 de 1 feito', '2.2.1 Laudo médico', '3. Procuração']);
    expect(within(lista).getByRole('checkbox', { name: 'RG' })).toHaveAccessibleDescription('1.1, no grupo 1. Documentos pessoais');
    expect(within(lista).getByRole('button', { name: 'Fechar o grupo 1. Documentos pessoais' })).toHaveAccessibleDescription('0 de 2 feitos');
  });

  it('dado um checklist sem grupos, quando a seção abre, então os itens ficam 1., 2., 3., e o ⋯ do item não oferece "Mover para grupo"', async () => {
    // Dado
    atual = { ...exemplo(), grupos: [], itens: [item('a', 'Procuração', null, 1), item('b', 'Contrato social', null, 2), item('c', 'RG', null, 3)] };
    // Quando
    montar();
    const lista = await secao();
    // Então
    expect(linhas(lista)).toEqual(['1. Procuração', '2. Contrato social', '3. RG']);
    expect(within(lista).getByRole('checkbox', { name: 'RG' })).toHaveAccessibleDescription('3.');
    // Quando
    await userEvent.click(within(lista).getByRole('button', { name: 'Ações do item Contrato social' }));
    // Então
    expect(screen.getAllByRole('menuitem').map(b => b.textContent?.trim())).toEqual(['Data de entrega', 'Subir', 'Descer', 'Excluir item']);
  });

  it('dado o grupo 1 aberto, quando a pessoa o fecha, então os itens dele somem e a contagem continua à vista; marcar um item conta no grupo', async () => {
    // Dado
    montar();
    const lista = await secao();
    // Quando
    await userEvent.click(within(lista).getByRole('checkbox', { name: 'RG' }));
    // Então
    expect(await within(lista).findByText('1 de 2 feitos')).toBeInTheDocument();
    expect(itemAtualizar).toHaveBeenCalledWith('rg', { feito: true });
    // Quando
    await userEvent.click(within(lista).getByRole('button', { name: 'Fechar o grupo 1. Documentos pessoais' }));
    // Então
    expect(within(lista).queryByRole('checkbox', { name: 'RG' })).not.toBeInTheDocument();
    expect(within(lista).getByText('1 de 2 feitos')).toBeInTheDocument();
    expect(within(lista).getByRole('button', { name: 'Abrir o grupo 1. Documentos pessoais' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('quando a pessoa escolhe "Descer" no ⋯ do grupo 1, então as posições novas são gravadas, o Benefício passa a 1. e o foco fica no ⋯ do grupo movido', async () => {
    // Dado
    montar();
    const lista = await secao();
    // Quando
    await userEvent.click(within(lista).getByRole('button', { name: 'Ações do grupo Documentos pessoais' }));
    expect(screen.getAllByRole('menuitem').map(b => b.textContent?.trim())).toEqual(['Adicionar subgrupo', 'Descer', 'Mover para grupo', 'Excluir grupo']);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Descer' }));
    // Então
    await vi.waitFor(() => expect(listaReordenar).toHaveBeenCalledTimes(1));
    expect(listaReordenar.mock.calls[0][1].map(p => [p.id, p.ordem])).toEqual([['g2', 1], ['g3', 2], ['cnis', 3], ['ctps', 4], ['g4', 5], ['laudo', 6], ['g1', 7], ['rg', 8], ['cpf', 9]]);
    expect(within(lista).getByRole('button', { name: 'Fechar o grupo 1. Benefício' })).toBeInTheDocument();
    await vi.waitFor(() => expect(within(lista).getByRole('button', { name: 'Ações do grupo Documentos pessoais' })).toHaveFocus());
    expect(await screen.findByText('"Documentos pessoais" agora é 2.')).toBeInTheDocument();
  });

  it('quando a pessoa move um item solto para o 2.1, então ele vira o último do 2.1; para o subgrupo 2.2, a janela não oferece o 2.1 (passaria de 3 níveis)', async () => {
    // Dado
    montar();
    const lista = await secao();
    // Quando
    await userEvent.click(within(lista).getByRole('button', { name: 'Ações do item Procuração' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mover para grupo' }));
    const janela = screen.getByRole('dialog', { name: 'Mover "Procuração" para o grupo' });
    expect(within(janela).getByRole('combobox', { name: 'Grupo' })).toHaveValue('');
    await userEvent.selectOptions(within(janela).getByRole('combobox', { name: 'Grupo' }), '2.1 Aposentadoria por idade');
    await userEvent.click(within(janela).getByRole('button', { name: 'Mover' }));
    // Então
    expect(await screen.findByText('"Procuração" agora é 2.1.3.')).toBeInTheDocument();
    expect(within(lista).getByRole('checkbox', { name: 'Procuração' })).toHaveAccessibleDescription('2.1.3, no grupo 2. Benefício › 2.1 Aposentadoria por idade');
    // Quando
    await userEvent.click(within(lista).getByRole('button', { name: 'Ações do grupo Auxílio-doença' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mover para grupo' }));
    // Então
    const outra = screen.getByRole('dialog', { name: 'Mover "Auxílio-doença" para o grupo' });
    expect(within(outra).getAllByRole('option').map(o => o.textContent)).toEqual(['Fora dos grupos', '1. Documentos pessoais', '2. Benefício']);
    // Quando: desiste
    await userEvent.click(within(outra).getByRole('button', { name: 'Cancelar' }));
    // Então: nada muda
    expect(listaReordenar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('quando a pessoa exclui um item, então o foco vai ao ⋯ do de cima; ao excluir o grupo 1 (confirmando), vai ao nome do checklist', async () => {
    // Dado
    montar();
    const lista = await secao();
    // Quando
    await userEvent.click(within(lista).getByRole('button', { name: 'Ações do item CPF' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Excluir item' }));
    // Então
    await vi.waitFor(() => expect(within(lista).getByRole('button', { name: 'Ações do item RG' })).toHaveFocus());
    expect(itemExcluir).toHaveBeenCalledWith('cpf');
    // Quando
    await userEvent.click(within(lista).getByRole('button', { name: 'Ações do grupo Documentos pessoais' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Excluir grupo' }));
    const janela = screen.getByRole('dialog', { name: 'Excluir o grupo?' });
    expect(janela).toHaveTextContent('O grupo "1. Documentos pessoais" e 1 item serão excluídos.');
    await userEvent.click(within(janela).getByRole('button', { name: 'Excluir grupo' }));
    // Então
    await vi.waitFor(() => expect(within(lista).getByRole('button', { name: 'Benefício previdenciário' })).toHaveFocus());
    expect(grupoDoChecklistExcluir).toHaveBeenCalledWith('g1');
    expect(within(lista).getByRole('button', { name: 'Fechar o grupo 1. Benefício' })).toBeInTheDocument();
  });

  it('quando a pessoa cria um grupo pelo "+ Grupo", então ele entra no fim e o foco vai para o campo de item novo dele', async () => {
    // Dado
    montar();
    const lista = await secao();
    // Quando
    await userEvent.click(within(lista).getByRole('button', { name: 'Novo grupo' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Nome do grupo' }), 'Certidões');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    // Então
    expect(grupoDoChecklistCriar).toHaveBeenCalledWith('l1', 'Certidões', { pai_id: null, ordem: 11 });
    await vi.waitFor(() => expect(within(lista).getByRole('textbox', { name: 'Novo item do grupo 4. Certidões' })).toHaveFocus());
  });

  it('quando a pessoa escreve no campo do grupo 2.1 e tecla Enter, então o item entra no fim do 2.1; Esc fecha só o campo', async () => {
    // Dado
    const fechouOCartao = vi.fn();
    const ouvir = (e: KeyboardEvent) => { if (e.key === 'Escape') fechouOCartao(); };
    document.addEventListener('keydown', ouvir);
    montar();
    const lista = await secao();
    await userEvent.click(within(lista).getByRole('button', { name: 'Adicionar item no grupo 2.1 Aposentadoria por idade' }));
    const campo = within(lista).getByRole('textbox', { name: 'Novo item do grupo 2.1 Aposentadoria por idade' });
    // Quando
    await userEvent.type(campo, 'PPP{Enter}');
    // Então: entre a Carteira de trabalho (7) e o Auxílio-doença (8)
    expect(itemCriar).toHaveBeenCalledWith('l1', 'PPP', { pai_id: 'g3', ordem: 7.5 });
    expect(await within(lista).findByRole('checkbox', { name: 'PPP' })).toHaveAccessibleDescription('2.1.3, no grupo 2. Benefício › 2.1 Aposentadoria por idade');
    expect(campo).toHaveValue('');
    // Quando
    await userEvent.type(campo, '{Escape}');
    // Então
    expect(within(lista).queryByRole('textbox', { name: 'Novo item do grupo 2.1 Aposentadoria por idade' })).not.toBeInTheDocument();
    await vi.waitFor(() => expect(within(lista).getByRole('button', { name: 'Adicionar item no grupo 2.1 Aposentadoria por idade' })).toHaveFocus());
    expect(fechouOCartao).not.toHaveBeenCalled();
    document.removeEventListener('keydown', ouvir);
  });

  it('quando a pessoa cola três linhas numeradas e escolhe usar os números, então o grupo e os itens dele são criados', async () => {
    // Dado
    montar();
    const lista = await secao();
    await userEvent.click(within(lista).getByRole('textbox', { name: 'Novo item do checklist Benefício previdenciário' }));
    // Quando
    await userEvent.paste('1. Certidões\n1.1 Nascimento\n1.2 Casamento');
    await userEvent.click(within(lista).getByRole('button', { name: 'Usar esses números como grupos' }));
    // Então
    await vi.waitFor(() => expect(itemCriar).toHaveBeenCalledTimes(2));
    expect(grupoDoChecklistCriar).toHaveBeenCalledWith('l1', 'Certidões', { pai_id: null, ordem: 11 });
    expect(itemCriar.mock.calls.map(c => [c[1], c[2]])).toEqual([['Nascimento', { pai_id: 'grupo1', ordem: 12 }], ['Casamento', { pai_id: 'grupo1', ordem: 13 }]]);
    expect(await within(lista).findByRole('button', { name: 'Fechar o grupo 4. Certidões' })).toBeInTheDocument();
  });

  it('quando a pessoa cola no grupo 1. uma lista numerada de 3 níveis e escolhe usar os números, então nada é criado e o aviso diz por quê', async () => {
    // Dado
    montar();
    const lista = await secao();
    await userEvent.click(within(lista).getByRole('button', { name: 'Adicionar item no grupo 1. Documentos pessoais' }));
    await userEvent.click(within(lista).getByRole('textbox', { name: 'Novo item do grupo 1. Documentos pessoais' }));
    // Quando
    await userEvent.paste('1. A\n1.1 B\n1.1.1 C');
    await userEvent.click(within(lista).getByRole('button', { name: 'Usar esses números como grupos' }));
    // Então
    expect(await screen.findByText(`${NIVEIS_DEMAIS} ${NAO_CABE_NO_GRUPO}`)).toBeInTheDocument();
    expect(grupoDoChecklistCriar).not.toHaveBeenCalled();
    expect(itemCriar).not.toHaveBeenCalled();
    expect(listaReordenar).not.toHaveBeenCalled();
    // Quando: mantém como itens
    await userEvent.click(within(lista).getByRole('button', { name: 'Manter como itens' }));
    // Então
    await vi.waitFor(() => expect(itemCriar).toHaveBeenCalledTimes(3));
    expect(grupoDoChecklistCriar).not.toHaveBeenCalled();
  });

  it('dado que a gravação de "Subir" falha, quando a pessoa sobe o grupo 2., então só o erro aparece, sem o aviso do número novo', async () => {
    // Dado
    listaReordenar.mockRejectedValueOnce(new Error('Sem conexão com o servidor.'));
    montar();
    const lista = await secao();
    // Quando
    await userEvent.click(within(lista).getByRole('button', { name: 'Ações do grupo Benefício' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Subir' }));
    // Então
    expect(await screen.findByText('Sem conexão com o servidor.')).toBeInTheDocument();
    expect(await within(lista).findByRole('button', { name: 'Fechar o grupo 2. Benefício' })).toBeInTheDocument();
    expect(screen.queryByText('"Benefício" agora é 1.')).not.toBeInTheDocument();
  });

  describe('com um grupo fechado', () => {
    it('quando a pessoa move a Procuração para o grupo 1. fechado, então ele abre e o foco fica no ⋯ dela', async () => {
      // Dado
      montar();
      const lista = await secao();
      await userEvent.click(within(lista).getByRole('button', { name: 'Fechar o grupo 1. Documentos pessoais' }));
      // Quando
      await userEvent.click(within(lista).getByRole('button', { name: 'Ações do item Procuração' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Mover para grupo' }));
      const janela = screen.getByRole('dialog', { name: 'Mover "Procuração" para o grupo' });
      await userEvent.selectOptions(within(janela).getByRole('combobox', { name: 'Grupo' }), '1. Documentos pessoais');
      await userEvent.click(within(janela).getByRole('button', { name: 'Mover' }));
      // Então
      expect(await within(lista).findByRole('button', { name: 'Fechar o grupo 1. Documentos pessoais' })).toHaveAttribute('aria-expanded', 'true');
      await vi.waitFor(() => expect(within(lista).getByRole('button', { name: 'Ações do item Procuração' })).toHaveFocus());
    });

    it('quando a pessoa exclui o grupo 2. logo abaixo do grupo 1. fechado, então o foco vai ao ⋯ do grupo 1., e não ao nome do checklist', async () => {
      // Dado
      montar();
      const lista = await secao();
      await userEvent.click(within(lista).getByRole('button', { name: 'Fechar o grupo 1. Documentos pessoais' }));
      // Quando
      await userEvent.click(within(lista).getByRole('button', { name: 'Ações do grupo Benefício' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Excluir grupo' }));
      await userEvent.click(within(screen.getByRole('dialog', { name: 'Excluir o grupo?' })).getByRole('button', { name: 'Excluir grupo' }));
      // Então
      expect(grupoDoChecklistExcluir).toHaveBeenCalledWith('g2');
      await vi.waitFor(() => expect(within(lista).getByRole('button', { name: 'Ações do grupo Documentos pessoais' })).toHaveFocus());
    });

    it('quando a pessoa adiciona um subgrupo no grupo 1. fechado, então ele abre e o foco vai ao campo de item novo do subgrupo', async () => {
      // Dado
      montar();
      const lista = await secao();
      await userEvent.click(within(lista).getByRole('button', { name: 'Fechar o grupo 1. Documentos pessoais' }));
      // Quando
      await userEvent.click(within(lista).getByRole('button', { name: 'Ações do grupo Documentos pessoais' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Adicionar subgrupo' }));
      await userEvent.type(screen.getByRole('textbox', { name: 'Nome do subgrupo' }), 'Certidões');
      await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
      // Então
      await vi.waitFor(() => expect(within(lista).getByRole('textbox', { name: 'Novo item do grupo 1.3 Certidões' })).toHaveFocus());
    });

    it('dado um grupo aberto e vazio, então o botão de abrir e fechar não aponta para uma lista que não existe', async () => {
      // Dado
      atual = { ...exemplo(), grupos: [...exemplo().grupos, grupo('vazio', 'Vazio', null, 20)] };
      // Quando
      montar();
      const lista = await secao();
      // Então
      const botao = within(lista).getByRole('button', { name: 'Fechar o grupo 4. Vazio' });
      expect(botao).toHaveAttribute('aria-expanded', 'true');
      expect(botao).not.toHaveAttribute('aria-controls');
      const cheio = within(lista).getByRole('button', { name: 'Fechar o grupo 1. Documentos pessoais' });
      expect(document.getElementById(cheio.getAttribute('aria-controls')!)).toBeInTheDocument();
    });
  });

  it('dado quem só lê um contrato, quando abre o checklist, então vê os grupos, os números e as contagens e abre e fecha, sem ⋯ nem botões de acrescentar', async () => {
    // Quando
    montar('contratos', true);
    const lista = await secao();
    // Então
    expect(linhas(lista)[0]).toBe('1. Documentos pessoais 0 de 2 feitos');
    expect(within(lista).getByRole('checkbox', { name: 'RG' })).toBeDisabled();
    expect(within(lista).queryByRole('button', { name: /^Ações do/ })).not.toBeInTheDocument();
    expect(within(lista).queryByRole('button', { name: 'Novo grupo' })).not.toBeInTheDocument();
    expect(within(lista).queryByRole('button', { name: /^Adicionar item/ })).not.toBeInTheDocument();
    expect(within(lista).queryByRole('textbox')).not.toBeInTheDocument();
    // Quando
    await act(async () => { await userEvent.click(within(lista).getByRole('button', { name: 'Fechar o grupo 2. Benefício' })); });
    // Então
    expect(within(lista).queryByRole('checkbox', { name: 'CNIS' })).not.toBeInTheDocument();
    expect(listasDoCartao).toHaveBeenCalledWith('contratos', 'c1');
  });
});
