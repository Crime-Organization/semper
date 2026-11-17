// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// As caixinhas da lista de tarefas no texto da anotação (#344), marcadas uma atrás da outra, com o banco demorando a responder.
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Anotacao, DadosAnotacoes, DadosSessao } from '../dados';
import { iniciarPreferencias } from '../ui/preferencias';
import { CartaoAnotacao } from './CartaoAnotacao';

// O cartão lê a anotação, os itens ligados e o histórico, e grava o texto; o mock declara exatamente essas operações.
const { anotacaoObter, anotacaoItens, anotacaoHistorico, anotacaoAtualizar, salvarPreferencia } = vi.hoisted(() => ({
  anotacaoObter: vi.fn<DadosAnotacoes['anotacaoObter']>(),
  anotacaoItens: vi.fn<DadosAnotacoes['anotacaoItens']>(async () => ({ visiveis: [], ocultos: 0 })),
  anotacaoHistorico: vi.fn<DadosAnotacoes['anotacaoHistorico']>(async () => []),
  anotacaoAtualizar: vi.fn<DadosAnotacoes['anotacaoAtualizar']>(),
  salvarPreferencia: vi.fn<DadosSessao['salvarPreferencia']>(async () => {})
}));
vi.mock('../dados', () => ({
  SD: { anotacaoObter, anotacaoItens, anotacaoHistorico, anotacaoAtualizar, salvarPreferencia } satisfies
    Pick<DadosAnotacoes & DadosSessao, 'anotacaoObter' | 'anotacaoItens' | 'anotacaoHistorico' | 'anotacaoAtualizar' | 'salvarPreferencia'>
}));
vi.mock('../ui/sessao', () => ({ useCtx: () => ({ perfil: { id: 'u-mateus', papel: 'usuario' }, equipe: [], ehAdmin: false, escritorio: { modulos: {} } }) }));

/** O "banco": o texto guardado e as gravações que ainda não responderam, na ordem em que chegaram. */
const banco = { texto: '', esperando: [] as { responder: (ok: boolean) => void }[] };
const anotacao = (texto: string): Anotacao => ({
  id: 'a1', codigo: 'A-1', titulo: 'Lista do protocolo', texto, responsavel_id: 'u-mateus', participantes: [], ligada_a: [],
  arquivado_em: null, arquivado_por: null, criado_por: 'u-mateus', criado_em: '2026-11-10T12:00:00Z', atualizado_por: null,
  atualizado_em: '2026-11-16T12:00:00Z'
});
/** O banco responde à gravação mais antiga ainda sem resposta (ok, ou com erro). */
async function responder(ok = true) {
  await act(async () => { banco.esperando.shift()!.responder(ok); });
}
const caixinha = (nome: string) => screen.getByRole('checkbox', { name: nome });

describe('Caixinhas marcadas seguidas no cartão da anotação (#344)', () => {
  beforeEach(() => {
    iniciarPreferencias({});
    banco.texto = '- [ ] A\n- [ ] B\n- [ ] C';
    banco.esperando = [];
    anotacaoObter.mockReset();
    anotacaoObter.mockImplementation(async () => anotacao(banco.texto));
    anotacaoAtualizar.mockReset();
    anotacaoAtualizar.mockImplementation((id, dados) => new Promise((ok, erro) => {
      banco.esperando.push({
        responder: deu => {
          if (!deu) { erro(new Error('Sem conexão.')); return; }
          banco.texto = dados.texto ?? banco.texto;
          ok({ id, codigo: 'A-1' });
        }
      });
    }));
  });

  it('dado o banco lento, quando a pessoa marca A, B e C seguidas, então nenhuma marcação se perde: na tela e no banco ficam as três', async () => {
    // Dado
    render(<MemoryRouter><CartaoAnotacao id="a1" aoMudar={() => undefined} aoFechar={() => undefined} /></MemoryRouter>);
    expect(await screen.findByRole('checkbox', { name: 'A' })).not.toBeChecked();
    // Quando: marca A e B; a gravação de A termina enquanto a de B ainda está na fila
    await userEvent.click(caixinha('A'));
    await userEvent.click(caixinha('B'));
    await responder();
    // Então: a leitura do banco (só com A) não desmarca B na tela
    expect(caixinha('A')).toBeChecked();
    expect(caixinha('B')).toBeChecked();
    // Quando: marca C nesse intervalo, e o banco responde às outras
    await userEvent.click(caixinha('C'));
    await responder();
    await responder();
    // Então: cada gravação partiu da anterior, e o banco fica com as três
    expect(anotacaoAtualizar.mock.calls.map(([, d]) => d.texto)).toEqual([
      '- [x] A\n- [ ] B\n- [ ] C', '- [x] A\n- [x] B\n- [ ] C', '- [x] A\n- [x] B\n- [x] C'
    ]);
    expect(banco.texto).toBe('- [x] A\n- [x] B\n- [x] C');
    await vi.waitFor(() => expect(anotacaoObter).toHaveBeenCalledTimes(2));   // a leitura do começo e a do fim da fila
    expect(caixinha('A')).toBeChecked();
    expect(caixinha('B')).toBeChecked();
    expect(caixinha('C')).toBeChecked();
  });

  it('dado o banco lento, quando a gravação de A falha com B já na fila, então B não é gravada e a tela volta ao texto do banco', async () => {
    // Dado
    render(<MemoryRouter><CartaoAnotacao id="a1" aoMudar={() => undefined} aoFechar={() => undefined} /></MemoryRouter>);
    expect(await screen.findByRole('checkbox', { name: 'A' })).not.toBeChecked();
    await userEvent.click(caixinha('A'));
    await userEvent.click(caixinha('B'));
    // Quando
    await responder(false);
    // Então: B foi calculada com A marcada, que não foi gravada: fica de fora
    expect(anotacaoAtualizar).toHaveBeenCalledOnce();
    expect(banco.texto).toBe('- [ ] A\n- [ ] B\n- [ ] C');
    await vi.waitFor(() => expect(anotacaoObter).toHaveBeenCalledTimes(2));
    expect(caixinha('A')).not.toBeChecked();
    expect(caixinha('B')).not.toBeChecked();
    // Quando: a pessoa tenta de novo
    await userEvent.click(caixinha('B'));
    await responder();
    // Então: só B é marcada, a partir do texto do banco
    expect(anotacaoAtualizar).toHaveBeenLastCalledWith('a1', { texto: '- [ ] A\n- [x] B\n- [ ] C' });
    expect(banco.texto).toBe('- [ ] A\n- [x] B\n- [ ] C');
  });
});
