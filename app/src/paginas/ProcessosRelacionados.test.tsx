// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Os nomes são inventados.
// A seção "Processos relacionados" do cartão do processo: o administrativo ligado ao judicial que nasceu dele (#425) e os processos
// ligados depois, de qualquer tipo (#440).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProcessoRelacionado } from '../dados';
import { CriarNoCartao } from '../ui/ItensLigados';
import { ligarProcessoNaSecao, novoDerivado, ProcessosRelacionados } from './ProcessosRelacionados';

const { SD, feito, falha, confirmar } = vi.hoisted(() => ({
  SD: { colunasListar: vi.fn(), processoJudicialLigar: vi.fn(), processoJudicialDesligar: vi.fn(), processosParaPorCliente: vi.fn(),
    processoRelacionar: vi.fn(), processoDesrelacionar: vi.fn() },
  feito: vi.fn(), falha: vi.fn(), confirmar: vi.fn()
}));
vi.mock('../dados', () => ({ SD }));
vi.mock('../ui/avisos', () => ({ feito, falha, avisar: vi.fn() }));
vi.mock('../ui/janela', () => ({ confirmar }));

const base = { numero: '1', titulo: null, cliente_nome: '', etapa_id: null, arquivado_em: null, criado_em: '2026-01-01' };
const JUDICIAL: ProcessoRelacionado = { ...base, id: 'jud', codigo: 'JUD1', tipo: 'judicial', titulo: 'Ação de concessão', relacao: 'judicial' };
const ADMINISTRATIVO: ProcessoRelacionado = { ...base, id: 'adm', codigo: 'ADM1', tipo: 'administrativo', titulo: 'Pedido de benefício', relacao: 'administrativo' };
const RECURSO: ProcessoRelacionado = { ...base, id: 'rec', codigo: 'REC1', tipo: 'judicial', titulo: 'Apelação', relacao: 'recurso' };
const RELACIONADO: ProcessoRelacionado = { ...base, id: 'rel', codigo: 'REL1', tipo: 'administrativo', titulo: 'Oposição', relacao: 'relacionado' };

function mostrar(lista: ProcessoRelacionado[], processoId: string, pode = true) {
  const aoMudar = vi.fn();
  render(<MemoryRouter><CriarNoCartao pode={pode}><ProcessosRelacionados lista={lista} processoId={processoId} aoMudar={aoMudar} /></CriarNoCartao></MemoryRouter>);
  return aoMudar;
}

