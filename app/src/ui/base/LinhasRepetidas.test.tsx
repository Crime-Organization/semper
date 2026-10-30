// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { LinhasRepetidas, type ColunaDaLinha } from './LinhasRepetidas';

type Inscricao = { numero: string; uf: string };
const COLUNAS: ColunaDaLinha<Inscricao>[] = [
  { campo: 'numero', rotulo: 'Número', maximo: 20 },
  { campo: 'uf', rotulo: 'UF', maximo: 2, opcoes: ['MG', 'SP'] }
];

/** As linhas numa tela de teste; "visto" recebe a lista a cada mudança. */
function Inscricoes({ inicio = [], maximo = 3, erro, visto }: { inicio?: Inscricao[]; maximo?: number; erro?: string; visto?: (l: Inscricao[]) => void }) {
  const [linhas, setLinhas] = useState(inicio);
  return <LinhasRepetidas rotulo="Inscrições na OAB" item="inscrição" artigo="a" linhas={linhas} colunas={COLUNAS} nova={{ numero: '', uf: '' }}
    maximo={maximo} erro={erro} aoMudar={l => { setLinhas(l); visto?.(l); }} />;
}

describe('Linhas repetidas', () => {
  it('quando a pessoa acrescenta uma linha e preenche, então a lista muda com os campos dela', async () => {
    // Dado
    let lista: Inscricao[] = [];
    render(<Inscricoes visto={l => { lista = l; }} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar inscrição' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Número (inscrição 1)' }), '123');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'UF (inscrição 1)' }), 'MG');
    // Então
    expect(lista).toEqual([{ numero: '123', uf: 'MG' }]);
    expect(screen.getByRole('group', { name: 'Inscrições na OAB' })).toBeTruthy();
  });

  it('quando a pessoa clica em "Adicionar", então o cursor vai para o primeiro campo da linha nova', async () => {
    // Dado
    render(<Inscricoes inicio={[{ numero: '1', uf: 'MG' }]} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar inscrição' }));
    // Então
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Número (inscrição 2)' }));
  });

  it('quando a pessoa tira a primeira linha, então fica só a segunda', async () => {
    // Dado
    let lista: Inscricao[] = [];
    render(<Inscricoes inicio={[{ numero: '1', uf: 'MG' }, { numero: '2', uf: 'SP' }]} visto={l => { lista = l; }} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tirar a inscrição 1' }));
    // Então
    expect(lista).toEqual([{ numero: '2', uf: 'SP' }]);
    expect((screen.getByRole('textbox', { name: 'Número (inscrição 1)' }) as HTMLInputElement).value).toBe('2');
  });

  it('quando a lista chega ao máximo, então não dá para acrescentar outra', () => {
    // Quando
    render(<Inscricoes inicio={[{ numero: '1', uf: 'MG' }]} maximo={1} />);
    // Então
    expect((screen.getByRole('button', { name: 'Adicionar inscrição' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('quando há erro, então a mensagem aparece e fica ligada ao grupo', () => {
    // Quando
    render(<Inscricoes erro="Informe o número de cada inscrição." />);
    // Então
    const grupo = screen.getByRole('group', { name: 'Inscrições na OAB' });
    expect(screen.getByRole('alert').textContent).toBe('Informe o número de cada inscrição.');
    expect(grupo.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
  });
});
