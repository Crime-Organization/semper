// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { Membro } from '../dados/tipos';
import { candidatosDaEquipe, erroDoNomeDaEquipe, FUNCOES, motivoParaNaoDarAcesso, motivoParaNaoParticipar, nomeNaEquipe, opcoesDeResponsavel, podeExcluir } from './equipe';

const EQUIPE: Membro[] = [
  { id: 'u-adv', nome: 'Advogada', funcao: 'advogado', ativo: true, pessoa_id: 'p-adv' },
  { id: 'u-est', nome: 'Estagiário', funcao: 'estagiario', ativo: true, pessoa_id: 'p-est' },
  { id: 'u-adm', nome: 'Secretária', funcao: 'administrativo', ativo: true, pessoa_id: 'p-adm' },
  { id: 'u-saiu', nome: 'Advogado que saiu', funcao: 'advogado', ativo: false, pessoa_id: 'p-saiu' },
  { id: 'u-antigo', nome: 'Antes da função', ativo: true, pessoa_id: 'p-antigo' }
];

describe('Função na equipe', () => {
  it('quando a lista de responsável é montada, então aparecem só os advogados ativos', () => {
    // Quando
    const opcoes = opcoesDeResponsavel(EQUIPE);
    // Então (quem ainda não tem função conta como advogado, como no banco)
    expect(opcoes.map(m => m.id)).toEqual(['u-adv', 'u-antigo']);
  });

  it.each([
    ['um estagiário', 'u-est'],
    ['um advogado desativado', 'u-saiu']
  ])('dado um contrato que já tem %s como responsável, quando a lista é montada, então ele continua nela', (_caso, atual) => {
    // Quando
    const opcoes = opcoesDeResponsavel(EQUIPE, atual);
    // Então
    expect(opcoes.map(m => m.id)).toContain(atual);
  });

  it.each([
    ['um advogado', 'p-adv', null],
    ['um estagiário', 'p-est', null],
    ['alguém do administrativo', 'p-adm', null],
    ['alguém desativado', 'p-saiu', 'desativado na equipe'],
    ['alguém de fora da equipe', 'p-cliente', 'não é da equipe']
  ])('quando %s é escolhido como participante, então o motivo para não poder é %s', (_caso, pessoa, motivo) => {
    // Quando
    const r = motivoParaNaoParticipar(EQUIPE, pessoa);
    // Então
    expect(r).toBe(motivo);
  });

  it('quando a função aparece na tela, então cada uma tem o seu nome', () => {
    // Então
    expect(FUNCOES).toEqual({ advogado: 'Advogado', administrativo: 'Administrativo', estagiario: 'Estagiário' });
  });
});

describe('conta reservada nos contratos', () => {
  const reservado: Membro = { id: 'r', nome: 'Reservada', funcao: 'advogado', ativo: false, reservada: true, pessoa_id: 'p-r' };
  const desativado: Membro = { id: 'd', nome: 'Desativada', funcao: 'advogado', ativo: false, pessoa_id: 'p-d' };

  it('dado uma conta reservada de advogado, quando escolho o responsável, então ela aparece, e a desativada não', () => {
    expect(opcoesDeResponsavel([reservado, desativado]).map(m => m.id)).toEqual(['r']);
  });

  it('dado uma conta reservada, quando vejo se pode participar, então pode; a desativada não', () => {
    expect(motivoParaNaoParticipar([reservado, desativado], 'p-r')).toBeNull();
    expect(motivoParaNaoParticipar([reservado, desativado], 'p-d')).toBe('desativado na equipe');
  });
});

describe('O nome de alguém da equipe', () => {
  it.each([['Ana Lima', null], ['  Ana  ', null], ['A', 'Informe um nome de 2 a 200 letras.'], ['   ', 'Informe um nome de 2 a 200 letras.'], ['x'.repeat(201), 'Informe um nome de 2 a 200 letras.']])(
    'dado o nome "%s", quando confere, então o erro é %s', (nome, erro) => {
      // Então
      expect(erroDoNomeDaEquipe(nome)).toBe(erro);
    });
});

