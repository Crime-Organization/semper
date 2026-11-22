// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A seção "Demandas relacionadas" do cartão da demanda (#310): a que a pessoa vê abre; a que ela não vê mostra só o número.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SD, type Coluna, type DemandaRelacionada } from '../dados';
import { DETALHE_SEM_ACESSO, RELACIONADA_SEM_ACESSO } from '../regras/demandasRelacionadas';
import { DemandasRelacionadas } from './DemandasRelacionadas';

const COLUNAS = [{ id: 'fazer', nome: 'Para fazer', ordem: 1, grupo_id: null, criado_por: null, oculta: false, marco: 'inicio' }] as Coluna[];
const VISIVEL: DemandaRelacionada = { id: 'd2', codigo: 'AB12CD34', demanda: { titulo: 'Recurso da sentença', prazo: null, prazo_hora: null, etapa_id: 'fazer', arquivado_em: null } };
const OCULTA: DemandaRelacionada = { id: 'd3', codigo: 'EF56GH78', demanda: null };

function mostrar(relacionadas: DemandaRelacionada[], somenteLer = false, aoMudar = () => undefined) {
  render(<MemoryRouter><DemandasRelacionadas demandaId="d1" relacionadas={relacionadas} colunas={COLUNAS} somenteLer={somenteLer} aoMudar={aoMudar} /></MemoryRouter>);
}

describe('Demandas relacionadas no cartão da demanda (#310)', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('dada uma relacionada que a pessoa vê, quando a seção abre, então o quadrinho tem o número, o título e a situação, e abre o cartão dela', () => {
    // Quando
    mostrar([VISIVEL]);
    // Então
    const link = screen.getByRole('link', { name: /Recurso da sentença/ });
    expect(link).toHaveAttribute('href', '/demandas/?id=d2');
    expect(link).toHaveTextContent('AB12CD34');
    expect(link).toHaveTextContent(/Para fazer/i);   // a situação vem como o quadro a escreve, em maiúsculas
  });

  it('dada uma relacionada que a pessoa não vê, quando a seção abre, então aparece só o número, sem o título e sem o link', () => {
    // Quando
    mostrar([OCULTA]);
    // Então
    const lista = screen.getByRole('list', { name: 'Demandas relacionadas' });
    expect(lista).toHaveTextContent('EF56GH78');
    expect(lista).toHaveTextContent(RELACIONADA_SEM_ACESSO);
    expect(lista).toHaveTextContent(DETALHE_SEM_ACESSO);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('dado quem altera a demanda, quando clica no X de uma relacionada, então a ligação é desfeita e o cartão lê de novo', async () => {
    // Dado
    const desfazer = vi.spyOn(SD, 'demandaDesrelacionar').mockResolvedValue(undefined);
    const aoMudar = vi.fn();
    mostrar([VISIVEL, OCULTA], false, aoMudar);
    // Quando
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer a ligação com a demanda EF56GH78' }));
    // Então
    await waitFor(() => expect(aoMudar).toHaveBeenCalled());
    expect(desfazer).toHaveBeenCalledWith('d1', 'd3');
  });

  it('dado quem só lê a demanda, quando a seção abre, então não há X nem "Ligar demanda existente"', () => {
    // Quando
    mostrar([VISIVEL], true);
    // Então
    expect(screen.queryByRole('button', { name: /Desfazer a ligação/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ligar demanda existente/ })).not.toBeInTheDocument();
  });

  it('dada uma demanda sem relacionadas, quando a seção abre, então diz que não há nenhuma e oferece ligar uma', () => {
    // Quando
    mostrar([]);
    // Então
    expect(screen.getByText('Nenhuma demanda relacionada a esta.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ligar demanda existente/ })).toBeInTheDocument();
  });
});
