// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { voltaDoMenu } from '../regras/origemDoCadastro';
import { MaisDoMenu } from './MaisDoMenu';

/** O cadastro de mentira: mostra para onde ele voltaria depois de gravar. */
function Cadastro() {
  const { state } = useLocation();
  return <p>Volta para: {voltaDoMenu(state, '/agenda/novo/') ?? 'nenhum lugar'}</p>;
}
const abrir = (endereco: string) => render(<MemoryRouter initialEntries={[endereco]}>
  <MaisDoMenu para="/agenda/novo/" rotulo="Cadastrar compromisso" />
  <Routes>
    <Route path="/agenda/novo/" element={<Cadastro />} />
    <Route path="*" element={<p>Outra tela</p>} />
  </Routes>
</MemoryRouter>);

describe('O "+" do menu lateral', () => {
  it('quando o menu mostra o "+", então ele tem o nome e a dica do cadastro', () => {
    // Quando
    abrir('/inicio/');
    // Então
    const mais = screen.getByRole('link', { name: 'Cadastrar compromisso' });
    expect(mais.getAttribute('title')).toBe('Cadastrar compromisso');
    expect(mais.getAttribute('href')).toBe('/agenda/novo/');
  });

  it('dado a pessoa numa tela, quando clica no "+", então o cadastro abre sabendo voltar para essa tela', async () => {
    // Dado
    abrir('/tarefas/?id=t1');
    // Quando
    await userEvent.click(screen.getByRole('link', { name: 'Cadastrar compromisso' }));
    // Então
    expect(screen.getByText('Volta para: /tarefas/?id=t1')).toBeTruthy();
  });

  it('dado a pessoa já no cadastro, quando clica no "+" de novo, então o cadastro não volta para ele mesmo', async () => {
    // Dado
    abrir('/agenda/novo/');
    // Quando
    await userEvent.click(screen.getByRole('link', { name: 'Cadastrar compromisso' }));
    // Então
    expect(screen.getByText('Volta para: nenhum lugar')).toBeTruthy();
  });
});
