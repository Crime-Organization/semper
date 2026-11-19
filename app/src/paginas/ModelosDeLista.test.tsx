// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A página Modelos de checklist (#309): o modelo é montado com a mesma árvore do checklist do cartão, com grupos numerados.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DadosModelos, ModeloDeLista, NoDoModelo } from '../dados';
import { GRUPOS_DO_MODELO } from '../dados/limites';
import { Avisos } from '../ui/avisos';
import { Janelas } from '../ui/janela';
import ModelosDeLista from './ModelosDeLista';

const { modelosListar, modeloCriar, modeloAtualizar, modeloExcluir } = vi.hoisted(() => ({
  modelosListar: vi.fn<DadosModelos['modelosListar']>(), modeloCriar: vi.fn<DadosModelos['modeloCriar']>(),
  modeloAtualizar: vi.fn<DadosModelos['modeloAtualizar']>(async () => {}), modeloExcluir: vi.fn<DadosModelos['modeloExcluir']>(async () => {})
}));
vi.mock('../dados', () => ({ SD: { modelosListar, modeloCriar, modeloAtualizar, modeloExcluir } satisfies DadosModelos }));
vi.mock('../ui/sessao', () => ({ useCtx: () => ({ perfil: { id: 'u-ana' }, ehAdmin: false }) }));

const BENEFICIO: NoDoModelo[] = [
  { texto: 'Documentos pessoais', filhos: [{ texto: 'RG' }, { texto: 'CPF' }] },
  { texto: 'Benefício', filhos: [{ texto: 'Aposentadoria por idade', filhos: [{ texto: 'CNIS' }] }] }
];
const modelo = (id: string, nome: string, arvore: NoDoModelo[], itens: string[]): ModeloDeLista =>
  ({ id, nome, itens, arvore, criado_por: 'u-ana', atualizado_em: '2026-11-19T10:00:00Z' });
const montar = () => render(<MemoryRouter><Avisos /><Janelas /><ModelosDeLista /></MemoryRouter>);
/** O texto de cada linha da árvore (o item, ou a cabeça do grupo), na ordem. */
const ehGrupo = (li: HTMLElement) => within(li).queryAllByRole('button', { name: /^(Fechar|Abrir) o grupo/ }).length > 0;
const linhas = (lugar: HTMLElement) => within(lugar).getAllByRole('listitem').map(li =>
  (ehGrupo(li) ? li.firstElementChild! : li).textContent!.replace(/\s+/g, ' ').trim());

