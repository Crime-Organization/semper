// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A busca de cada módulo para ligar, no cartão de um item, outro que já existe (#341, etapa 2).
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DadosParaLigar, DadosPessoas, DemandaParaEscolher, PessoaLista } from '../dados';
import { ITENS_PARA_LIGAR } from '../dados/limites';
import { LigarDoModulo } from './LigarDoModulo';
import { AcoesDosLigados } from './ItensLigados';
import { MemoryRouter } from 'react-router';

const { demandasParaLigar, pessoasListar } = vi.hoisted(() => ({
  demandasParaLigar: vi.fn<DadosParaLigar['demandasParaLigar']>(),
  pessoasListar: vi.fn<DadosPessoas['pessoasListar']>()
}));
vi.mock('../dados', () => ({ SD: { demandasParaLigar, pessoasListar } satisfies Pick<DadosParaLigar & DadosPessoas, 'demandasParaLigar' | 'pessoasListar'> }));

const demanda = (extra: Partial<DemandaParaEscolher>): DemandaParaEscolher =>
  ({ id: 'd1', codigo: 'D-1', titulo: 'Registro de marca', cliente_nome: 'JOSÉ; MARIA', contrato_id: null, contrato_codigo: null, prazo: null, clientes: ['p1', 'p2'], ...extra });
const pessoa = (id: string, nome: string) => ({ id, nome, tipo: 'pf', documento: null, codigo: 'P' + id }) as PessoaLista;

describe('Ligar, no cartão, um item de outro módulo', () => {
  beforeEach(() => {
    demandasParaLigar.mockReset();
    pessoasListar.mockReset();
  });

  it('dada uma pessoa, quando abre "Ligar demanda existente", então busca as demandas sem ela e mostra o título, o código, os clientes e o contrato', async () => {
    // Dado
    demandasParaLigar.mockResolvedValue([demanda({ contrato_codigo: '0163/2026' })]);
    render(<LigarDoModulo modulo="demandas" filtro={{ semAPessoa: 'p9' }} aoEscolher={() => undefined} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Ligar demanda existente' }));
    // Então
    const achado = await screen.findByRole('button', { name: /Registro de marca/ });
    expect(achado).toHaveTextContent('D-1 · JOSÉ e MARIA · Contrato 0163/2026');
    expect(demandasParaLigar).toHaveBeenCalledWith({ semAPessoa: 'p9', termo: '' });
  });

  it('dado um motivo, quando o achado não pode ser escolhido, então ele aparece desabilitado com o motivo no lugar do detalhe', async () => {
    // Dado
    demandasParaLigar.mockResolvedValue([demanda({})]);
    const aoEscolher = vi.fn();
    render(<LigarDoModulo modulo="demandas" motivo={() => 'Já tem 10 clientes, o máximo.'} aoEscolher={aoEscolher} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Ligar demanda existente' }));
    // Então
    const achado = await screen.findByRole('button', { name: /Registro de marca/ });
    expect(achado).toBeDisabled();
    expect(achado).toHaveTextContent('Já tem 10 clientes, o máximo.');
  });

  it('dado um filtro que precisa ser lido na hora, quando a busca abre, então ele é lido antes de buscar', async () => {
    // Dado
    demandasParaLigar.mockResolvedValue([]);
    const filtro = vi.fn(async () => ({ fora: ['d7'] }));
    render(<LigarDoModulo modulo="demandas" filtro={filtro} aoEscolher={() => undefined} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Ligar demanda existente' }));
    // Então
    expect(await screen.findByText('Nenhuma demanda ativa que você possa ligar.')).toBeInTheDocument();
    expect(demandasParaLigar).toHaveBeenCalledWith({ fora: ['d7'], termo: '' });
  });

  it('dadas pessoas já ligadas ao item, quando busca pessoas, então elas não aparecem, e escolher uma avisa quem usa', async () => {
    // Dado
    pessoasListar.mockResolvedValue({ linhas: [pessoa('p1', 'JOSÉ'), pessoa('p2', 'MARIA')], total: 2 });
    const aoEscolher = vi.fn();
    render(<LigarDoModulo modulo="pessoas" rotulo="Ligar cliente existente" filtro={{ fora: ['p1'] }} aoEscolher={aoEscolher} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Ligar cliente existente' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Buscar pessoa para ligar' }), 'a');
    await waitFor(() => expect(pessoasListar).toHaveBeenLastCalledWith({ termo: 'a', porPagina: ITENS_PARA_LIGAR + 1 }));
    const lista = screen.getByRole('list', { name: 'Pessoas para ligar' });
    await userEvent.click(await within(lista).findByRole('button', { name: /MARIA/ }));
    // Então
    expect(screen.queryByRole('button', { name: /JOSÉ/ })).not.toBeInTheDocument();
    expect(aoEscolher).toHaveBeenCalledWith(expect.objectContaining({ id: 'p2' }));
  });

  it('dada a lista do item cheia, então o botão aparece desabilitado com o motivo', () => {
    // Dado / Quando
    render(<LigarDoModulo modulo="pessoas" indisponivel="Este processo já tem 10 clientes, o máximo." aoEscolher={() => undefined} />);
    // Então
    expect(screen.getByRole('button', { name: 'Ligar pessoa existente' })).toBeDisabled();
    expect(screen.getByText('Este processo já tem 10 clientes, o máximo.')).toBeInTheDocument();
  });
});

describe('As ações embaixo da lista da seção', () => {
  it('dado o atalho do item novo, então ele aparece ao lado do botão de ligar', () => {
    // Dado / Quando
    render(<MemoryRouter><AcoesDosLigados novo={{ para: '/tarefas/nova/?pessoa=p1', rotulo: 'Nova tarefa' }}>
      <LigarDoModulo modulo="pessoas" aoEscolher={() => undefined} />
    </AcoesDosLigados></MemoryRouter>);
    // Então
    expect(screen.getByRole('button', { name: 'Ligar pessoa existente' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nova tarefa' })).toHaveAttribute('href', '/tarefas/nova/?pessoa=p1');
  });
});
