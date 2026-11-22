// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// As pessoas com papel no cartão do processo e os recursos e incidentais ligados a ele (#316).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SD, type ParteDoProcesso, type PessoaResumida, type ProcessoRelacionado } from '../dados';
import { CriarNoCartao } from '../ui/ItensLigados';
import { LIGAR_PARTE, PartesDoProcesso } from './PartesDoProcesso';
import { ProcessosRelacionados } from './ProcessosRelacionados';

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

  it('dado quem altera o processo, quando tira a pessoa, então ela sai do papel e o cartão lê de novo', async () => {
    // Dado
    const retirar = vi.spyOn(SD, 'processoParteRetirar').mockResolvedValue();
    const aoMudar = mostrarPartes([PARTE]);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tirar TESTEMUNHA TESTE (Testemunha) do processo' }));
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

describe('Recursos e incidentais no cartão do processo', () => {
  beforeEach(() => { vi.spyOn(SD, 'colunasListar').mockResolvedValue([]); });
  const ORIGEM: ProcessoRelacionado = { id: 'o1', codigo: 'O1', tipo: 'judicial', numero: '0001234-97.2026.8.13.0024', titulo: 'Ação de origem', cliente_nome: '', etapa_id: null,
    arquivado_em: null, criado_em: '2026-01-01', relacao: 'origem' };

  it('dado um recurso, quando a seção abre, então o processo de origem aparece com a relação, e há os botões de recurso e incidental', () => {
    // Quando
    render(<MemoryRouter><ProcessosRelacionados lista={[ORIGEM]} processoId="r1" /></MemoryRouter>);
    // Então
    expect(screen.getByRole('link', { name: /Ação de origem/ })).toHaveTextContent('Processo de origem');
    expect(screen.getByRole('link', { name: 'Novo recurso' })).toHaveAttribute('href', '/processos/novo/?processo=r1&ligacao=recurso');
    expect(screen.getByRole('link', { name: 'Novo incidental' })).toHaveAttribute('href', '/processos/novo/?processo=r1&ligacao=incidental');
  });

  it('dado o cartão arquivado ou só para ler, quando a seção abre, então não há botões de criar', () => {
    // Quando
    render(<MemoryRouter><CriarNoCartao pode={false}><ProcessosRelacionados lista={[]} processoId="r1" /></CriarNoCartao></MemoryRouter>);
    // Então
    expect(screen.getByText('Nenhum recurso ou incidental ligado a este processo.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Novo recurso' })).not.toBeInTheDocument();
  });
});
