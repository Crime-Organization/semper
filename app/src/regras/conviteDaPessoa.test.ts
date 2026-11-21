// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { Membro } from '../dados/tipos';
import { conviteDaPessoa, lugarNaEquipe, NO_CARTAO } from './conviteDaPessoa';

const PESSOA = { id: 'p-1', tipo: 'pf' as const, emails: ['maria@exemplo.com'], arquivado_em: null };
const EQUIPE: Membro[] = [{ id: 'u-1', nome: 'Ana', pessoa_id: 'p-ana' }];

describe('Lugar da pessoa na equipe, no cartão dela (#327)', () => {
  it('dada uma pessoa física com e-mail, sem usuário nem convite, quando o cartão abre, então ela pode ser convidada', () => {
    // Quando
    const lugar = lugarNaEquipe(PESSOA, EQUIPE, [], []);
    // Então
    expect(lugar).toBe('pode-convidar');
    expect(NO_CARTAO[lugar]).toEqual({ selo: null, convidar: true });
  });

  it('dada uma pessoa ligada a um usuário, quando o cartão abre, então ela é da equipe, mesmo sem e-mail', () => {
    // Dado
    const equipe: Membro[] = [...EQUIPE, { id: 'u-2', nome: 'Maria', pessoa_id: 'p-1' }];
    // Quando
    const lugar = lugarNaEquipe({ ...PESSOA, tipo: 'contato', emails: [] }, equipe);
    // Então
    expect(lugar).toBe('da-equipe');
    expect(NO_CARTAO[lugar]).toEqual({ selo: 'Da equipe', convidar: false });
  });

  it('dado um usuário com o mesmo e-mail (em maiúsculas), quando o cartão abre, então a pessoa é da equipe', () => {
    // Quando
    const lugar = lugarNaEquipe(PESSOA, EQUIPE, [{ pessoa_id: 'p-outra', email: ' Maria@Exemplo.com ' }]);
    // Então
    expect(lugar).toBe('da-equipe');
  });

  it.each([
    ['pelo cadastro', { pessoa_id: 'p-1', email: 'outro@exemplo.com' }],
    ['pelo e-mail', { pessoa_id: null, email: 'maria@exemplo.com' }]
  ])('dado um convite pendente %s, quando o cartão abre, então a pessoa aparece como convidada e o ⋯ não convida de novo', (_caso, convite) => {
    // Quando
    const lugar = lugarNaEquipe(PESSOA, EQUIPE, [], [convite]);
    // Então
    expect(lugar).toBe('convidada');
    expect(NO_CARTAO[lugar]).toEqual({ selo: 'Convite enviado', convidar: false });
  });

  it.each([
    ['jurídica', { tipo: 'pj' as const }],
    ['só contato', { tipo: 'contato' as const }],
    ['sem e-mail', { emails: [] }],
    ['arquivada', { arquivado_em: '2026-11-01T00:00:00Z' }]
  ])('dada uma pessoa %s, quando o cartão abre, então não há convite nem selo', (_caso, muda) => {
    // Quando
    const lugar = lugarNaEquipe({ ...PESSOA, ...muda }, EQUIPE);
    // Então
    expect(lugar).toBe('nenhum');
  });

  it('dada uma pessoa excluída da equipe, quando o cartão abre, então ela não aparece como da equipe nem pode ser convidada', () => {
    // Dado
    const equipe: Membro[] = [{ id: 'u-2', nome: 'Maria (excluído)', pessoa_id: 'p-1', excluido: true }];
    // Quando
    const lugar = lugarNaEquipe(PESSOA, equipe);
    // Então
    expect(lugar).toBe('nenhum');
  });
});

describe('Endereço do convite a partir do cartão (#327)', () => {
  it('dada uma pessoa, quando o administrador pede o convite, então vai à Equipe só com o id dela no endereço', () => {
    // Quando
    const endereco = conviteDaPessoa('p-1');
    // Então
    expect(endereco).toBe('/equipe/?convidar=p-1');
  });
});
