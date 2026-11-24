// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Os nomes são inventados.
// A seção "Processos relacionados" do cartão do processo: o administrativo ligado ao judicial que nasceu dele (#425).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProcessoRelacionado } from '../dados';
import { CriarNoCartao } from '../ui/ItensLigados';
import { ProcessosRelacionados } from './ProcessosRelacionados';

const { SD, feito, falha, confirmar } = vi.hoisted(() => ({
  SD: { colunasListar: vi.fn(), processoJudicialLigar: vi.fn(), processoJudicialDesligar: vi.fn(), processosParaPorCliente: vi.fn() },
  feito: vi.fn(), falha: vi.fn(), confirmar: vi.fn()
}));
vi.mock('../dados', () => ({ SD }));
vi.mock('../ui/avisos', () => ({ feito, falha, avisar: vi.fn() }));
vi.mock('../ui/janela', () => ({ confirmar }));

const base = { numero: '1', titulo: null, cliente_nome: '', etapa_id: null, arquivado_em: null, criado_em: '2026-01-01' };
const JUDICIAL: ProcessoRelacionado = { ...base, id: 'jud', codigo: 'JUD1', tipo: 'judicial', titulo: 'Ação de concessão', relacao: 'judicial' };
const ADMINISTRATIVO: ProcessoRelacionado = { ...base, id: 'adm', codigo: 'ADM1', tipo: 'administrativo', titulo: 'Pedido de benefício', relacao: 'administrativo' };
const RECURSO: ProcessoRelacionado = { ...base, id: 'rec', codigo: 'REC1', tipo: 'judicial', titulo: 'Apelação', relacao: 'recurso' };

function mostrar(lista: ProcessoRelacionado[], processoId: string, tipo: 'judicial' | 'administrativo', pode = true) {
  const aoMudar = vi.fn();
  render(<MemoryRouter><CriarNoCartao pode={pode}><ProcessosRelacionados lista={lista} processoId={processoId} tipo={tipo} aoMudar={aoMudar} /></CriarNoCartao></MemoryRouter>);
  return aoMudar;
}

describe('Processos relacionados: o administrativo e o judicial (#425)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    SD.colunasListar.mockResolvedValue([]);
    SD.processoJudicialDesligar.mockResolvedValue(undefined);
    SD.processosParaPorCliente.mockResolvedValue([]);
  });

  it('dado um administrativo, quando a seção abre, então mostra o judicial e os atalhos do judicial novo e do existente', () => {
    // Quando
    mostrar([JUDICIAL], 'adm', 'administrativo');
    // Então
    expect(screen.getByRole('link', { name: /Ação de concessão/ })).toHaveTextContent('Processo judicial deste administrativo');
    expect(screen.getByRole('link', { name: 'Novo processo judicial a partir deste' })).toHaveAttribute('href', '/processos/novo/?processo=adm&ligacao=judicial');
    expect(screen.getByRole('button', { name: 'Ligar processo judicial existente' })).toBeInTheDocument();
  });

  it('dado um judicial, quando a seção abre, então mostra o administrativo de origem e não oferece outro judicial', () => {
    // Quando
    mostrar([ADMINISTRATIVO], 'jud', 'judicial');
    // Então
    expect(screen.getByRole('link', { name: /Pedido de benefício/ })).toHaveTextContent('Processo administrativo de origem');
    expect(screen.queryByRole('link', { name: 'Novo processo judicial a partir deste' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ligar processo judicial existente' })).not.toBeInTheDocument();
  });

  it('dado o judicial ligado, quando a pessoa clica no "x" e confirma, então a ligação se desfaz, com o Desfazer', async () => {
    // Dado
    confirmar.mockResolvedValue(true);
    const aoMudar = mostrar([ADMINISTRATIVO], 'jud', 'judicial');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer a ligação com o processo ADM1' }));
    // Então
    expect(confirmar).toHaveBeenCalled();
    expect(SD.processoJudicialDesligar).toHaveBeenCalledWith('jud');
    expect(feito).toHaveBeenCalledWith('Ligação desfeita com o processo ADM1.', 'ligação desfeita', expect.any(Function));
    expect(aoMudar).toHaveBeenCalled();
  });

  it('dado o judicial ligado, quando a pessoa clica no "x" e não confirma, então nada muda', async () => {
    // Dado
    confirmar.mockResolvedValue(false);
    mostrar([JUDICIAL], 'adm', 'administrativo');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer a ligação com o processo JUD1' }));
    // Então
    expect(SD.processoJudicialDesligar).not.toHaveBeenCalled();
  });

  it('dado um recurso, quando a seção abre, então ele não tem "x": o recurso não se desliga', () => {
    // Quando
    mostrar([RECURSO], 'jud', 'judicial');
    // Então
    expect(screen.queryByRole('button', { name: /Desfazer a ligação/ })).not.toBeInTheDocument();
  });

  it('dado o cartão arquivado ou só para ler, quando a seção abre, então não há "x" nem atalhos', () => {
    // Quando
    mostrar([JUDICIAL], 'adm', 'administrativo', false);
    // Então
    expect(screen.queryByRole('button', { name: /Desfazer a ligação/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Novo processo judicial a partir deste' })).not.toBeInTheDocument();
  });
});