describe('Quem da equipe pode entrar numa lista', () => {
  it('quando nada foi digitado, então vêm todos os ativos que ainda não estão na lista, em ordem alfabética', () => {
    // Quando
    const achados = candidatosDaEquipe(EQUIPE, '', ['u-adm']);
    // Então: quem saiu da equipe e quem já está fica de fora
    expect(achados.map(m => m.nome)).toEqual(['Advogada', 'Antes da função', 'Estagiário']);
  });

  it('quando a pessoa digita palavras do nome, sem acento e em minúsculas, então vêm só os que têm todas elas', () => {
    // Quando
    const achados = candidatosDaEquipe(EQUIPE, ' antes  FUNCAO ', []);
    // Então
    expect(achados.map(m => m.id)).toEqual(['u-antigo']);
  });

  it('quando ninguém combina com o que foi digitado, então a lista vem vazia', () => {
    // Quando / Então
    expect(candidatosDaEquipe(EQUIPE, 'saiu', [])).toEqual([]);
  });
});

describe('Excluir alguém da equipe', () => {
  const usuario = (extra: Partial<{ id: string; papel: 'master' | 'admin' | 'usuario'; ativo: boolean }> = {}) =>
    ({ id: 'u-x', papel: 'usuario' as const, ativo: false, ...extra });

  it('dado um usuário desativado, quando um administrador vê se pode excluir, então pode', () => {
    expect(podeExcluir(usuario(), 'u-adm', false)).toBe(true);
  });

  it.each([
    ['ainda está ativo', usuario({ ativo: true }), false],
    ['é você mesmo', usuario({ id: 'u-adm' }), false],
    ['é o master', usuario({ papel: 'master' }), true],
    ['é administrador e quem pergunta não é o master', usuario({ papel: 'admin' }), false]
  ])('dado alguém que %s, quando vejo se posso excluir, então não posso', (_caso, u, souMaster) => {
    expect(podeExcluir(u, 'u-adm', souMaster)).toBe(false);
  });

  it('dado um administrador desativado, quando o master vê se pode excluir, então pode', () => {
    expect(podeExcluir(usuario({ papel: 'admin' }), 'u-master', true)).toBe(true);
  });

  it('dado alguém excluído, quando o nome aparece nos registros, então vem marcado; o de quem não foi excluído, não', () => {
    expect(nomeNaEquipe('Ana Lima', true)).toBe('Ana Lima (excluído)');
    expect(nomeNaEquipe('Ana Lima')).toBe('Ana Lima');
  });

  it('dado uma conta reservada que foi excluída, quando escolho o responsável ou um participante, então ela não aparece', () => {
    const excluida: Membro = { id: 'x', nome: 'Excluída', funcao: 'advogado', ativo: false, reservada: true, excluido: true, pessoa_id: 'p-x' };
    expect(opcoesDeResponsavel([excluida])).toEqual([]);
    expect(motivoParaNaoParticipar([excluida], 'p-x')).toBe('desativado na equipe');
  });

  it.each([
    ['foi excluída da equipe', 'p-x', 'foi excluída da equipe e não volta'],
    ['já tem acesso ou convite', 'p-com-acesso', 'já tem acesso ou convite'],
    ['ainda não é da equipe', 'p-nova', null]
  ])('dado uma pessoa que %s, quando vejo se ela pode receber acesso, então a resposta diz o motivo', (_caso, pessoa, motivo) => {
    const equipe: Membro[] = [{ id: 'x', nome: 'Excluída', ativo: false, excluido: true, pessoa_id: 'p-x' }];
    expect(motivoParaNaoDarAcesso(pessoa, equipe, ['p-com-acesso', null])).toBe(motivo);
  });

  it('dado um contrato que tem como responsável alguém excluído, quando a lista é montada, então ele continua nela', () => {
    const excluido: Membro = { id: 'x', nome: 'Excluído', funcao: 'advogado', ativo: false, excluido: true, pessoa_id: 'p-x' };
    expect(opcoesDeResponsavel([excluido], 'x').map(m => m.id)).toEqual(['x']);
  });
});
