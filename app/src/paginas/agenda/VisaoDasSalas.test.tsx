// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A visão das salas na Agenda (#438): as salas lado a lado, num dia, com os horários livres e os ocupados.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SD, type FiltroCompromissos, type OcupacaoNaSala, type Sala } from '../../dados';
import { VisaoDasSalas } from './VisaoDasSalas';

const sala = (id: string, nome: string, campos: Partial<Sala> = {}): Sala => ({ id, nome, capacidade: 6, ativa: true, criado_em: '2026-11-22T10:00:00Z', ...campos });
const ocupacao = (sala_id: string, id: string, hora: string, hora_fim: string | null, titulo: string | null): OcupacaoNaSala =>
  ({ sala_id, id, codigo: 'K' + id, tipo: 'reuniao', hora, hora_fim, titulo });
const SALAS = [sala('s1', 'Sala Azul', { capacidade: 4 }), sala('s2', 'Sala Verde')];
const montar = (aoAbrir = vi.fn(), filtro: FiltroCompromissos = {}, salas = SALAS) => {
  render(<MemoryRouter><VisaoDasSalas data="2026-11-04" salas={salas} filtro={filtro} recarga={0} endereco={id => '/agenda/?id=' + id} aoAbrir={aoAbrir} /></MemoryRouter>);
  return aoAbrir;
};

beforeEach(() => { vi.restoreAllMocks(); });

describe('A visão das salas', () => {
  it('dadas duas salas, quando a visão abre num dia, então elas ficam lado a lado, com a capacidade, e os horários livres levam ao cadastro', async () => {
    // Dado
    const ler = vi.spyOn(SD, 'salasOcupacao').mockResolvedValue([ocupacao('s2', 'b', '13:30:00', '14:30:00', 'Com o perito')]);
    // Quando
    montar();
    const grade = await screen.findByRole('table', { name: 'Salas por horário' });
    // Então
    expect(ler).toHaveBeenCalledWith('2026-11-04');
    expect(within(grade).getByRole('columnheader', { name: /Sala Azul/ })).toHaveTextContent('4 pessoas');
    expect(within(grade).getByRole('columnheader', { name: /Sala Verde/ })).toBeInTheDocument();
    expect(within(grade).getByRole('rowheader', { name: '07:00' })).toBeInTheDocument();
    expect(within(grade).getByRole('link', { name: 'Marcar em Sala Azul às 14:00' })).toHaveAttribute('href', '/agenda/novo/?sala=s1&data=2026-11-04&hora=14%3A00');
    // O livre logo antes do ocupado termina quando o outro começa
    expect(within(grade).getByRole('link', { name: 'Marcar em Sala Verde às 13:00' })).toHaveAttribute('href', '/agenda/novo/?sala=s2&data=2026-11-04&hora=13%3A00&ate=13%3A30');
  });

  it('dado um horário ocupado, quando a visão o mostra, então não há como marcar ali; de quem a pessoa não participa, aparece só "Ocupado"', async () => {
    // Dado
    vi.spyOn(SD, 'salasOcupacao').mockResolvedValue([ocupacao('s1', 'a', '09:00:00', '10:00:00', null), ocupacao('s2', 'b', '09:00:00', null, 'Com o perito')]);
    // Quando
    const aoAbrir = montar();
    const grade = await screen.findByRole('table', { name: 'Salas por horário' });
    // Então: o de quem não participa, sem o título
    expect(within(grade).getByText('Ocupado')).toBeInTheDocument();
    expect(within(grade).getAllByText('09:00 às 10:00')).toHaveLength(2);
    expect(within(grade).queryByRole('link', { name: /Sala Azul às 09:/ })).not.toBeInTheDocument();
    expect(within(grade).queryByRole('link', { name: /Sala Verde às 09:/ })).not.toBeInTheDocument();
    expect(within(grade).getByRole('link', { name: 'Marcar em Sala Azul às 10:00' })).toBeInTheDocument();
    // Quando: abre o que a pessoa vê
    await userEvent.click(within(grade).getByRole('link', { name: /Com o perito/ }));
    // Então
    expect(aoAbrir).toHaveBeenCalledWith('b');
  });

  it('dado um erro ao ler a ocupação, quando a visão abre, então mostra o erro', async () => {
    // Dado
    vi.spyOn(SD, 'salasOcupacao').mockRejectedValue(new Error('Sem conexão.'));
    // Quando
    montar();
    // Então
    expect(await screen.findByText('Sem conexão.')).toBeInTheDocument();
  });

  it('dada nenhuma sala ativa na visão, quando ela abre, então diz onde cadastrar', () => {
    // Dado
    vi.spyOn(SD, 'salasOcupacao').mockResolvedValue([]);
    // Quando
    montar(vi.fn(), {}, [sala('s9', 'Sala Antiga', { ativa: false })]);
    // Então
    expect(screen.getByText(/Nenhuma sala ativa para mostrar/)).toBeInTheDocument();
  });

  it('dado o filtro da agenda numa sala desativada, quando a visão abre, então diz que foi o filtro, e não que faltam salas', () => {
    // Dado
    vi.spyOn(SD, 'salasOcupacao').mockResolvedValue([]);
    // Quando
    montar(vi.fn(), { sala: 's9' }, [...SALAS, sala('s9', 'Sala Antiga', { ativa: false })]);
    // Então
    expect(screen.getByText('A sala escolhida no filtro está desativada. Tire o filtro de sala para ver as salas ativas.')).toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma sala ativa/)).not.toBeInTheDocument();
  });

  it('dados a busca e o filtro de pessoa ligados na agenda, quando a visão abre, então uma nota diz que eles não valem ali', async () => {
    // Dado
    vi.spyOn(SD, 'salasOcupacao').mockResolvedValue([]);
    // Quando
    montar(vi.fn(), { termo: 'perito', pessoa: 'u1' });
    await screen.findByRole('table', { name: 'Salas por horário' });
    // Então
    expect(screen.getByText('A visão das salas mostra toda a ocupação do dia: a busca e o filtro de pessoa não valem aqui.')).toBeInTheDocument();
  });

  it('dado só o filtro de sala ligado, quando a visão abre, então mostra só a sala, sem a nota dos filtros', async () => {
    // Dado
    vi.spyOn(SD, 'salasOcupacao').mockResolvedValue([]);
    // Quando
    montar(vi.fn(), { sala: 's2' });
    const grade = await screen.findByRole('table', { name: 'Salas por horário' });
    // Então
    expect(within(grade).getByRole('columnheader', { name: /Sala Verde/ })).toBeInTheDocument();
    expect(within(grade).queryByRole('columnheader', { name: /Sala Azul/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/não vale/)).not.toBeInTheDocument();
  });
});
