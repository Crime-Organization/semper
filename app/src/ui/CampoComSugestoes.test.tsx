// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CampoComSugestoes, type Sugestao } from './CampoComSugestoes';

const SUGESTOES: Sugestao[] = [{ valor: 'Ação de cobrança' }, { valor: 'Ação de indenização por danos morais' }, { valor: 'Encerrado', detalhe: 'oculta' }];

function montar(aoTeclar = vi.fn()) {
  function Tela() {
    const [valor, setValor] = useState('');
    return <CampoComSugestoes aria-label="Objeto 1" valor={valor} aoMudar={setValor} sugestoes={SUGESTOES} onKeyDown={aoTeclar} />;
  }
  render(<Tela />);
  return { campo: screen.getByRole('combobox', { name: 'Objeto 1' }), aoTeclar };
}

describe('Campo com sugestões', () => {
  it('quando ninguém diz o tipo, então o campo é de texto, para ter o estilo dos outros campos do cadastro', () => {
    // Quando
    const { campo } = montar();
    // Então
    expect(campo).toHaveAttribute('type', 'text');
  });

  it('quando quem usa diz o tipo, então vale o que foi dito', () => {
    // Quando
    render(<CampoComSugestoes aria-label="E-mail" type="email" valor="" aoMudar={vi.fn()} sugestoes={[]} />);
    // Então
    expect(screen.getByRole('combobox', { name: 'E-mail' })).toHaveAttribute('type', 'email');
  });

  it('quando a pessoa digita parte de uma sugestão, sem acento, então a lista mostra as que combinam, com o texto inteiro', async () => {
    // Dado
    const { campo } = montar();
    // Quando
    await userEvent.type(campo, 'acao');
    // Então
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['Ação de cobrança', 'Ação de indenização por danos morais']);
    expect(campo).toHaveAttribute('aria-expanded', 'true');
  });

  it('quando a pessoa desce com a seta e aperta Enter, então a sugestão vai para o campo e a lista fecha', async () => {
    // Dado
    const { campo, aoTeclar } = montar();
    await userEvent.type(campo, 'acao');
    // Quando
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    // Então
    expect(campo).toHaveValue('Ação de indenização por danos morais');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(aoTeclar).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'Enter' }));
  });

  it('quando a pessoa clica numa sugestão, então ela vai para o campo', async () => {
    // Dado
    const { campo } = montar();
    await userEvent.type(campo, 'cobr');
    // Quando
    await userEvent.click(screen.getByRole('option', { name: 'Ação de cobrança' }));
    // Então
    expect(campo).toHaveValue('Ação de cobrança');
  });

  it('quando nenhuma sugestão está destacada e a pessoa aperta Enter, então a tecla segue para a tela', async () => {
    // Dado
    const { campo, aoTeclar } = montar();
    await userEvent.type(campo, 'acao');
    // Quando
    await userEvent.keyboard('{Enter}');
    // Então
    expect(aoTeclar).toHaveBeenCalledWith(expect.objectContaining({ key: 'Enter' }));
    expect(campo).toHaveValue('acao');
  });

  it('quando a pessoa aperta Esc com a lista aberta, então só a lista fecha, e a tecla não segue para a tela', async () => {
    // Dado
    const { campo, aoTeclar } = montar();
    await userEvent.type(campo, 'acao');
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(aoTeclar).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'Escape' }));
  });

  it('quando a sugestão tem um detalhe, então ele aparece ao lado, e a seta para baixo no campo vazio abre a lista', async () => {
    // Dado
    const { campo } = montar();
    await userEvent.click(campo);
    // Quando
    await userEvent.keyboard('{ArrowDown}');
    // Então
    expect(screen.getByRole('option', { name: /Encerrado/ })).toHaveTextContent('Encerradooculta');
  });
});
