// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DadosParcelas, Socio } from '../../dados';
import { SocioNaEquipe } from './SocioNaEquipe';

const SD = vi.hoisted(() => ({
  financeiroSocioCriar: vi.fn<DadosParcelas['financeiroSocioCriar']>(),
  financeiroSocioAtualizar: vi.fn<DadosParcelas['financeiroSocioAtualizar']>(),
  financeiroSocioExcluir: vi.fn<DadosParcelas['financeiroSocioExcluir']>(),
  financeiroSocioRestaurar: vi.fn<DadosParcelas['financeiroSocioRestaurar']>()
}));
vi.mock('../../dados', () => ({ SD }));
vi.mock('../../ui/util', () => ({ hojeISO: () => '2026-11-07' }));
vi.mock('../../ui/avisos', () => ({ feito: vi.fn(), falha: vi.fn() }));

const USUARIO = { nome: 'Ana Teste Lima', pessoa_id: 'p-ana' };
const socio = (extra: Partial<Socio>): Socio => ({ id: 's1', pessoa_id: 'p-ana', nome: 'ANA', desde: '2026-02-01', ate: null, ...extra });

describe('A marca de sócio em Equipe e acessos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('dado quem não é sócio, quando marca, então o período começa hoje, sem fim', async () => {
    // Dado
    SD.financeiroSocioCriar.mockResolvedValue(socio({ id: 'novo', desde: '2026-11-07' }));
    const aoMudar = vi.fn();
    render(<SocioNaEquipe usuario={USUARIO} socios={[]} aoMudar={aoMudar} />);
    expect(screen.getByRole('checkbox', { name: 'Ana Teste Lima é sócio' })).not.toBeChecked();
    // Quando
    await userEvent.click(screen.getByRole('checkbox', { name: 'Ana Teste Lima é sócio' }));
    // Então
    expect(SD.financeiroSocioCriar).toHaveBeenCalledWith({ pessoa_id: 'p-ana', desde: '2026-11-07', ate: null });
    expect(aoMudar).toHaveBeenCalled();
  });

  it('dado um sócio de antes, quando desmarca, então o período termina hoje e o histórico fica', async () => {
    // Dado
    render(<SocioNaEquipe usuario={USUARIO} socios={[socio({})]} aoMudar={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: 'Ana Teste Lima é sócio' })).toBeChecked();
    expect(screen.getByText(/desde 01\/02\/2026/)).toBeInTheDocument();
    // Quando
    await userEvent.click(screen.getByRole('checkbox', { name: 'Ana Teste Lima é sócio' }));
    // Então
    expect(SD.financeiroSocioAtualizar).toHaveBeenCalledWith('s1', { desde: '2026-02-01', ate: '2026-11-07' });
    expect(SD.financeiroSocioExcluir).not.toHaveBeenCalled();
  });

  it('dado um sócio marcado hoje, quando desmarca, então o período some', async () => {
    // Dado
    render(<SocioNaEquipe usuario={USUARIO} socios={[socio({ desde: '2026-11-07' })]} aoMudar={vi.fn()} />);
    // Quando
    await userEvent.click(screen.getByRole('checkbox', { name: 'Ana Teste Lima é sócio' }));
    // Então
    expect(SD.financeiroSocioExcluir).toHaveBeenCalledWith('s1');
    expect(SD.financeiroSocioAtualizar).not.toHaveBeenCalled();
  });
});
