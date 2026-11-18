// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { useParametroLido } from './useParametroLido';

function Pagina() {
  const pessoa = useParametroLido('pessoa');
  const { search } = useLocation();
  return <><p>Lido: {pessoa ?? 'nada'}</p><p>Endereço: {search || 'vazio'}</p></>;
}
const abrir = (endereco: string) => render(<MemoryRouter initialEntries={[endereco]}><Pagina /></MemoryRouter>);

describe('Parâmetro lido uma vez do endereço', () => {
  it('dado um endereço com o parâmetro e o cartão aberto, quando a página abre, então ela recebe o valor e ele sai do endereço, que mantém o cartão', async () => {
    // Quando
    abrir('/tarefas/?pessoa=eu&id=t1');
    // Então
    expect(screen.getByText('Lido: eu')).toBeTruthy();
    expect(await screen.findByText('Endereço: ?id=t1')).toBeTruthy();
  });

  it('dado um endereço sem o parâmetro, quando a página abre, então não há valor e o endereço fica como estava', () => {
    // Quando
    abrir('/tarefas/?id=t1');
    // Então
    expect(screen.getByText('Lido: nada')).toBeTruthy();
    expect(screen.getByText('Endereço: ?id=t1')).toBeTruthy();
  });
});
