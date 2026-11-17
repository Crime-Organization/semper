// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { CaixaFormatada, TextoFormatado } from './TextoFormatado';

describe('Texto formatado (#293)', () => {
  it('dada uma descrição com marcas e lista, quando aparece, então mostra negrito, itálico e a lista, sem as marcas', () => {
    // Quando
    const { container } = render(<TextoFormatado texto={'Juntar **procuração** e *comprovante*\n- RG\n- CPF'} />);
    // Então
    expect(screen.getByText('procuração').tagName).toBe('STRONG');
    expect(screen.getByText('comprovante').tagName).toBe('EM');
    expect(screen.getAllByRole('listitem').map(li => li.textContent)).toEqual(['RG', 'CPF']);
    expect(container.textContent).not.toContain('*');
  });

  it('dado texto parecido com código de página, quando aparece, então é escrito como está e nada vira elemento', () => {
    // Dado
    const codigo = '<script>alert(1)</script> <img src=x onerror=alert(1)>';
    // Quando
    const { container } = render(<TextoFormatado texto={codigo} />);
    // Então
    expect(container.textContent).toBe(codigo);
    expect(container.querySelector('script, img')).toBeNull();
  });

  it('dada uma descrição antiga com linhas em branco, quando aparece, então as quebras ficam iguais', () => {
    // Quando
    const { container } = render(<TextoFormatado texto={'Primeira\n\nTerceira'} />);
    // Então
    expect(container.textContent).toBe('Primeira\n\nTerceira');
  });
});

function Caixa({ inicial = '' }: { inicial?: string }) {
  const [valor, setValor] = useState(inicial);
  return <CaixaFormatada aria-label="Descrição" valor={valor} aoMudar={setValor} />;
}
const escolher = (caixa: HTMLTextAreaElement, inicio: number, fim: number) => caixa.setSelectionRange(inicio, fim);

describe('Caixa com a barra B, I e lista (#293)', () => {
  it('dado um trecho escolhido, quando clica em B, então ele fica entre as marcas do negrito; clicando de novo, as marcas saem', () => {
    // Dado
    render(<Caixa inicial="Juntar procuração" />);
    const caixa = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Descrição' });
    escolher(caixa, 7, 17);
    // Quando
    fireEvent.click(screen.getByRole('button', { name: 'Negrito (Ctrl+B)' }));
    // Então
    expect(caixa.value).toBe('Juntar **procuração**');
    // Quando
    escolher(caixa, 9, 19);
    fireEvent.click(screen.getByRole('button', { name: 'Negrito (Ctrl+B)' }));
    // Então
    expect(caixa.value).toBe('Juntar procuração');
  });

  it('dado um trecho escolhido, quando aperta Ctrl+I na caixa, então ele fica em itálico, e o navegador não recebe o atalho', () => {
    // Dado
    render(<Caixa inicial="Juntar comprovante" />);
    const caixa = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Descrição' });
    escolher(caixa, 7, 18);
    // Quando
    const seguiu = fireEvent.keyDown(caixa, { key: 'i', ctrlKey: true });
    // Então
    expect(caixa.value).toBe('Juntar *comprovante*');
    expect(seguiu).toBe(false);
  });

  it('dadas duas linhas escolhidas, quando clica em Lista, então as duas viram itens', () => {
    // Dado
    render(<Caixa inicial={'RG\nCPF'} />);
    const caixa = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Descrição' });
    escolher(caixa, 0, 6);
    // Quando
    fireEvent.click(screen.getByRole('button', { name: 'Lista' }));
    // Então
    expect(caixa.value).toBe('- RG\n- CPF');
  });

  it('dada a caixa, quando a pessoa usa o teclado, então a barra tem um nome e os botões dizem o atalho', () => {
    // Quando
    render(<Caixa />);
    // Então
    expect(screen.getByRole('toolbar', { name: 'Formatação do texto' })).toBeTruthy();
    expect(screen.getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(['Negrito (Ctrl+B)', 'Itálico (Ctrl+I)', 'Lista']);
  });
});
