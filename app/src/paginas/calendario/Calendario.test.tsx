// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O banco fictício sempre entra como administrador; aqui o calendário é aberto como quem não é.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Orgao } from '../../dados';
import { padraoDoOrgao } from '../../regras/calendario';
import { DiasDoAno } from './DiasDoAno';
import { OrgaosDoEscritorio } from './OrgaosDoEscritorio';

const ORGAOS: Orgao[] = [{ id: 'o-tjmg', ...padraoDoOrgao('TJMG'), nome: 'Tribunal de Justiça de Minas Gerais' }];
const nada = () => undefined;

describe('Calendário para quem não é administrador', () => {
  it('quando abre os órgãos, então vê o que cada um segue, mas não cadastra, não muda nem exclui', () => {
    // Quando
    render(<OrgaosDoEscritorio orgaos={ORGAOS} ehAdmin={false} aoMudar={nada} />);
    // Então
    const linha = screen.getByRole('row', { name: /TJMG/ });
    expect(linha.textContent).toContain('Dias corridos');
    expect(linha.textContent).toContain('Sim');
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('form', { name: 'Cadastrar órgão' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Excluir/ })).toBeNull();
  });

  it('quando abre o calendário do ano, então vê os feriados, mas não lança dias', async () => {
    // Quando
    render(<DiasDoAno orgaos={ORGAOS} ehAdmin={false} versao={0} aoMudar={nada} />);
    // Então
    expect(await screen.findByText('Confraternização Universal')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Lançar dias/ })).toBeNull();
  });

  it('quando quem abre é administrador, então pode cadastrar órgãos e lançar dias', async () => {
    // Quando
    render(<><OrgaosDoEscritorio orgaos={ORGAOS} ehAdmin aoMudar={nada} /><DiasDoAno orgaos={ORGAOS} ehAdmin versao={0} aoMudar={nada} /></>);
    // Então
    expect(screen.getByRole('form', { name: 'Cadastrar órgão' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'TJMG: Recesso forense' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: /Lançar dias/ })).toBeTruthy();
  });
});
