// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A aprovação interna da tarefa (#313): as mesmas regras do banco (supabase/migrations/20261123013306_tarefa_aprovacao.sql).
import { describe, expect, it } from 'vitest';
import { TAMANHO_TAREFA } from '../dados/limites';
import type { Membro } from '../dados/tipos';
import {
  aprovacaoPadrao, aprovaATarefa, colunaDaDevolucao, comentarioDaDevolucao, conferirMudancaDaAprovacao, DEVOLUCAO_LONGA, erroDaDevolucao, esperaAprovacao,
  etapaComAprovacao, SEM_COMENTARIO_DA_DEVOLUCAO, SO_QUEM_PEDIU_MUDA_A_APROVACAO
} from './aprovacaoDaTarefa';

const ANA: Pick<Membro, 'id' | 'papel'> = { id: 'u-ana', papel: 'usuario' };
const BRUNO: Pick<Membro, 'id' | 'papel'> = { id: 'u-bruno', papel: 'usuario' };
const MAURO: Pick<Membro, 'id' | 'papel'> = { id: 'u-mauro', papel: 'admin' };
const COLUNAS = [
  { id: 'c-fazer', nome: 'Para fazer', ordem: 1, marco: 'inicio' as const },
  { id: 'c-fazendo', nome: 'Fazendo', ordem: 2, marco: null },
  { id: 'c-aprovacao', nome: 'Aguardando: análise do solicitante', ordem: 3, marco: null, de_aprovacao: true },
  { id: 'c-feita', nome: 'Concluída', ordem: 4, marco: 'concluido' as const }
];
/** A tarefa que a Ana pediu, com a aprovação. */
const PEDIDA = { precisa_aprovacao: true, solicitante_id: 'u-ana' };

describe('Quem aprova a tarefa', () => {
  it.each([
    ['o solicitante', ANA, true],
    ['um administrador', MAURO, true],
    ['quem executa', BRUNO, false]
  ])('dada a tarefa pedida pela Ana, quando %s confere, então aprova = %s', (_quem, m, aprova) => {
    // Quando / Então
    expect(aprovaATarefa(PEDIDA, m)).toBe(aprova);
  });

  it('dada a tarefa sem solicitante, quando um usuário comum confere, então só um administrador aprova', () => {
    // Então
    expect(aprovaATarefa({ solicitante_id: null }, BRUNO)).toBe(false);
    expect(aprovaATarefa({ solicitante_id: null }, MAURO)).toBe(true);
  });
});

describe('A caixa "Precisa de aprovação" no cadastro', () => {
  it.each([
    ['outra pessoa que não o responsável', 'u-ana', 'u-bruno', true],
    ['o próprio responsável', 'u-bruno', 'u-bruno', false],
    ['ninguém', '', 'u-bruno', false]
  ])('dado o solicitante = %s, quando o cadastro abre, então a caixa vem marcada = %s', (_caso, solicitante, responsavel, marcada) => {
    // Então
    expect(aprovacaoPadrao(solicitante, responsavel)).toBe(marcada);
  });
});

