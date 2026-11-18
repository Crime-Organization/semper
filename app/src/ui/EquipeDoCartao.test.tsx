// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { Membro } from '../dados';
import { EquipeDoCartao, type MudarAEquipe } from './EquipeDoCartao';

const ana = { id: 'u-ana', nome: 'Ana Teste Lima', papel: 'Responsável', para: '/pessoas/?id=p-ana' };
const bruno = { id: 'u-bruno', nome: 'Bruno Exemplo Souza', papel: 'Participante · 10%' };
const mateus = { id: 'u-mateus', nome: 'Mateus Freitas Gonçalves', papel: 'Participante' };

describe('Equipe do cartão', () => {
  it('quando o cartão tem responsável e participantes, então cada um é uma bolinha com as iniciais, o responsável primeiro', () => {
    // Quando
    render(<MemoryRouter><EquipeDoCartao responsavel={ana} participantes={[bruno, mateus]} /></MemoryRouter>);
    // Então
    const bolinhas = within(screen.getByRole('group', { name: 'Equipe' })).getAllByRole('button');
    expect(bolinhas.map(b => b.getAttribute('aria-label'))).toEqual(['Ana Teste Lima, Responsável', 'Bruno Exemplo Souza, Participante · 10%',
      'Mateus Freitas Gonçalves, Participante']);
    expect(bolinhas.map(b => b.textContent)).toEqual(['AL', 'BS', 'MG']);
  });

  it('quando a pessoa clica numa bolinha, então vê o nome completo, o papel e o link para o cartão da pessoa', async () => {
    // Dado
    render(<MemoryRouter><EquipeDoCartao responsavel={ana} participantes={[]} /></MemoryRouter>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Ana Teste Lima, Responsável' }));
    // Então
    const ficha = screen.getByRole('dialog', { name: 'Ana Teste Lima' });
    expect(ficha).toHaveTextContent('Ana Teste LimaResponsável');
    expect(within(ficha).getByRole('link', { name: 'Abrir o cartão da pessoa' })).toHaveAttribute('href', '/pessoas/?id=p-ana');
  });

  it('quando a pessoa não tem cartão, então a ficha não tem link', async () => {
    // Dado
    render(<MemoryRouter><EquipeDoCartao responsavel={ana} participantes={[bruno]} /></MemoryRouter>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: /Bruno Exemplo Souza/ }));
    // Então
    expect(within(screen.getByRole('dialog', { name: 'Bruno Exemplo Souza' })).queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('Equipe do cartão que a pessoa pode alterar (#356)', () => {
  const EQUIPE: Membro[] = [
    { id: 'u-ana', nome: 'Ana Teste Lima', ativo: true },
    { id: 'u-bruno', nome: 'Bruno Exemplo Souza', ativo: true },
    { id: 'u-mateus', nome: 'Mateus Freitas Gonçalves', ativo: true }
  ];
  const mudar = (extra: Partial<MudarAEquipe> = {}): MudarAEquipe => ({
    por: 'Pôr participante', candidatos: () => [EQUIPE[2]], responsaveis: () => [EQUIPE[1], EQUIPE[2]], tirar: () => 'Tirar da tarefa',
    aoPor: vi.fn(), aoTirar: vi.fn(), aoTrocarResponsavel: vi.fn(), ...extra
  });
  const montar = (m: MudarAEquipe, participantes = [bruno]) =>
    render(<MemoryRouter><EquipeDoCartao responsavel={ana} participantes={participantes} mudar={m} /></MemoryRouter>);

  it('dado um cartão sem participantes, quando abre, então aparecem o responsável e a bolinha com "+"', () => {
    // Quando
    montar(mudar(), []);
    // Então
    const bolinhas = within(screen.getByRole('group', { name: 'Equipe' })).getAllByRole('button');
    expect(bolinhas.map(b => b.getAttribute('aria-label'))).toEqual(['Ana Teste Lima, Responsável', 'Pôr participante']);
  });

  it('quando a pessoa escolhe alguém na busca do "+", então a tela o recebe para pôr como participante', async () => {
    // Dado
    const m = mudar();
    montar(m);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Pôr participante' }));
    await userEvent.click(within(screen.getByRole('list', { name: 'Equipe' })).getByRole('button', { name: 'Mateus Freitas Gonçalves' }));
    // Então
    expect(m.aoPor).toHaveBeenCalledWith(EQUIPE[2]);
  });

  it('quando a pessoa tira um participante pela ficha da bolinha, então a tela recebe quem sai e o foco vai à bolinha com "+"', async () => {
    // Dado
    const m = mudar();
    montar(m);
    await userEvent.click(screen.getByRole('button', { name: 'Bruno Exemplo Souza, Participante · 10%' }));
    // Quando
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Bruno Exemplo Souza' })).getByRole('button', { name: 'Tirar da tarefa' }));
    // Então
    expect(m.aoTirar).toHaveBeenCalledWith(bruno);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Pôr participante' })).toHaveFocus());
  });

  it('quando a pessoa troca o responsável pela ficha da bolinha dele, então a tela recebe o novo e o foco volta à bolinha', async () => {
    // Dado
    const m = mudar();
    montar(m);
    await userEvent.click(screen.getByRole('button', { name: 'Ana Teste Lima, Responsável' }));
    // Quando
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Ana Teste Lima' })).getByRole('button', { name: 'Trocar o responsável' }));
    await userEvent.click(within(screen.getByRole('list', { name: 'Equipe' })).getByRole('button', { name: 'Bruno Exemplo Souza' }));
    // Então
    expect(m.aoTrocarResponsavel).toHaveBeenCalledWith(EQUIPE[1]);
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Ana Teste Lima, Responsável' })).toHaveFocus());
  });

  it('dada a lista cheia, quando o cartão abre, então a bolinha com "+" vem desligada, com o motivo', () => {
    // Quando
    montar(mudar({ cheia: 'Uma tarefa pode ter até 20 participantes.' }));
    // Então
    expect(screen.getByRole('button', { name: 'Pôr participante' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Pôr participante' })).toHaveAttribute('title', 'Uma tarefa pode ter até 20 participantes.');
  });

  it('dada uma mudança ainda gravando, quando a pessoa tenta pôr ou tirar alguém, então o "+" e a ação da ficha vêm desligados', async () => {
    // Dado
    const m = mudar({ ocupado: true });
    montar(m);
    const mais = screen.getByRole('button', { name: 'Pôr participante' });
    expect(mais).toHaveAttribute('aria-disabled', 'true');
    expect(mais).toHaveAttribute('title', 'Gravando a mudança na equipe…');
    // Quando
    await userEvent.click(mais);
    await userEvent.click(screen.getByRole('button', { name: 'Bruno Exemplo Souza, Participante · 10%' }));
    // Então
    expect(screen.queryByRole('dialog', { name: 'Pôr participante' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('dialog', { name: 'Bruno Exemplo Souza' })).getByRole('button', { name: 'Tirar da tarefa' })).toBeDisabled();
    expect(m.aoPor).not.toHaveBeenCalled();
  });

  it('dado um cartão com todos da equipe ativa dentro, quando a pessoa tira um participante, então o foco vai à bolinha com "+", sem se perder', async () => {
    // Dado
    const m = mudar({ candidatos: () => [] });
    montar(m);
    await userEvent.click(screen.getByRole('button', { name: 'Bruno Exemplo Souza, Participante · 10%' }));
    // Quando
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Bruno Exemplo Souza' })).getByRole('button', { name: 'Tirar da tarefa' }));
    // Então
    expect(m.aoTirar).toHaveBeenCalledWith(bruno);
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Pôr participante' })).toHaveFocus());
  });

  it('dado um cartão que a pessoa só lê, quando ela abre a ficha de uma bolinha, então não há "+" nem ação na ficha', async () => {
    // Dado
    render(<MemoryRouter><EquipeDoCartao responsavel={ana} participantes={[bruno]} /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: 'Pôr participante' })).not.toBeInTheDocument();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Ana Teste Lima, Responsável' }));
    // Então
    expect(within(screen.getByRole('dialog', { name: 'Ana Teste Lima' })).queryByRole('button')).not.toBeInTheDocument();
  });
});
