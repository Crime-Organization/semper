// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A regra mudou em 07/11/2026: antes, marcar a caixa "Sócio" abria o período hoje, num clique; agora as datas ficam à
// vista e só se grava ao salvar o período.
import { render, screen, within } from '@testing-library/react';
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
vi.mock('../../ui/avisos', () => ({ feito: vi.fn(), falha: vi.fn(), avisar: vi.fn() }));

const USUARIO = { nome: 'Ana Teste Lima', pessoa_id: 'p-ana' };
const socio = (extra: Partial<Socio>): Socio => ({ id: 's1', pessoa_id: 'p-ana', nome: 'ANA', desde: '2026-02-01', ate: null, ...extra });

describe('A sociedade na janela do usuário', () => {
  beforeEach(() => vi.clearAllMocks());

  it('dado quem não é sócio, quando clica em "Tornar sócio", então nada é gravado até salvar, e salva com as datas escolhidas', async () => {
    // Dado
    SD.financeiroSocioCriar.mockResolvedValue(socio({ id: 'novo', desde: '2026-01-01' }));
    const aoMudar = vi.fn();
    render(<SocioNaEquipe usuario={USUARIO} socios={[]} aoMudar={aoMudar} />);
    expect(screen.getByText(/não é sócio hoje/)).toBeInTheDocument();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tornar sócio' }));
    // Então: o formulário mostra a data de entrada (hoje) e nada foi gravado ainda
    const desde = screen.getByLabelText(/Desde/);
    expect(desde).toHaveValue('2026-11-07');
    expect(SD.financeiroSocioCriar).not.toHaveBeenCalled();
    // E quando muda a data e salva, então grava com ela
    await userEvent.clear(desde);
    await userEvent.type(desde, '2026-01-01');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar período' }));
    expect(SD.financeiroSocioCriar).toHaveBeenCalledWith({ pessoa_id: 'p-ana', desde: '2026-01-01', ate: null });
    expect(aoMudar).toHaveBeenCalled();
  });

  it('dado um sócio, quando abre, então vê cada período com as datas, e pode mudar ou tirar', () => {
    // Quando
    render(<SocioNaEquipe usuario={USUARIO} socios={[socio({}), socio({ id: 's0', desde: '2024-01-01', ate: '2024-12-31' }), socio({ id: 'outro', pessoa_id: 'p-bia' })]} aoMudar={vi.fn()} />);
    // Então
    const periodos = within(screen.getByRole('list', { name: 'Períodos de sócio de Ana Teste Lima' })).getAllByRole('listitem');
    expect(periodos).toHaveLength(2);
    expect(periodos[0]).toHaveTextContent('desde 01/02/2026');
    expect(periodos[1]).toHaveTextContent('desde 01/01/2024 até 31/12/2024');
    expect(screen.getByRole('button', { name: 'Outro período de sócio' })).toBeInTheDocument();
  });
});

describe('Mudar e tirar um período de sócio', () => {
  beforeEach(() => vi.clearAllMocks());

  it('dado um período, quando muda a data de saída e salva, então grava o período com as datas novas', async () => {
    // Dado
    SD.financeiroSocioAtualizar.mockResolvedValue();
    const aoMudar = vi.fn();
    render(<SocioNaEquipe usuario={USUARIO} socios={[socio({})]} aoMudar={aoMudar} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Mudar o período desde 01/02/2026' }));
    await userEvent.type(screen.getByLabelText(/Até/), '2026-10-31');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar período' }));
    // Então
    expect(SD.financeiroSocioAtualizar).toHaveBeenCalledWith('s1', { desde: '2026-02-01', ate: '2026-10-31' });
    expect(aoMudar).toHaveBeenCalled();
  });

  it('dado um período, quando tira e confirma, então o período sai', async () => {
    // Dado
    SD.financeiroSocioExcluir.mockResolvedValue();
    render(<SocioNaEquipe usuario={USUARIO} socios={[socio({})]} aoMudar={vi.fn()} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tirar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar: tirar' }));
    // Então
    expect(SD.financeiroSocioExcluir).toHaveBeenCalledWith('s1');
  });
});
