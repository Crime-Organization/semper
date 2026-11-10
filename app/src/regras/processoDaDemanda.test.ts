// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { DemandaDoProcesso } from '../dados/tipos';
import { camposDaDemanda, devePerguntarProcesso, ligacoesParaTarefa } from './processoDaDemanda';

const cliente = (id: string) => ({ id, codigo: id, nome: id, arquivado_em: null }) as never;

describe('O cadastro que vem da demanda', () => {
  it('quando todos estão ativos, então traz clientes, responsável e colaboradores', () => {
    // Quando
    const c = camposDaDemanda({ responsavel_id: 'u1', colaboradores: ['u2'], clientes: [cliente('c1'), cliente('c2')] }, ['u1', 'u2'], 'eu');
    // Então
    expect(c).toEqual({ responsavelId: 'u1', colaboradores: ['u2'], clientes: ['c1', 'c2'] });
  });

  it('quando o responsável ou um colaborador saiu, então fica quem está cadastrando, e o colaborador sai', () => {
    // Quando
    const c = camposDaDemanda({ responsavel_id: 'saiu', colaboradores: ['foi', 'eu', 'u2'], clientes: [cliente('c1')] }, ['eu', 'u2'], 'eu');
    // Então
    expect(c).toEqual({ responsavelId: 'eu', colaboradores: ['u2'], clientes: ['c1'] });
  });

  it('quando a demanda não tem cliente, então o cadastro fica com a linha vazia, para escolher', () => {
    // Então
    expect(camposDaDemanda({ responsavel_id: 'u1', colaboradores: [], clientes: [] }, ['u1'], 'u1').clientes).toEqual(['']);
  });
});

describe('Perguntar ao concluir', () => {
  const BASE = { modulo: true, arquivada: false, etapa: 'fim', concluida: 'fim', ligados: 0 };
  it.each([
    ['foi para a coluna das concluídas, sem processo', {}, true],
    ['foi para outra coluna', { etapa: 'x' }, false],
    ['saiu do quadro', { etapa: null }, false],
    ['o quadro não tem coluna de concluídas', { etapa: null, concluida: null }, false],
    ['já tem processo', { ligados: 1 }, false],
    ['a demanda está arquivada', { arquivada: true }, false],
    ['o escritório não tem o módulo', { modulo: false }, false]
  ])('quando %s, então a resposta é a certa', (_caso, mudanca, resposta) => {
    // Então
    expect(devePerguntarProcesso({ ...BASE, ...mudanca })).toBe(resposta);
  });
});

describe('O que a tarefa nascida no processo herda', () => {
  const demanda = (extra: Partial<DemandaDoProcesso> = {}) => ({
    id: 'd1', codigo: 'D1', titulo: 'T', objeto: null, prazo: null, prazo_hora: null, etapa_id: null, arquivado_em: null, criado_em: '', papeis: [], contrato_id: 'k1', criado_por: 'u1', responsavel_id: 'u1', colaboradores: ['u2'], ...extra
  });
  const PROCESSO = { segredo: false, criado_por: 'u9', responsavel_id: 'u1', colaboradores: ['u2'] };
  const NADA = { demanda_id: null, contrato_id: null };

  it('quando há uma demanda só, e toda a equipe dela vê o processo, então herda a demanda e o contrato', () => {
    // Então
    expect(ligacoesParaTarefa([demanda()], PROCESSO)).toEqual({ demanda_id: 'd1', contrato_id: 'k1' });
  });

  it.each([
    ['nenhuma demanda', [], PROCESSO],
    ['duas demandas', [demanda(), demanda({ id: 'd2' })], PROCESSO],
    ['processo em segredo de justiça', [demanda()], { ...PROCESSO, segredo: true }],
    ['colaborador da demanda fora do processo', [demanda({ colaboradores: ['u2', 'u5'] })], PROCESSO],
    ['quem criou a demanda fora do processo', [demanda({ criado_por: 'u5' })], PROCESSO]
  ])('quando há %s, então não herda', (_caso, ligadas, processo) => {
    // Então
    expect(ligacoesParaTarefa(ligadas, processo)).toEqual(NADA);
  });

  it('quando só uma das duas demandas está ativa, então herda essa', () => {
    // Então
    expect(ligacoesParaTarefa([demanda({ id: 'd2', arquivado_em: 'x' }), demanda()], PROCESSO).demanda_id).toBe('d1');
  });

  it('quando quem criou a demanda saiu do sistema, então isso não impede', () => {
    // Então
    expect(ligacoesParaTarefa([demanda({ criado_por: null })], PROCESSO).demanda_id).toBe('d1');
  });
});