describe('Processos relacionados: o administrativo e o judicial (#425)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    SD.colunasListar.mockResolvedValue([]);
    SD.processoJudicialDesligar.mockResolvedValue(undefined);
    SD.processosParaPorCliente.mockResolvedValue([]);
    SD.processoRelacionar.mockResolvedValue(true);
    SD.processoDesrelacionar.mockResolvedValue(undefined);
  });

  it('dado um administrativo, quando a seção abre, então mostra o judicial, oferece o judicial novo (no menu do "+") e liga um processo existente de qualquer tipo (#440)', () => {
    // Quando
    mostrar([JUDICIAL], 'adm');
    // Então
    expect(screen.getByRole('link', { name: /Ação de concessão/ })).toHaveTextContent('Processo judicial deste administrativo');
    expect(novoDerivado('adm', 'administrativo').opcoes).toContainEqual({ para: '/processos/novo/?processo=adm&ligacao=judicial', rotulo: 'Novo processo judicial a partir deste' });
    expect(ligarProcessoNaSecao().rotulo).toBe('Ligar processo existente');
    expect(screen.getByRole('button', { name: 'Ligar processo existente' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ligar processo judicial existente' })).not.toBeInTheDocument();
  });

  it('dado um judicial, quando a seção abre, então mostra o administrativo de origem e também liga um processo existente (#440)', () => {
    // Quando
    mostrar([ADMINISTRATIVO], 'jud');
    // Então
    expect(screen.getByRole('link', { name: /Pedido de benefício/ })).toHaveTextContent('Processo administrativo de origem');
    expect(novoDerivado('jud', 'judicial').opcoes.map(o => o.rotulo)).toEqual(['Novo recurso', 'Novo incidental']);
    expect(screen.getByRole('button', { name: 'Ligar processo existente' })).toBeInTheDocument();
  });

  it('quando a pessoa liga um processo existente, então a busca deixa de fora o próprio processo e os já relacionados, e a ligação é feita com o Desfazer (#440)', async () => {
    // Dado
    SD.processosParaPorCliente.mockResolvedValue([{ id: 'out', codigo: 'OUT1', tipo: 'judicial', numero: '2', titulo: 'Ação de nulidade', cliente_nome: '' }]);
    const aoMudar = mostrar([RELACIONADO], 'jud');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Ligar processo existente' }));
    await userEvent.click(await screen.findByRole('button', { name: /Ação de nulidade/ }));
    // Então
    expect(SD.processosParaPorCliente).toHaveBeenCalledWith(expect.objectContaining({ fora: ['jud', 'rel'] }));
    expect(SD.processoRelacionar).toHaveBeenCalledWith('jud', 'out');
    expect(feito).toHaveBeenCalledWith('Processo relacionado: OUT1.', 'ligação do processo relacionado', expect.any(Function));
    expect(aoMudar).toHaveBeenCalled();
  });

  it('dado um processo relacionado, quando a seção abre, então ele aparece como "Relacionado"; o "x" desfaz a ligação, com o Desfazer (#440)', async () => {
    // Dado
    confirmar.mockResolvedValue(true);
    const aoMudar = mostrar([RELACIONADO], 'jud');
    expect(screen.getByRole('link', { name: /Oposição/ })).toHaveTextContent('Relacionado · Administrativo');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tirar a ligação com o processo REL1' }));
    // Então
    expect(SD.processoDesrelacionar).toHaveBeenCalledWith('jud', 'rel');
    expect(SD.processoJudicialDesligar).not.toHaveBeenCalled();
    expect(feito).toHaveBeenCalledWith('Ligação desfeita com o processo REL1.', 'ligação desfeita', expect.any(Function));
    expect(aoMudar).toHaveBeenCalled();
  });

  it('dado o judicial ligado, quando a pessoa clica no "x" e confirma, então a ligação se desfaz, com o Desfazer', async () => {
    // Dado
    confirmar.mockResolvedValue(true);
    const aoMudar = mostrar([ADMINISTRATIVO], 'jud');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tirar a ligação com o processo ADM1' }));
    // Então
    expect(confirmar).toHaveBeenCalled();
    expect(SD.processoJudicialDesligar).toHaveBeenCalledWith('jud');
    expect(feito).toHaveBeenCalledWith('Ligação desfeita com o processo ADM1.', 'ligação desfeita', expect.any(Function));
    expect(aoMudar).toHaveBeenCalled();
  });

  it('dado o judicial ligado, quando a pessoa clica no "x" e não confirma, então nada muda', async () => {
    // Dado
    confirmar.mockResolvedValue(false);
    mostrar([JUDICIAL], 'adm');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tirar a ligação com o processo JUD1' }));
    // Então
    expect(SD.processoJudicialDesligar).not.toHaveBeenCalled();
  });

  it('dado um recurso, quando a seção abre, então ele não tem "x": o recurso não se desliga', () => {
    // Quando
    mostrar([RECURSO], 'jud');
    // Então
    expect(screen.queryByRole('button', { name: /Tirar a ligação/ })).not.toBeInTheDocument();
  });

  it('dado o cartão arquivado ou só para ler, quando a seção abre, então não há "x" nem atalhos', () => {
    // Quando
    mostrar([JUDICIAL, RELACIONADO], 'adm', false);
    // Então
    expect(screen.queryByRole('button', { name: /Tirar a ligação/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ligar processo existente' })).not.toBeInTheDocument();
  });
});
