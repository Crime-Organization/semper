// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Avisos } from '../avisos';
import { Janelas } from '../janela';
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
    // A #303 acrescentou Cabeçalho e Link à barra
    expect(screen.getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(['Negrito (Ctrl+B)', 'Itálico (Ctrl+I)', 'Cabeçalho', 'Lista', 'Link']);
  });
});

describe('Títulos e links no texto (#303)', () => {
  it('dadas linhas com "#", "##" e "###", quando aparecem, então viram títulos abaixo dos do cartão (h3, h4 e h5), sem as marcas', () => {
    // Quando
    const { container } = render(<TextoFormatado texto={'# Resumo\n## Fatos\n### Detalhe\nTexto'} />);
    // Então
    expect(screen.getByRole('heading', { name: 'Resumo', level: 3 })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Fatos', level: 4 })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Detalhe', level: 5 })).toBeTruthy();
    expect(container.textContent).not.toContain('#');
  });

  it('dado um link para um site, quando aparece, então abre em aba nova, sem dar acesso a esta página, e com o negrito dentro', () => {
    // Quando
    render(<TextoFormatado texto={'Ver [o **site** novo](https://exemplo.com/a)'} />);
    // Então
    const link = screen.getByRole('link', { name: 'o site novo' });
    expect(link.getAttribute('href')).toBe('https://exemplo.com/a');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getByText('site').tagName).toBe('STRONG');
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('dado um link de e-mail, quando aparece, então abre o e-mail, sem aba nova', () => {
    // Quando
    render(<TextoFormatado texto={'[Escreva](mailto:contato@exemplo.com)'} />);
    // Então
    const link = screen.getByRole('link', { name: 'Escreva' });
    expect(link.getAttribute('href')).toBe('mailto:contato@exemplo.com');
    expect(link.getAttribute('target')).toBeNull();
  });

  it.each([['[x](javascript:alert)'], ['[x](JAVASCRIPT:alert)'], ['[x](data:text/html,oi)'], ['[x](/relativo)']])('dado "%s", quando aparece, então fica como texto, sem link', texto => {
    // Quando
    const { container } = render(<TextoFormatado texto={texto} />);
    // Então
    expect(screen.queryByRole('link')).toBeNull();
    expect(container.textContent).toBe(texto);
  });

  it('dado um link dentro de algo que abre ao clicar, quando clica no link, então o clique não chega lá', () => {
    // Dado
    const abriu = vi.fn();
    render(<div onClick={abriu}><TextoFormatado texto={'[site](https://exemplo.com)'} /></div>);
    // Quando
    fireEvent.click(screen.getByRole('link', { name: 'site' }));
    // Então
    expect(abriu).not.toHaveBeenCalled();
  });
});

function CaixaComJanelas({ inicial }: { inicial: string }) {
  return <><Caixa inicial={inicial} /><Janelas /><Avisos /></>;
}

describe('Botões Cabeçalho e Link da caixa (#303)', () => {
  it('dado o cursor numa linha, quando clica em Cabeçalho, então ela vira título; clicando de novo, volta a texto', () => {
    // Dado
    render(<Caixa inicial={'Fatos\nTexto'} />);
    const caixa = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Descrição' });
    escolher(caixa, 2, 2);
    // Quando
    fireEvent.click(screen.getByRole('button', { name: 'Cabeçalho' }));
    // Então
    expect(caixa.value).toBe('## Fatos\nTexto');
    // Quando
    escolher(caixa, 4, 4);
    fireEvent.click(screen.getByRole('button', { name: 'Cabeçalho' }));
    // Então
    expect(caixa.value).toBe('Fatos\nTexto');
  });

  it('dado um trecho escolhido, quando clica em Link e informa o endereço, então o trecho vira link', async () => {
    // Dado
    render(<CaixaComJanelas inicial="Ver o site" />);
    const caixa = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Descrição' });
    escolher(caixa, 4, 10);
    // Quando
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Endereço do link' }), { target: { value: 'https://exemplo.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    // Então
    await waitFor(() => expect(caixa.value).toBe('Ver [o site](https://exemplo.com/)'));
  });

  it.each([['javascript:alert(1)'], ['www.exemplo.com']])('dado o endereço "%s", quando clica em Link e o informa, então aparece um aviso e o texto não muda', async endereco => {
    // Dado
    render(<CaixaComJanelas inicial="Ver o site" />);
    const caixa = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Descrição' });
    escolher(caixa, 4, 10);
    // Quando
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Endereço do link' }), { target: { value: endereco } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    // Então
    expect(await screen.findByText(/Esse endereço não vira link/)).toBeTruthy();
    expect(caixa.value).toBe('Ver o site');
  });

  it('dado a janela do endereço aberta, quando cancela, então o texto não muda', async () => {
    // Dado
    render(<CaixaComJanelas inicial="Ver o site" />);
    const caixa = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Descrição' });
    escolher(caixa, 4, 10);
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    // Quando
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    // Então
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(caixa.value).toBe('Ver o site');
  });

  it('dado o cursor dentro de um link, quando clica em Link, então o link sai sem pedir endereço', () => {
    // Dado
    render(<CaixaComJanelas inicial="Ver [o site](https://exemplo.com/)" />);
    const caixa = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Descrição' });
    escolher(caixa, 6, 6);
    // Quando
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    // Então
    expect(caixa.value).toBe('Ver o site');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

function CaixaCurta({ inicial, maximo }: { inicial: string; maximo: number }) {
  const [valor, setValor] = useState(inicial);
  return <><CaixaFormatada aria-label="Descrição" valor={valor} aoMudar={setValor} maxLength={maximo} /><Janelas /><Avisos /></>;
}

/** Escolhe o trecho, aperta Link e informa o endereço. */
async function porLinkNaCaixa(inicio: number, fim: number, endereco: string) {
  const caixa = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Descrição' });
  escolher(caixa, inicio, fim);
  fireEvent.click(screen.getByRole('button', { name: 'Link' }));
  fireEvent.change(await screen.findByRole('textbox', { name: 'Endereço do link' }), { target: { value: endereco } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
  return caixa;
}

describe('Botão Link quando o link não pode entrar (#303)', () => {
  it('dado um texto perto do limite da caixa, quando põe um link que não cabe, então aparece um aviso e o texto não muda', async () => {
    // Dado
    render(<CaixaCurta inicial="Ver o site" maximo={20} />);
    // Quando
    const caixa = await porLinkNaCaixa(4, 10, 'https://exemplo.com');
    // Então
    expect(await screen.findByText(/não cabe/)).toBeTruthy();
    expect(caixa.value).toBe('Ver o site');
  });

  it('dado um trecho com colchetes, quando põe o link, então aparece um aviso e o texto não muda', async () => {
    // Dado
    render(<CaixaComJanelas inicial="Ver [nota] hoje" />);
    // Quando
    const caixa = await porLinkNaCaixa(4, 10, 'https://exemplo.com');
    // Então
    expect(await screen.findByText(/Esse trecho não vira link/)).toBeTruthy();
    expect(caixa.value).toBe('Ver [nota] hoje');
  });

  it('dado o cursor no endereço de um link, quando clica em Link, então o link sai sem pedir endereço, em vez de pôr outro dentro dele', () => {
    // Dado
    render(<CaixaComJanelas inicial="Ver [o site](https://exemplo.com/)" />);
    const caixa = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Descrição' });
    escolher(caixa, 20, 20);
    // Quando
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    // Então
    expect(caixa.value).toBe('Ver o site');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
