// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// As pessoas com papel no cartão do processo e os recursos e incidentais ligados a ele (#316).
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIRMAR_O_TIRAR } from '../ui/base';
import { Janelas } from '../ui/janela';
import { SD, type ParteDoProcesso, type PessoaResumida, type ProcessoRelacionado } from '../dados';
import { CriarNoCartao } from '../ui/ItensLigados';
import { Recolhivel } from '../ui/Recolhivel';
import { LIGAR_PARTE, LIGAR_PARTE_NO_TITULO, ligarParte, PartesDoProcesso } from './PartesDoProcesso';
import { novoDerivado, ProcessosRelacionados } from './ProcessosRelacionados';

const PESSOA = { id: 'p1', codigo: 'P1', nome: 'TESTEMUNHA TESTE', arquivado_em: null } as PessoaResumida;
const PARTE: ParteDoProcesso = { id: 'x1', processo_id: 'pr1', papel: 'testemunha', pessoa: PESSOA };

function mostrarPartes(partes: ParteDoProcesso[] | undefined, podeMudar = true) {
  const aoMudar = vi.fn();
  render(<MemoryRouter><PartesDoProcesso processoId="pr1" partes={partes} podeMudar={podeMudar} aoMudar={aoMudar} /></MemoryRouter>);
  return aoMudar;
}

describe('Pessoas com papel no cartão do processo', () => {
  it('dado um processo com uma testemunha, quando a seção abre, então ela aparece com o papel e o link para o cartão dela', () => {
    // Quando
    mostrarPartes([PARTE]);
    // Então
    const link = screen.getByRole('link', { name: /TESTEMUNHA TESTE/ });
    expect(link).toHaveAttribute('href', '/pessoas/?id=p1');
    expect(link).toHaveTextContent('Testemunha');
  });

  // A regra mudou (#424, decisão do dono): o x pergunta antes de tirar.
  it('dado quem altera o processo, quando tira a pessoa e confirma, então ela sai do papel e o cartão lê de novo', async () => {
    // Dado
    const retirar = vi.spyOn(SD, 'processoParteRetirar').mockResolvedValue();
    const aoMudar = mostrarPartes([PARTE]);
    render(<Janelas />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tirar TESTEMUNHA TESTE (Testemunha) do processo' }));
    expect(retirar).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: CONFIRMAR_O_TIRAR }));
    // Então
    expect(retirar).toHaveBeenCalledWith('x1');
    expect(aoMudar).toHaveBeenCalled();
  });

  it('dado quem altera o processo, quando abre o formulário sem escolher o papel, então pede o papel antes de ligar', async () => {
    // Dado
    const incluir = vi.spyOn(SD, 'processoParteIncluir');
    mostrarPartes([]);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: LIGAR_PARTE }));
    await userEvent.click(screen.getByRole('button', { name: 'Ligar ao processo' }));
    // Então
    expect(screen.getByText('Escolha o papel da pessoa no processo.')).toBeInTheDocument();
    expect(incluir).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox', { name: /Papel no processo/ })).toBeInTheDocument();
  });

  it('dado quem só lê o processo, quando a seção abre, então não há como pôr nem tirar pessoas', () => {
    // Quando
    mostrarPartes([PARTE], false);
    // Então
    expect(screen.queryByRole('button', { name: LIGAR_PARTE })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tirar/ })).not.toBeInTheDocument();
  });

  it('dado a lista ainda lendo, quando a seção abre, então mostra que está carregando', () => {
    // Quando
    mostrarPartes(undefined);
    // Então
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…');
    expect(screen.queryByText(/Nenhuma pessoa com papel/)).not.toBeInTheDocument();
  });
});

describe('A corrente "Ligar pessoa com papel" no título da seção (#427)', () => {
  it('dada a seção com a corrente, quando ela abre, então não há o botão embaixo; e a corrente abre o formulário, com o foco no papel', async () => {
    // Dado
    render(<MemoryRouter><Recolhivel titulo="Pessoas do processo" icone="pessoas" ligar={ligarParte([])}>
      <PartesDoProcesso processoId="pr1" partes={[]} podeMudar aoMudar={vi.fn()} />
    </Recolhivel></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: 'Pessoas do processo' }));
    // Então
    expect(screen.queryByRole('button', { name: LIGAR_PARTE })).not.toBeInTheDocument();
    expect(screen.getByText(/Nenhuma pessoa com papel neste processo/)).toBeInTheDocument();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: LIGAR_PARTE_NO_TITULO }));
    // Então
    expect(screen.getByRole('form', { name: LIGAR_PARTE })).toBeInTheDocument();
    expect(screen.getByLabelText(/Papel no processo/)).toHaveFocus();
  });
});

describe('Processos relacionados no cartão do processo (recursos e incidentais)', () => {
  beforeEach(() => { vi.spyOn(SD, 'colunasListar').mockResolvedValue([]); });
  const ORIGEM: ProcessoRelacionado = { id: 'o1', codigo: 'O1', tipo: 'judicial', numero: '0001234-97.2026.8.13.0024', titulo: 'Ação de origem', cliente_nome: '', etapa_id: null,
    arquivado_em: null, criado_em: '2026-01-01', relacao: 'origem' };
  const secao = (lista: ProcessoRelacionado[]) =>
    <Recolhivel titulo="Processos relacionados" icone="processos" novo={novoDerivado('r1', 'judicial')}><ProcessosRelacionados lista={lista} processoId="r1" aoMudar={() => {}} /></Recolhivel>;

  it('dado um recurso, quando a seção abre, então o processo de origem aparece com a relação, sem botões de criar embaixo', async () => {
    // Quando
    render(<MemoryRouter>{secao([ORIGEM])}</MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: 'Processos relacionados' }));
    // Então
    expect(screen.getByRole('link', { name: /Ação de origem/ })).toHaveTextContent('Processo de origem');
    expect(screen.queryByRole('link', { name: 'Novo recurso' })).not.toBeInTheDocument();
  });

  it('dado o "+" do título, quando a pessoa clica nele, então escolhe recurso ou incidental num menu pequeno', async () => {
    // Dado
    render(<MemoryRouter>{secao([])}</MemoryRouter>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Novo recurso ou incidental deste processo' }));
    // Então
    const menu = screen.getByRole('menu', { name: 'Novo recurso ou incidental deste processo' });
    expect(within(menu).getByRole('menuitem', { name: 'Novo recurso' })).toHaveAttribute('href', '/processos/novo/?processo=r1&ligacao=recurso');
    expect(within(menu).getByRole('menuitem', { name: 'Novo incidental' })).toHaveAttribute('href', '/processos/novo/?processo=r1&ligacao=incidental');
  });

  it('dado o cartão arquivado ou só para ler, quando a seção aparece, então não há o "+"', () => {
    // Quando
    render(<MemoryRouter><CriarNoCartao pode={false}>{secao([])}</CriarNoCartao></MemoryRouter>);
    // Então
    expect(screen.queryByRole('button', { name: 'Novo recurso ou incidental deste processo' })).not.toBeInTheDocument();
  });
});