describe('Para onde a tarefa vai ao ser concluída', () => {
  it('dada a tarefa com aprovação, quando quem executa a leva às concluídas, então ela vai para a coluna de aprovação', () => {
    // Então
    expect(etapaComAprovacao(PEDIDA, 'c-feita', COLUNAS, BRUNO)).toBe('c-aprovacao');
  });

  it.each([
    ['o solicitante a conclui', PEDIDA, 'c-feita', ANA, 'c-feita'],
    ['um administrador a conclui', PEDIDA, 'c-feita', MAURO, 'c-feita'],
    ['ela não precisa de aprovação', { ...PEDIDA, precisa_aprovacao: false }, 'c-feita', BRUNO, 'c-feita'],
    ['ela vai para outra coluna', PEDIDA, 'c-fazer', BRUNO, 'c-fazer']
  ])('dada a tarefa, quando %s, então vai para onde foi pedido', (_caso, t, etapa, quem, destino) => {
    // Então
    expect(etapaComAprovacao(t, etapa, COLUNAS, quem)).toBe(destino);
  });

  it('dado um quadro sem a coluna de aprovação, quando quem executa conclui, então a tarefa vai para as concluídas', () => {
    // Então
    expect(etapaComAprovacao(PEDIDA, 'c-feita', COLUNAS.filter(c => !c.de_aprovacao), BRUNO)).toBe('c-feita');
  });

  it.each([
    ['na coluna de aprovação, com a caixa', { ...PEDIDA, etapa_id: 'c-aprovacao', arquivado_em: null }, true],
    ['na coluna de aprovação, sem a caixa', { ...PEDIDA, precisa_aprovacao: false, etapa_id: 'c-aprovacao', arquivado_em: null }, false],
    ['em "Fazendo"', { ...PEDIDA, etapa_id: 'c-fazendo', arquivado_em: null }, false],
    ['arquivada', { ...PEDIDA, etapa_id: 'c-aprovacao', arquivado_em: '2026-11-22T10:00:00Z' }, false]
  ])('dada a tarefa %s, quando o cartão confere, então espera aprovação = %s', (_caso, t, espera) => {
    // Então
    expect(esperaAprovacao(t, COLUNAS)).toBe(espera);
  });
});

describe('Quem muda a caixa e o solicitante', () => {
  it.each([
    ['tirar a aprovação', { precisa_aprovacao: false }],
    ['se pôr como solicitante', { solicitante_id: 'u-bruno' }]
  ])('dada a tarefa com aprovação, quando quem executa tenta %s, então é recusado', (_caso, novo) => {
    // Então
    expect(() => conferirMudancaDaAprovacao(novo, PEDIDA, BRUNO)).toThrow(SO_QUEM_PEDIU_MUDA_A_APROVACAO);
  });

  it('dada a tarefa com aprovação, quando o solicitante ou um administrador muda, ou quem executa grava o mesmo, então pode', () => {
    // Então
    expect(() => conferirMudancaDaAprovacao({ precisa_aprovacao: false }, PEDIDA, ANA)).not.toThrow();
    expect(() => conferirMudancaDaAprovacao({ solicitante_id: 'u-bruno' }, PEDIDA, MAURO)).not.toThrow();
    expect(() => conferirMudancaDaAprovacao({ ...PEDIDA }, PEDIDA, BRUNO)).not.toThrow();
  });

  it('dada a tarefa sem aprovação, quando quem executa troca o solicitante, então pode (como antes)', () => {
    // Então
    expect(() => conferirMudancaDaAprovacao({ solicitante_id: 'u-bruno' }, { ...PEDIDA, precisa_aprovacao: false }, BRUNO)).not.toThrow();
  });
});

describe('A devolução', () => {
  it('quando quem aprova devolve com um comentário, então ele entra no cartão limpo, dizendo que a tarefa foi devolvida', () => {
    // Então
    expect(comentarioDaDevolucao('  Falta a guia. ')).toBe('Tarefa devolvida: Falta a guia.');
  });

  it.each([
    ['vazio', '   ', SEM_COMENTARIO_DA_DEVOLUCAO],
    ['comprido demais', 'x'.repeat(TAMANHO_TAREFA.devolucao + 1), DEVOLUCAO_LONGA]
  ])('quando o comentário está %s, então a devolução é recusada', (_caso, texto, erro) => {
    // Então
    expect(erroDaDevolucao(texto)).toBe(erro);
  });

  it('dado o quadro com "Fazendo", quando a tarefa é devolvida, então volta para ela; sem "Fazendo", para a do início', () => {
    // Então
    expect(colunaDaDevolucao(COLUNAS)?.id).toBe('c-fazendo');
    expect(colunaDaDevolucao(COLUNAS.filter(c => c.id !== 'c-fazendo'))?.id).toBe('c-fazer');
  });
});
