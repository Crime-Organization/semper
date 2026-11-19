// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A anotação nova, em branco (pedidos do dono, 18/11): a equipe nas mesmas bolinhas dos outros cartões, com o mesmo aviso no pé
// da tela e o Desfazer, só que guardada na tela até salvar; e o ícone de etiqueta no topo, com os selos entre o topo e o título,
// na janela do cadastro (que tem o X dela).
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SD, type Etiqueta } from '../dados';
import { acharEditor, editorDe } from '../testes/editorAoVivo';
import { Avisos } from '../ui/avisos';
import { lojaDeEtiquetas } from '../ui/Etiquetas';
import { Janelas } from '../ui/janela';
import NovaAnotacao from './NovaAnotacao';

vi.mock('../ui/sessao', () => ({
  useCtx: () => ({
    perfil: { id: 'u-bruno', papel: 'usuario' }, ehAdmin: false, escritorio: { modulos: {} },
    equipe: [{ id: 'u-bruno', nome: 'Bruno Exemplo Souza', ativo: true }, { id: 'u-ana', nome: 'Ana Teste Lima', ativo: true }]
  })
}));

/** Duas etiquetas do escritório. */
const URGENTE: Etiqueta = { id: 'e-urgente', cor: 'vermelho', texto: 'Urgente', criado_por: 'u-bruno' };
const CLIENTE: Etiqueta = { id: 'e-cliente', cor: 'azul', texto: 'Cliente', criado_por: 'u-bruno' };

function abrirNova() {
  // Depois de salvar, a anotação abre em Documentos: aqui, uma página qualquer.
  const roteador = createMemoryRouter([{ path: '/documentos/nova/', element: <NovaAnotacao /> }, { path: '/documentos/', element: <p>Documentos</p> }],
    { initialEntries: ['/documentos/nova/'] });
  render(<><RouterProvider router={roteador} /><Avisos /><Janelas /></>);
}
const equipe = () => within(screen.getByRole('group', { name: 'Equipe' }));

describe('O topo da anotação nova', () => {
  // As etiquetas do escritório (também as que a lista lê de novo ao abrir a nota).
  beforeEach(() => {
    lojaDeEtiquetas.mudar([URGENTE, CLIENTE]);
    vi.spyOn(SD, 'etiquetasListar').mockResolvedValue([URGENTE, CLIENTE]);
  });

  // A regra mudou (pedido de 18/11): a seção "Etiquetas" saiu; no topo fica só o ícone de etiqueta, e a nota voltou à janela do
  // cadastro, que tem o X dela.
  it('quando a nota em branco abre, então há o ícone de etiqueta no topo, sem a seção "Etiquetas" nem a linha dos selos, e a nota não tem um X próprio', async () => {
    // Quando
    abrirNova();
    // Então
    await screen.findByRole('textbox', { name: 'Título' });
    expect(screen.getByRole('button', { name: 'Etiquetas' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Etiquetas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Etiquetas' })).not.toBeInTheDocument();
    expect(screen.queryByText('Nenhuma etiqueta.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Fechar/ })).not.toBeInTheDocument();
  });

  it('quando a pessoa escolhe duas etiquetas pelo ícone, então os selos aparecem entre o topo e o título, e vão junto ao salvar', async () => {
    // Dado
    const criar = vi.spyOn(SD, 'anotacaoCriar').mockResolvedValue({ id: 'a-nova', codigo: 'A-9' });
    abrirNova();
    const titulo = await screen.findByRole('textbox', { name: 'Título' });
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Etiquetas' }));
    const escolha = within(screen.getByRole('dialog', { name: 'Escolher etiquetas' }));
    await userEvent.click(escolha.getByRole('checkbox', { name: 'Urgente' }));
    await userEvent.click(escolha.getByRole('checkbox', { name: 'Cliente' }));
    // Então
    const selos = screen.getByRole('group', { name: 'Etiquetas' });
    expect(within(selos).getByText('Urgente')).toBeInTheDocument();
    expect(within(selos).getByText('Cliente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Etiquetas' }).compareDocumentPosition(selos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(selos.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Quando
    await userEvent.keyboard('{Escape}');
    await userEvent.type(titulo, 'Visita');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar anotação' }));
    // Então
    expect(criar).toHaveBeenCalledOnce();
    expect(criar.mock.calls[0][2]).toEqual([URGENTE.id, CLIENTE.id]);
    criar.mockRestore();
  });

  it('dada uma etiqueta escolhida, quando a pessoa clica no x do selo, então a linha dos selos some', async () => {
    // Dado
    abrirNova();
    await screen.findByRole('textbox', { name: 'Título' });
    await userEvent.click(screen.getByRole('button', { name: 'Etiquetas' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Escolher etiquetas' })).getByRole('checkbox', { name: 'Urgente' }));
    await userEvent.keyboard('{Escape}');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tirar a etiqueta Urgente' }));
    // Então
    expect(screen.queryByRole('group', { name: 'Etiquetas' })).not.toBeInTheDocument();
  });

  it('quando a nota em branco abre, então o cursor fica no título, e não no texto; Enter no título leva o cursor ao texto (o editor ao vivo)', async () => {
    // Quando
    abrirNova();
    const titulo = await screen.findByRole('textbox', { name: 'Título' });
    const texto = await acharEditor();
    // Então
    await vi.waitFor(() => expect(titulo).toHaveFocus());
    // Quando
    await userEvent.type(titulo, 'Visita{Enter}');
    // Então
    expect(editorDe(texto).hasFocus).toBe(true);
    expect(titulo).toHaveValue('Visita');
  });
});

describe('A equipe da anotação nova', () => {
  it('dada uma pessoa compartilhada, quando a bolinha dela é clicada, então ela sai na hora, com o aviso e o Desfazer, que a põe de volta', async () => {
    // Dado
    abrirNova();
    await userEvent.click(await screen.findByRole('button', { name: 'Compartilhar com mais alguém' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Compartilhar com mais alguém' })).getByRole('button', { name: 'Ana Teste Lima' }));
    // Quando
    await userEvent.click(equipe().getByRole('button', { name: 'Tirar Ana Teste Lima' }));
    // Então
    expect(equipe().queryByRole('button', { name: 'Tirar Ana Teste Lima' })).not.toBeInTheDocument();
    const aviso = (await screen.findByText('Ana Teste Lima saiu da anotação.')).closest('div')!;
    // Quando
    await userEvent.click(within(aviso).getByRole('button', { name: 'Desfazer' }));
    // Então
    expect(await equipe().findByRole('button', { name: 'Tirar Ana Teste Lima' })).toBeInTheDocument();
  });
});
