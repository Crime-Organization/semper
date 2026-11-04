// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// As partes puras da função do servidor que reserva uma conta (#215), em supabase/functions/_compartilhado/.
import { describe, expect, it, vi } from 'vitest';
import { conferirPedidoDaReserva, reservarConta, type PassosDaReserva, type PreparoDaReserva } from '../../../supabase/functions/_compartilhado/reservaDeConta';

const PESSOA = '00000000-0000-4000-8000-000000000001';
const PRONTO: PreparoDaReserva = { resultado: 'pronto', email: 'conta-1@reservada.invalid', codigo: 'abc' };

function passos(preparo: PreparoDaReserva | undefined, criarNoLogin: PassosDaReserva['criarNoLogin'] = async () => true) {
  return { preparar: vi.fn(async () => preparo), criarNoLogin: vi.fn(criarNoLogin), concluir: vi.fn(async () => {}), desistir: vi.fn(async () => {}) };
}

describe('conferirPedidoDaReserva', () => {
  it('dado um pedido certo, quando confere, então devolve a pessoa', () => {
    expect(conferirPedidoDaReserva({ pessoa: PESSOA })).toEqual({ pessoa: PESSOA });
  });

  it.each([['sem corpo', null], ['sem pessoa', {}], ['pessoa que não é um código', { pessoa: 'qualquer' }], ['pessoa que não é texto', { pessoa: 1 }]])(
    'dado um pedido %s, quando confere, então recusa', (_nome, corpo) => {
      expect(conferirPedidoDaReserva(corpo)).toBeNull();
    });
});

describe('reservarConta', () => {
  it('dado que o banco autorizou, quando o login cria a conta, então o perfil é marcado', async () => {
    // Dado
    const p = passos(PRONTO);
    // Quando
    const r = await reservarConta({ pessoa: PESSOA }, p);
    // Então
    expect(r).toBe('reservada');
    expect(p.criarNoLogin).toHaveBeenCalledWith(PRONTO.email, PRONTO.codigo);
    expect(p.concluir).toHaveBeenCalledWith(PRONTO.email);
    expect(p.desistir).not.toHaveBeenCalled();
  });

  it.each(['sem-permissao', 'ja-na-equipe', 'convite-pendente'] as const)('dado que o banco respondeu %s, quando reserva, então o login nem é chamado', async resultado => {
    // Dado
    const p = passos({ resultado, email: null, codigo: null });
    // Quando / Então
    expect(await reservarConta({ pessoa: PESSOA }, p)).toBe(resultado);
    expect(p.criarNoLogin).not.toHaveBeenCalled();
  });

  it('dado que o banco não respondeu nada, quando reserva, então é recusado', async () => {
    expect(await reservarConta({ pessoa: PESSOA }, passos(undefined))).toBe('sem-permissao');
  });

  it('dado que o login recusou, quando reserva, então o convite é apagado e o perfil não é marcado', async () => {
    // Dado
    const p = passos(PRONTO, async () => false);
    // Quando
    const r = await reservarConta({ pessoa: PESSOA }, p);
    // Então
    expect(r).toBe('erro');
    expect(p.desistir).toHaveBeenCalledWith(PRONTO.email);
    expect(p.concluir).not.toHaveBeenCalled();
  });

  it('dado que o login caiu no meio, quando reserva, então o convite também é apagado', async () => {
    // Dado
    const p = passos(PRONTO, async () => { throw new Error('fora do ar'); });
    // Quando / Então
    expect(await reservarConta({ pessoa: PESSOA }, p)).toBe('erro');
    expect(p.desistir).toHaveBeenCalledWith(PRONTO.email);
  });
});
