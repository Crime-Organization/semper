// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// As salas do escritório nas Configurações (#308): cadastrar, mudar, desativar e reativar.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SD, type Sala } from '../dados';
import { iniciarPreferencias } from '../ui/preferencias';
import { SalasDoEscritorio } from './SalasDoEscritorio';

const sala = (id: string, nome: string, campos: Partial<Sala> = {}): Sala => ({ id, nome, capacidade: 6, ativa: true, criado_em: '2026-11-22T10:00:00Z', ...campos });

beforeEach(() => {
  vi.restoreAllMocks();
  iniciarPreferencias({});
});

describe('As salas nas Configurações', () => {
  it('dado o escritório sem salas, quando o administrador cadastra uma com nome e capacidade, então ela é gravada', async () => {
    // Dado
    vi.spyOn(SD, 'salasListar').mockResolvedValue([]);
    const criar = vi.spyOn(SD, 'salaCriar').mockResolvedValue(sala('s1', 'Sala de reuniões'));
    render(<SalasDoEscritorio />);
    expect(await screen.findByText('Nenhuma sala cadastrada ainda.')).toBeInTheDocument();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Nova sala' }));
    await userEvent.type(screen.getByLabelText(/Nome da sala/), ' Sala de reuniões ');
    await userEvent.type(screen.getByLabelText(/Capacidade/), '8');
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar sala' }));
    // Então
    expect(criar).toHaveBeenCalledWith({ nome: 'Sala de reuniões', capacidade: 8 });
  });

  it('dado o formulário em branco ou com um nome que já existe, quando tenta salvar, então mostra o que falta e não grava', async () => {
    // Dado
    vi.spyOn(SD, 'salasListar').mockResolvedValue([sala('s1', 'Sala 1')]);
    const criar = vi.spyOn(SD, 'salaCriar');
    render(<SalasDoEscritorio />);
    await userEvent.click(await screen.findByRole('button', { name: 'Nova sala' }));
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar sala' }));
    // Então
    expect(screen.getByText('Dê um nome à sala.')).toBeInTheDocument();
    expect(screen.getByText('Informe quantas pessoas cabem.')).toBeInTheDocument();
    // Quando
    await userEvent.type(screen.getByLabelText(/Nome da sala/), 'SALA 1');
    // Então
    expect(screen.getByText('Já existe uma sala com esse nome.')).toBeInTheDocument();
    expect(criar).not.toHaveBeenCalled();
  });

  it('dada uma sala ativa, quando o administrador a desativa (dois cliques), então ela é desativada', async () => {
    // Dado
    vi.spyOn(SD, 'salasListar').mockResolvedValue([sala('s1', 'Sala 1')]);
    const atualizar = vi.spyOn(SD, 'salaAtualizar').mockResolvedValue();
    render(<SalasDoEscritorio />);
    const linha = await screen.findByRole('row', { name: /Sala 1/ });
    expect(within(linha).getByText('6 pessoas')).toBeInTheDocument();
    // Quando
    await userEvent.click(within(linha).getByRole('button', { name: /Desativar/ }));
    await userEvent.click(within(linha).getByRole('button', { name: /Confirmar: desativar Sala 1/ }));
    // Então
    expect(atualizar).toHaveBeenCalledWith('s1', { ativa: false });
  });

  it('dada uma sala desativada, quando o administrador abre a lista delas, então pode reativá-la', async () => {
    // Dado
    vi.spyOn(SD, 'salasListar').mockResolvedValue([sala('s2', 'Auditório', { ativa: false, capacidade: 40 })]);
    const atualizar = vi.spyOn(SD, 'salaAtualizar').mockResolvedValue();
    render(<SalasDoEscritorio />);
    // Quando
    await userEvent.click(await screen.findByRole('button', { name: /Salas desativadas/ }));
    expect(screen.getByText('Auditório (40 pessoas) · desativada')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reativar a sala Auditório' }));
    // Então
    expect(atualizar).toHaveBeenCalledWith('s2', { ativa: true });
  });
});
