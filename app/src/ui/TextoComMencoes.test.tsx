// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { ItemDaAnotacao, Membro } from '../dados';
import { TextoComMencoes } from './TextoComMencoes';

const EQUIPE: Membro[] = [{ id: 'u-ana', nome: 'Ana Teste Lima', usuario: 'ana.lima', funcao: 'advogado', ativo: true }];
vi.mock('./sessao', () => ({ useCtx: () => ({ perfil: { id: 'u-mauro' }, equipe: EQUIPE, ehAdmin: false }) }));

const TAREFA: ItemDaAnotacao = { modulo: 'tarefas', id: 't1', codigo: 'C0FFEE12', nome: 'Emitir a GRU', arquivado_em: null };

function Endereco() {
  const { pathname, search } = useLocation();
  return <output aria-label="Endereço">{pathname + search}</output>;
}
function abrir(texto: string, itens?: ReadonlyMap<string, ItemDaAnotacao | null>) {
  const roteador = createMemoryRouter([
    { path: '*', element: <><p><TextoComMencoes texto={texto} itens={itens} /></p><Endereco /></> }
  ], { initialEntries: ['/demandas/?id=d1'] });
  return render(<RouterProvider router={roteador} />);
}

describe('Texto com menções', () => {
  it('dado o trecho da caixa de Mensagens, sem consulta dos itens, quando aparece, então a pessoa e o código vêm em destaque, sem atalho', () => {
    // Quando
    abrir('Oi @ana.lima, veja !C0FFEE12 hoje');
    // Então
    expect(screen.getByText('@ana.lima')).toHaveAttribute('title', 'Ana Teste Lima');
    expect(screen.getByText('!C0FFEE12')).toHaveAttribute('title', 'Item mencionado');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('paragraph')).toHaveTextContent('Oi @ana.lima, veja !C0FFEE12 hoje');
  });

  it('dado um item que a pessoa vê, quando ela clica na menção, então o cartão do item abre', async () => {
    // Dado
    abrir('Fazer !C0FFEE12', new Map([['C0FFEE12', TAREFA]]));
    // Quando
    const atalho = screen.getByRole('link', { name: '!C0FFEE12 Emitir a GRU' });
    await userEvent.click(atalho);
    // Então: o nome do link é o texto que aparece (quem usa comando de voz diz o que vê); o que ele faz vem como descrição
    expect(atalho).toHaveAccessibleDescription('Abrir Tarefa C0FFEE12: Emitir a GRU');
    expect(screen.getByRole('status', { name: 'Endereço' })).toHaveTextContent('/tarefas/?id=t1');
  });

  it('dado um item arquivado que a pessoa vê, quando a menção aparece, então o nome do link começa pelo texto da tela, com o aviso', () => {
    // Quando
    abrir('Ver !C0FFEE12', new Map([['C0FFEE12', { ...TAREFA, arquivado_em: '2026-11-01T00:00:00Z' }]]));
    // Então
    const atalho = screen.getByRole('link', { name: '!C0FFEE12 Emitir a GRU · arquivado' });
    expect(atalho).toHaveAccessibleDescription('Abrir Tarefa C0FFEE12: Emitir a GRU, que está arquivado');
  });
});
