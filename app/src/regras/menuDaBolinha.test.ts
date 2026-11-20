// O menu da bolinha da equipe (#388). Padrão Dado / Quando / Então: app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { Membro } from '../dados/tipos';
import { ACOES_NA_BOLINHA, acoesSem, impedeResponder, NAO_PODE_RESPONDER, PERFIL_SO_DE_ADMINISTRADOR, perfilNaBolinha } from './menuDaBolinha';

describe('Quem pode passar a responder pelo menu', () => {
  const EQUIPE: Membro[] = [{ id: 'u-ana', nome: 'Ana Teste Lima', ativo: true }, { id: 'u-desligado', nome: 'Davi', ativo: false },
    { id: 'u-saiu', nome: 'Carla (excluída)', ativo: false, excluido: true }];

  it('dado alguém ativo na equipe, quando o menu dele abre, então "Tornar responsável" fica livre', () => {
    // Quando / Então
    expect(impedeResponder('u-ana', EQUIPE)).toBeUndefined();
  });

  it('dado alguém desativado, excluído ou que não está mais na equipe, quando o menu dele abre, então o motivo fica no lugar de "Tornar responsável"', () => {
    // Quando / Então
    expect(impedeResponder('u-desligado', EQUIPE)).toBe(NAO_PODE_RESPONDER);
    expect(impedeResponder('u-saiu', EQUIPE)).toBe(NAO_PODE_RESPONDER);
    expect(impedeResponder('u-sumiu', EQUIPE)).toBe(NAO_PODE_RESPONDER);
  });
});

describe('As ações de cada bolinha', () => {
  it('dado um participante, quando o menu abre, então ele pode virar responsável, sair e ter o perfil aberto, nessa ordem', () => {
    // Então
    expect(ACOES_NA_BOLINHA.participante).toEqual(['tornarResponsavel', 'tirar', 'verPerfil']);
  });

  it('dado o responsável, quando o menu abre, então ele pode ser trocado e ter o perfil aberto, sem "Tirar" (ele é obrigatório)', () => {
    // Então
    expect(ACOES_NA_BOLINHA.responsavel).toEqual(['trocarResponsavel', 'verPerfil']);
  });

  it('dado um dos responsáveis da pessoa (todos iguais), quando o menu abre, então só tirar e ver o perfil', () => {
    // Então
    expect(ACOES_NA_BOLINHA.responsavelDaPessoa).toEqual(['tirar', 'verPerfil']);
  });

  it('dado quem não pode ser o responsável (no contrato, quem não é advogado), quando o menu é montado, então "Tornar responsável" não aparece', () => {
    // Quando / Então
    expect(acoesSem(ACOES_NA_BOLINHA.participante, 'tornarResponsavel')).toEqual(['tirar', 'verPerfil']);
  });
});

describe('O "Ver perfil" da bolinha', () => {
  const EQUIPE: Membro[] = [{ id: 'u-ana', nome: 'Ana Teste Lima', ativo: true }, { id: 'u-bruno', nome: 'Bruno Exemplo Souza', ativo: true },
    { id: 'u-saiu', nome: 'Carla (excluída)', ativo: false, excluido: true }];

  it('dada a própria bolinha, quando o menu abre, então o perfil abre em Minha conta', () => {
    // Quando / Então
    expect(perfilNaBolinha('u-ana', { eu: 'u-ana', ehAdmin: false }, EQUIPE)).toEqual({ para: '/minha-conta/' });
  });

  it('dado um administrador, quando abre o menu de outra pessoa, então o perfil abre na página do perfil da equipe', () => {
    // Quando / Então
    expect(perfilNaBolinha('u-bruno', { eu: 'u-ana', ehAdmin: true }, EQUIPE)).toEqual({ para: '/equipe/perfil/?id=u-bruno' });
  });

  it('dado quem não é administrador, quando abre o menu de outra pessoa, então o menu diz que só um administrador abre esse perfil', () => {
    // Quando / Então
    expect(perfilNaBolinha('u-bruno', { eu: 'u-ana', ehAdmin: false }, EQUIPE)).toEqual({ motivo: PERFIL_SO_DE_ADMINISTRADOR });
  });

  it('dado um usuário excluído (ou que não está mais na equipe), quando o menu abre, então não há perfil para ver', () => {
    // Quando / Então
    expect(perfilNaBolinha('u-saiu', { eu: 'u-ana', ehAdmin: true }, EQUIPE)).toBeNull();
    expect(perfilNaBolinha('u-sumiu', { eu: 'u-ana', ehAdmin: true }, EQUIPE)).toBeNull();
  });
});
