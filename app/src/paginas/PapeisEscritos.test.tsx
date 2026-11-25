// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Em Configurações, a lista dos papéis escritos pela equipe nos processos (#443): ver e tirar da lista, com o Desfazer.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { SD, type PapelEscrito } from '../dados';
import { feito } from '../ui/avisos';
import { PapeisEscritos } from './PapeisEscritos';

vi.mock('../ui/avisos', async original => ({ ...await original<typeof import('../ui/avisos')>(), feito: vi.fn() }));

const INVENTARIANTE: PapelEscrito = { id: 'x1', nome: 'Inventariante' };

describe('Papéis escritos nos processos, nas Configurações', () => {
  let lista: PapelEscrito[];
  let tirar: MockInstance<typeof SD.processoPapelEscritoTirar>, devolver: MockInstance<typeof SD.processoPapeisIncluir>;
  beforeEach(() => {
    lista = [{ id: 'x2', nome: 'Curador' }, INVENTARIANTE];
    vi.mocked(feito).mockClear();
    vi.spyOn(SD, 'processoPapeisEscritos').mockImplementation(async () => [...lista]);
    tirar = vi.spyOn(SD, 'processoPapelEscritoTirar').mockImplementation(async id => { lista = lista.filter(x => x.id !== id); });
    devolver = vi.spyOn(SD, 'processoPapeisIncluir').mockImplementation(async nomes => { lista.push(...nomes.map(nome => ({ id: 'x9', nome }))); });
  });

  it('dado um escritório com papéis escritos, quando a seção abre, então mostra cada um', async () => {
    // Quando
    render(<PapeisEscritos />);
    // Então
    expect(screen.getByRole('heading', { name: 'Papéis escritos nos processos' })).toBeInTheDocument();
    expect(await screen.findByRole('cell', { name: 'Inventariante' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Curador' })).toBeInTheDocument();
  });

  it('dado um papel, quando o administrador clica em "Tirar da lista" e confirma, então ele sai da lista, e o Desfazer o devolve', async () => {
    // Dado
    render(<PapeisEscritos />);
    await screen.findByRole('cell', { name: 'Inventariante' });
    // Quando: o primeiro clique só pede a confirmação
    await userEvent.click(screen.getAllByRole('button', { name: 'Tirar da lista' })[1]);
    expect(tirar).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar: tirar da lista' }));
    // Então
    expect(tirar).toHaveBeenCalledWith('x1');
    expect(await screen.findByRole('cell', { name: 'Curador' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Inventariante' })).toBeNull();
    // E o Desfazer devolve o papel à lista
    const desfazer = vi.mocked(feito).mock.calls[0][2]!;
    await desfazer();
    expect(devolver).toHaveBeenCalledWith(['Inventariante']);
  });

  it('dado um escritório sem papéis escritos, quando a seção abre, então diz que ainda não há nenhum', async () => {
    // Dado
    lista = [];
    // Quando
    render(<PapeisEscritos />);
    // Então
    expect(await screen.findByText('Nenhum papel escrito ainda.')).toBeInTheDocument();
  });
});
