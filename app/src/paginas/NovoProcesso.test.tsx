// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O banco fictício sempre entra como administrador; aqui o processo é aberto também como quem não é.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SD, type Processo, type TipoProcesso } from '../dados';
import NovoProcesso from './NovoProcesso';

const sessao = vi.hoisted(() => ({ ehAdmin: false }));
vi.mock('../ui/sessao', () => ({
  useCtx: () => ({ perfil: { id: 'u-bruno' }, ehAdmin: sessao.ehAdmin, equipe: [{ id: 'u-bruno', nome: 'Bruno Exemplo Souza', ativo: true }] })
}));

const processo = (tipo: TipoProcesso, numero: string) => ({
  id: 'p1', codigo: 'ABCD1234', tipo, numero, titulo: null, responsavel_id: 'u-bruno', colaboradores: [], cliente_nome: 'JOSÉ', orgao: null, sistema: null, polo: null, area: 'Marítimo', meio: null,
  natureza: null, gratuidade: null, comarca: null, vara: null, classe: null, assunto: null, juiz: null, distribuicao: null, valor_causa: null, instancia: null, segredo: false, advogado_contrario: null,
  observacoes: null, etapa_id: null, etapa_ordem: null, arquivado_em: null, arquivado_por: null, criado_por: 'u-bruno', criado_em: '2026-11-01T12:00:00Z', atualizado_por: null, atualizado_em: '2026-11-01T12:00:00Z',
  clientes: [{ id: 'c1', codigo: 'C1', nome: 'JOSÉ', tipo: 'pf', arquivado_em: null }]
}) as unknown as Processo;

/** Abre o processo para editar: todas as etapas na tela. */
async function abrir(tipo: TipoProcesso, numero: string) {
  vi.spyOn(SD, 'processoObter').mockResolvedValue(processo(tipo, numero));
  render(<MemoryRouter><NovoProcesso edicao={{ id: 'p1', aoTerminar: () => undefined }} /></MemoryRouter>);
  await screen.findByLabelText(/Número do processo/);
}
const ACRESCENTAR = { name: 'Acrescentar opção' };

describe('Formulário de processo', () => {
  beforeEach(() => {
    sessao.ehAdmin = false;
    vi.spyOn(SD, 'processoOpcoes').mockResolvedValue([{ id: 'o1', campo: 'sistema', valor: 'Tucujuris' }]);
    vi.spyOn(SD, 'processoSugestoes').mockResolvedValue({ orgaos: [], comarcas: [], varas: [] });
  });

  it('quando quem abre não é administrador, então escolhe nas listas, inclusive as opções do escritório, mas não acrescenta opção', async () => {
    // Quando
    await abrir('judicial', '0001234-97.2026.8.13.0024');
    // Então
    expect(screen.queryAllByRole('button', ACRESCENTAR)).toHaveLength(0);
    expect(await screen.findByRole('option', { name: 'Tucujuris' })).toBeTruthy();
  });

  it('quando quem abre é administrador, então cada lista do processo judicial pode ganhar opção', async () => {
    // Dado
    sessao.ehAdmin = true;
    // Quando
    await abrir('judicial', '0001234-97.2026.8.13.0024');
    // Então
    expect(screen.getAllByRole('button', ACRESCENTAR)).toHaveLength(3);
  });

  it('quando é administrativo, então não aparecem os campos do judicial', async () => {
    // Dado
    sessao.ehAdmin = true;
    // Quando
    await abrir('administrativo', 'INPI 1');
    // Então
    expect(screen.getAllByRole('button', ACRESCENTAR)).toHaveLength(2);
    expect(screen.queryByLabelText('Comarca')).toBeNull();
    expect(screen.queryByLabelText('Natureza processual')).toBeNull();
    expect(screen.queryByText('Formato do número')).toBeNull();
  });

  it('quando o processo salvo tem um número fora do padrão, então ele vem marcado como antigo, para poder salvar', async () => {
    // Quando
    await abrir('judicial', '1234/98');
    // Então
    expect((screen.getByRole('checkbox', { name: /número antigo/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('quando o valor salvo saiu da lista, então ele continua aparecendo como escolhido', async () => {
    // Quando
    await abrir('judicial', '0001234-97.2026.8.13.0024');
    // Então
    expect((screen.getByLabelText('Área do direito') as HTMLSelectElement).value).toBe('Marítimo');
  });
});
