// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { Membro } from '../dados/tipos';
import { erroDoNomeDaEquipe, FUNCOES, motivoParaNaoParticipar, opcoesDeResponsavel } from './equipe';

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