describe('Modelos de checklist com grupos (#309)', () => {
  beforeEach(() => {
    modelosListar.mockReset().mockResolvedValue([
      modelo('m1', 'Benefício previdenciário', BENEFICIO, ['RG', 'CPF', 'CNIS']),
      modelo('m2', 'Documentos de pessoa física', [{ texto: 'Documento pessoal' }, { texto: 'Comprovante de residência' }], ['Documento pessoal', 'Comprovante de residência'])
    ]);
    modeloCriar.mockReset().mockImplementation(async (nome, arvore) => modelo('novo', nome, arvore, []));
    modeloAtualizar.mockClear();
  });

  it('dado um modelo com grupos, quando a página abre, então o cartão dele mostra a árvore numerada e quantos itens e grupos tem', async () => {
    // Quando
    montar();
    const cartao = await screen.findByRole('listitem', { name: 'Modelo Benefício previdenciário' });
    // Então
    expect(cartao).toHaveTextContent('3 itens em 3 grupos');
    expect(linhas(within(cartao).getAllByRole('list')[0])).toEqual(['1. Documentos pessoais 2 itens', '1.1 RG', '1.2 CPF', '2. Benefício 1 item',
      '2.1 Aposentadoria por idade 1 item', '2.1.1 CNIS']);
    expect(within(cartao).queryByRole('button', { name: /^Ações do/ })).not.toBeInTheDocument();
  });

  it('quando a pessoa cria um modelo com "+ Grupo" e "Adicionar item", então o editor numera 1. e 1.1, e salvar grava a árvore', async () => {
    // Dado
    montar();
    await userEvent.click(await screen.findByRole('button', { name: 'Novo modelo' }));
    const editor = screen.getByRole('form', { name: 'Novo modelo' });
    await userEvent.type(within(editor).getByLabelText(/Nome do modelo/), 'Divórcio');
    // Quando
    await userEvent.click(within(editor).getByRole('button', { name: 'Novo grupo' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Nome do grupo' }), 'Documentos');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await userEvent.type(await within(editor).findByRole('textbox', { name: 'Novo item do grupo 1. Documentos' }), 'Certidão de casamento{Enter}');
    await userEvent.type(within(editor).getByRole('textbox', { name: 'Novo item do modelo' }), 'Pacto antenupcial{Enter}');
    // Então
    expect(linhas(within(editor).getAllByRole('list')[0])).toEqual(['1. Documentos 1 item', '1.1 Certidão de casamento', '2. Pacto antenupcial']);
    // Quando
    await userEvent.click(within(editor).getByRole('button', { name: 'Salvar modelo' }));
    // Então
    expect(modeloCriar).toHaveBeenCalledWith('Divórcio', [{ texto: 'Documentos', filhos: [{ texto: 'Certidão de casamento' }] }, { texto: 'Pacto antenupcial' }]);
  });

  it('dado o modelo em edição, quando a pessoa desce o grupo 1 e exclui um grupo, então o editor renumera e o salvar leva a árvore nova', async () => {
    // Dado
    montar();
    const cartao = await screen.findByRole('listitem', { name: 'Modelo Benefício previdenciário' });
    await userEvent.click(within(cartao).getByRole('button', { name: 'Editar' }));
    const editor = screen.getByRole('form', { name: 'Editar modelo' });
    // Quando
    await userEvent.click(within(editor).getByRole('button', { name: 'Ações do grupo Documentos pessoais' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Descer' }));
    // Então
    expect(linhas(within(editor).getAllByRole('list')[0])[0]).toBe('1. Benefício 1 item');
    expect(await screen.findByText('"Documentos pessoais" agora é 2.')).toBeInTheDocument();
    // Quando
    await userEvent.click(within(editor).getByRole('button', { name: 'Ações do grupo Aposentadoria por idade' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Excluir grupo' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Excluir o grupo?' })).getByRole('button', { name: 'Excluir grupo' }));
    // Então
    expect(linhas(within(editor).getAllByRole('list')[0])).toEqual(['1. Benefício Sem itens', '2. Documentos pessoais 2 itens', '2.1 RG', '2.2 CPF']);
    // Quando
    await userEvent.click(within(editor).getByRole('button', { name: 'Salvar modelo' }));
    // Então: o grupo que ficou vazio sai
    expect(modeloAtualizar).toHaveBeenCalledWith('m1', { nome: 'Benefício previdenciário', arvore: [{ texto: 'Documentos pessoais', filhos: [{ texto: 'RG' }, { texto: 'CPF' }] }] });
  });

  it('dado um modelo de antes, sem grupos, quando a pessoa o edita, então os itens aparecem 1., 2.', async () => {
    // Dado
    montar();
    const cartao = await screen.findByRole('listitem', { name: 'Modelo Documentos de pessoa física' });
    // Quando
    await userEvent.click(within(cartao).getByRole('button', { name: 'Editar' }));
    // Então
    expect(linhas(within(screen.getByRole('form', { name: 'Editar modelo' })).getAllByRole('list')[0])).toEqual(['1. Documento pessoal', '2. Comprovante de residência']);
  });

  it(`dado um modelo com mais de ${GRUPOS_DO_MODELO} grupos, quando a pessoa o edita, então o aviso diz o limite e o salvar fica travado`, async () => {
    // Dado
    const grupos = Array.from({ length: GRUPOS_DO_MODELO + 1 }, (_, i) => ({ texto: `Grupo ${i + 1}`, filhos: [{ texto: `Item ${i + 1}` }] }));
    modelosListar.mockResolvedValue([modelo('m3', 'Grande', grupos, grupos.map(g => g.filhos[0].texto))]);
    montar();
    // Quando
    await userEvent.click(within(await screen.findByRole('listitem', { name: 'Modelo Grande' })).getByRole('button', { name: 'Editar' }));
    // Então
    expect(screen.getByRole('alert')).toHaveTextContent(`Um modelo pode ter até ${GRUPOS_DO_MODELO} grupos.`);
    expect(screen.getByRole('button', { name: 'Salvar modelo' })).toBeDisabled();
  });
});
