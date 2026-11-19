// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O "+ Novo processo" da seção Processos de um cartão (#376): as mesmas condições do "Ligar processo".
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SD } from '../dados';
import { ProcessosDoCartao, type ProcessosLidos } from './ProcessosDoCartao';

const NOVO = { para: '/processos/novo/?tarefa=t1', rotulo: 'Novo processo' };
const PROCESSO = { id: 'p1', codigo: 'P1', tipo: 'judicial', numero: '0001234-97.2026.8.13.0024', titulo: 'Ação do José' } as const;

/** Mostra a seção com os processos lidos. */
async function mostrar(lidos: ProcessosLidos, extra: { somenteLer?: boolean; maximo?: number } = {}) {
  render(<MemoryRouter><ProcessosDoCartao carregar={async () => lidos} versao={0} somenteLer={extra.somenteLer ?? false} maximo={extra.maximo}
    ligar={async () => undefined} desligar={async () => undefined} aoMudar={() => undefined} vazio="Nenhum processo." novo={NOVO} /></MemoryRouter>);
  await screen.findByText(lidos.visiveis.length ? 'Ação do José' : lidos.ocultos ? /não tem acesso para abrir/ : 'Nenhum processo.');
}

describe('O "+ Novo processo" da seção Processos', () => {
  beforeEach(() => { vi.spyOn(SD, 'colunasListar').mockResolvedValue([]); });

  it('dado quem altera o cartão, quando a seção abre, então o "+ Novo processo" fica ao lado de "Ligar processo", com o endereço do cadastro', async () => {
    // Quando
    await mostrar({ visiveis: [], ocultos: 0 });
    // Então
    expect(screen.getByRole('link', { name: 'Novo processo' })).toHaveAttribute('href', NOVO.para);
    expect(screen.getByRole('button', { name: /Ligar processo/ })).toBeInTheDocument();
  });

  it('dado quem só lê o cartão, quando a seção abre, então não há "+ Novo processo"', async () => {
    // Quando
    await mostrar({ visiveis: [], ocultos: 0 }, { somenteLer: true });
    // Então
    expect(screen.queryByRole('link', { name: 'Novo processo' })).not.toBeInTheDocument();
  });

  it.each([
    ['um processo que a pessoa abre', { visiveis: [PROCESSO], ocultos: 0 }],
    ['um processo que a pessoa não pode abrir', { visiveis: [], ocultos: 1 }]
  ])('dado o cartão de um processo só que já tem %s, quando a seção abre, então não há "+ Novo processo"', async (_caso, lidos) => {
    // Quando
    await mostrar(lidos, { maximo: 1 });
    // Então
    expect(screen.queryByRole('link', { name: 'Novo processo' })).not.toBeInTheDocument();
  });
});
