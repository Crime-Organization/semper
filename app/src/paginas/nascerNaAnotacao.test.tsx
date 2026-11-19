// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O item criado pelo "+ Novo…" da anotação (#376): depois de gravar, ele é ligado à anotação e a tela volta a ela; se a ligação
// falha, o item fica, o aviso do pé diz o que faltou e a tela vai ao cartão do item novo; a anotação que não aceita o item (arquivada,
// só para ler, cheia) nem é tentada. E o aviso do topo do cadastro.
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DadosAnotacoes } from '../dados';
import { ITENS_DA_ANOTACAO } from '../dados/limites';
import { origemDaAnotacao } from '../regras/nascerLigado';
import { AvisoDaAnotacaoDeOrigem, depoisDeCriarNaAnotacao } from './nascerNaAnotacao';

const { anotacaoLigar, avisar } = vi.hoisted(() => ({
  anotacaoLigar: vi.fn<DadosAnotacoes['anotacaoLigar']>(),
  avisar: vi.fn()
}));
vi.mock('../dados', () => ({ SD: { anotacaoLigar } satisfies Pick<DadosAnotacoes, 'anotacaoLigar'> }));
vi.mock('../ui/avisos', () => ({ avisar, falha: vi.fn() }));
vi.mock('../ui/sessao', () => ({ useCtx: () => ({ perfil: { id: 'u-mateus', papel: 'usuario' }, escritorio: { modulos: {} } }) }));

const ANOTACAO = { id: 'an1', codigo: 'AN-0001', titulo: 'Reunião com o cliente', arquivado_em: null };
const DO_CRIADO = '/tarefas/?id=t9';

describe('Depois de criar o item pelo "+ Novo…" da anotação', () => {
  beforeEach(() => { anotacaoLigar.mockReset(); avisar.mockReset(); });

  it('dada a anotação que aceita o item, quando ele é criado, então fica ligado a ela e a tela volta à anotação', async () => {
    // Dado
    anotacaoLigar.mockResolvedValue(true);
    // Quando
    const destino = await depoisDeCriarNaAnotacao(origemDaAnotacao(ANOTACAO, 0, 'tarefa', true), 'tarefa', 't9', DO_CRIADO);
    // Então
    expect(anotacaoLigar).toHaveBeenCalledExactlyOnceWith('an1', 'tarefas', 't9');
    expect(destino).toBe('/documentos/?id=an1');
    expect(avisar).not.toHaveBeenCalled();
  });

  it('dado que outra aba já ligou o item, quando ele é criado, então a ligação existe do mesmo jeito e a tela volta à anotação', async () => {
    // Dado
    anotacaoLigar.mockResolvedValue(false);
    // Quando
    const destino = await depoisDeCriarNaAnotacao(origemDaAnotacao(ANOTACAO, 0, 'demanda', true), 'demanda', 'd9', '/demandas/?id=d9');
    // Então
    expect(destino).toBe('/documentos/?id=an1');
  });

  it('dada a ligação que falha depois de gravar, quando o item é criado, então o aviso do pé diz o que faltou e a tela vai ao item novo', async () => {
    // Dado
    anotacaoLigar.mockRejectedValue(new Error('Sem conexão.'));
    // Quando
    const destino = await depoisDeCriarNaAnotacao(origemDaAnotacao(ANOTACAO, 0, 'compromisso', true), 'compromisso', 'c9', '/agenda/?id=c9');
    // Então
    expect(destino).toBe('/agenda/?id=c9');
    expect(avisar).toHaveBeenCalledExactlyOnceWith('Não foi possível ligar a anotação AN-0001 ao compromisso novo: Sem conexão. Ligue pelo cartão.', 'erro');
  });

  it.each([
    ['arquivada', { ...ANOTACAO, arquivado_em: '2026-11-01' }, 0, true],
    ['só para ler', ANOTACAO, 0, false],
    ['cheia', ANOTACAO, ITENS_DA_ANOTACAO, true]
  ])('dada a anotação %s, quando o item é criado, então a ligação nem é tentada e a tela vai ao item novo', async (_caso, a, itens, ligaNela) => {
    // Dado / Quando
    const destino = await depoisDeCriarNaAnotacao(origemDaAnotacao(a, itens, 'contrato', ligaNela), 'contrato', 'k9', '/contratos/?id=k9');
    // Então
    expect(anotacaoLigar).not.toHaveBeenCalled();
    expect(destino).toBe('/contratos/?id=k9');
  });

  it('dado o cadastro aberto sem anotação de origem, quando o item é criado, então a tela vai ao item novo, sem ligar nada', async () => {
    // Dado / Quando
    const destino = await depoisDeCriarNaAnotacao(null, 'tarefa', 't9', DO_CRIADO);
    // Então
    expect(destino).toBe(DO_CRIADO);
    expect(anotacaoLigar).not.toHaveBeenCalled();
  });
});

describe('O aviso do topo do cadastro aberto pela anotação', () => {
  it('dada a anotação que aceita o item, quando o cadastro abre, então o aviso diz de onde ele nasce', () => {
    // Dado / Quando
    render(<AvisoDaAnotacaoDeOrigem origem={origemDaAnotacao(ANOTACAO, 0, 'demanda', true)} />);
    // Então
    expect(screen.getByText(/Esta demanda nasce da anotação/)).toHaveTextContent('Esta demanda nasce da anotação AN-0001 (Reunião com o cliente) e fica ligada a ela.');
  });

  it('dada a anotação que a pessoa só lê, quando o cadastro abre, então o aviso diz que o item não fica ligado', () => {
    // Dado / Quando
    render(<AvisoDaAnotacaoDeOrigem origem={origemDaAnotacao(ANOTACAO, 0, 'tarefa', false)} />);
    // Então
    expect(screen.getByText(/Você só pode ler a anotação/)).toHaveTextContent('Você só pode ler a anotação AN-0001 (Reunião com o cliente): a tarefa nova não fica ligada a ela.');
  });
});
