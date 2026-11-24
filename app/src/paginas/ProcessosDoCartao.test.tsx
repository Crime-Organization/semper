// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O "Ligar processo" da seção Processos de um cartão (#294): fora de uma seção com a corrente no título, o botão; dentro dela (#427),
// só a busca que a corrente abre. O "+ Novo processo" fica no título da seção (#376), no cartão de cada módulo.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SD } from '../dados';
import { LIGAR_PROCESSO } from '../ui/LigarProcesso';
import { Recolhivel } from '../ui/Recolhivel';
import { ProcessosDoCartao, type ProcessosLidos } from './ProcessosDoCartao';

const PROCESSO = { id: 'p1', codigo: 'P1', tipo: 'judicial', numero: '0001234-97.2026.8.13.0024', titulo: 'Ação do José' } as const;

/** A seção com os processos lidos. */
const secao = (lidos: ProcessosLidos, extra: { somenteLer?: boolean; maximo?: number } = {}) =>
  <ProcessosDoCartao carregar={async () => lidos} versao={0} somenteLer={extra.somenteLer ?? false} maximo={extra.maximo}
    ligar={async () => undefined} desligar={async () => undefined} aoMudar={() => undefined} vazio="Nenhum processo." />;
/** Espera a lista aparecer. */
const lida = (lidos: ProcessosLidos) => screen.findByText(lidos.visiveis.length ? 'Ação do José' : lidos.ocultos ? /não tem acesso para abrir/ : 'Nenhum processo.');

describe('O "Ligar processo" da seção Processos', () => {
  beforeEach(() => {
    vi.spyOn(SD, 'colunasListar').mockResolvedValue([]);
    vi.spyOn(SD, 'processosParaLigar').mockResolvedValue([]);
  });

  it('dado quem altera o cartão, fora de uma seção com a corrente, quando a lista aparece, então há o botão "Ligar processo"', async () => {
    // Quando
    render(<MemoryRouter>{secao({ visiveis: [], ocultos: 0 })}</MemoryRouter>);
    await lida({ visiveis: [], ocultos: 0 });
    // Então
    expect(screen.getByRole('button', { name: LIGAR_PROCESSO })).toBeInTheDocument();
  });

  it('dado quem só lê o cartão, quando a lista aparece, então não há como ligar', async () => {
    // Quando
    render(<MemoryRouter>{secao({ visiveis: [], ocultos: 0 }, { somenteLer: true })}</MemoryRouter>);
    await lida({ visiveis: [], ocultos: 0 });
    // Então
    expect(screen.queryByRole('button', { name: LIGAR_PROCESSO })).not.toBeInTheDocument();
  });

  it.each([
    ['um processo que a pessoa abre', { visiveis: [PROCESSO], ocultos: 0 }],
    ['um processo que a pessoa não pode abrir', { visiveis: [], ocultos: 1 }]
  ])('dado o cartão de um processo só que já tem %s, quando a lista aparece, então não há como ligar outro', async (_caso, lidos) => {
    // Quando
    render(<MemoryRouter>{secao(lidos, { maximo: 1 })}</MemoryRouter>);
    await lida(lidos);
    // Então
    expect(screen.queryByRole('button', { name: LIGAR_PROCESSO })).not.toBeInTheDocument();
  });

  it('dada a seção com a corrente no título, quando ela abre, então não há botão embaixo e a corrente abre a busca ali', async () => {
    // Dado
    render(<MemoryRouter><Recolhivel titulo="Processo" icone="processos" ligar={{ rotulo: LIGAR_PROCESSO }}>{secao({ visiveis: [], ocultos: 0 })}</Recolhivel></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: 'Processo' }));
    await lida({ visiveis: [], ocultos: 0 });
    // Então: só a corrente do título
    expect(screen.getAllByRole('button', { name: LIGAR_PROCESSO })).toHaveLength(1);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: LIGAR_PROCESSO }));
    // Então
    expect(screen.getByRole('textbox', { name: 'Buscar processo para ligar' })).toHaveFocus();
  });
});
