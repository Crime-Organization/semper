// Quem está num contrato vê as demandas e as tarefas dele, só para ler (#326). Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { Membro } from '../dados/tipos';
import { contratosEmQueEsta, estaNoContrato } from './contrato';
import { estaNaDemanda, motivoSemMencaoNaDemanda, veADemanda } from './demanda';
import { motivoDeSoLerOCartao, SO_LEITURA_DO_CARTAO, SO_LEITURA_FORA_DO_CARTAO, SO_LEITURA_PELO_CONTRATO, soLeSemEstarNele } from './equipeVeTudo';
import { estaNaTarefa, motivoSemMencaoNaTarefa, soLeATarefaNaLista, veATarefa } from './tarefa';

const membro = (id: string, pessoa_id: string | null = null, papel: Membro['papel'] = 'usuario') =>
  ({ id, nome: id, usuario: id, papel, ativo: true, pessoa_id }) as Membro;
/** O contrato k1: criado por u-criou, de responsabilidade de u-resp, com a pessoa p-part (do usuário u-part) como participante. */
const k1 = { id: 'k1', criado_por: 'u-criou', responsavel_id: 'u-resp', participantes: ['p-part'] };
const k2 = { id: 'k2', criado_por: 'u-outro', responsavel_id: 'u-outro', participantes: [] };
const participante = membro('u-part', 'p-part'), deFora = membro('u-fora', 'p-fora');

describe('Quem está no contrato (#326)', () => {
  it.each([
    ['quem criou', membro('u-criou'), true],
    ['o responsável', membro('u-resp'), true],
    ['o participante, pela pessoa do usuário', participante, true],
    ['alguém de fora', deFora, false],
    ['um administrador de fora (ele já vê tudo pelo papel)', membro('u-adm', 'p-adm', 'admin'), false],
    ['uma conta sem cadastro em Pessoas', membro('u-sem'), false]
  ])('quando é %s, então estar no contrato é %s', (_caso, m, esperado) => {
    // Então
    expect(estaNoContrato(k1, m)).toBe(esperado);
  });

  it('dados dois contratos, quando se pergunta em quais o participante está, então vem só o dele', () => {
    // Quando
    const ids = contratosEmQueEsta([k1, k2], participante);
    // Então
    expect(ids).toEqual(['k1']);
    expect(contratosEmQueEsta([k1, k2], deFora)).toEqual([]);
  });

  it('dado um contrato que veio vazio no cartão (quem lê não pode abri-lo), quando se pergunta, então ele não conta', () => {
    // Então
    expect(contratosEmQueEsta([null, undefined, k1], participante)).toEqual(['k1']);
  });
});

describe('A demanda do contrato (#326)', () => {
  const demanda = { criado_por: 'u-master', responsavel_id: 'u-master', colaboradores: [], contrato_id: 'k1' };

  it('dada uma demanda do contrato, quando quem está no contrato pergunta, então vê, mas não está nela', () => {
    // Quando / Então
    expect(veADemanda(demanda, participante, ['k1'])).toBe(true);
    expect(estaNaDemanda(demanda, participante)).toBe(false);
  });

  it.each([
    ['a demanda é de outro contrato', { ...demanda, contrato_id: 'k2' }],
    ['a demanda não tem contrato', { ...demanda, contrato_id: null }]
  ])('quando %s, então quem está só no contrato k1 não a vê', (_caso, d) => {
    // Então
    expect(veADemanda(d, participante, ['k1'])).toBe(false);
  });

  it('dado que a pessoa saiu do contrato, quando a lista dos contratos dela vem vazia, então não vê mais a demanda', () => {
    // Dado
    const contratos = contratosEmQueEsta([{ ...k1, participantes: [] }], participante);
    // Então
    expect(veADemanda(demanda, participante, contratos)).toBe(false);
  });

  it('dada uma demanda cujo contrato veio com quem está nele, quando se pergunta quem pode ser mencionado, então quem está no contrato pode, e quem está fora não', () => {
    // Dado
    const comOContrato = { ...demanda, contrato: k1 };
    // Então
    expect(motivoSemMencaoNaDemanda(comOContrato)(participante)).toBeNull();
    expect(motivoSemMencaoNaDemanda(comOContrato)(membro('u-resp'))).toBeNull();
    expect(motivoSemMencaoNaDemanda(comOContrato)(deFora)).toBe('não participa; inclua como colaborador');
  });

  it('dada uma demanda cujo contrato quem comenta não pode abrir (veio null), quando se pergunta, então só conta quem está na demanda', () => {
    // Então: sem saber quem está no contrato, a tela não oferece a pessoa (o banco aceita se a menção for escrita à mão)
    expect(motivoSemMencaoNaDemanda({ ...demanda, contrato: null })(participante)).toBe('não participa; inclua como colaborador');
  });
});

describe('A tarefa do contrato (#326)', () => {
  const tarefa = { criado_por: 'u-master', responsavel_id: 'u-master', participantes: [], contrato_id: null as string | null };
  const demandaDoContrato = { criado_por: 'u-master', responsavel_id: 'u-master', colaboradores: [], contrato_id: 'k1' };

  it.each([
    ['ligada ao contrato', { ...tarefa, contrato_id: 'k1' }, null, true],
    ['ligada a uma demanda do contrato', tarefa, demandaDoContrato, true],
    ['de outro contrato', { ...tarefa, contrato_id: 'k2' }, null, false],
    ['de uma demanda de outro contrato', tarefa, { ...demandaDoContrato, contrato_id: 'k2' }, false],
    ['sem contrato e sem demanda', tarefa, null, false]
  ])('dada uma tarefa %s, quando quem está no contrato k1 pergunta, então vê: %s', (_caso, t, d, esperado) => {
    // Então
    expect(veATarefa(t, participante, d, ['k1'])).toBe(esperado);
    expect(estaNaTarefa(t, participante, d)).toBe(false);
  });

  it.each([
    ['ligada ao contrato', { ...tarefa, contrato_id: 'k1', contrato: k1 }, null],
    ['ligada a uma demanda do contrato', tarefa, { ...demandaDoContrato, contrato: k1 }]
  ])('dada uma tarefa %s, com o contrato vindo com quem está nele, quando se pergunta quem pode ser mencionado, então quem está no contrato pode, e quem está fora não', (_caso, t, d) => {
    // Então
    expect(motivoSemMencaoNaTarefa(t, d)(participante)).toBeNull();
    expect(motivoSemMencaoNaTarefa(t, d)(deFora)).toBe('não participa; inclua como participante');
  });

  it('dada uma tarefa de uma demanda do contrato que quem comenta não pode abrir, quando se pergunta, então só conta quem está na tarefa e na demanda', () => {
    // Então
    expect(motivoSemMencaoNaTarefa(tarefa, { ...demandaDoContrato, contrato: null })(participante)).toBe('não participa; inclua como participante');
  });

  const naLista = { ...tarefa, equipe_da_demanda: null };
  it.each([
    ['sem demanda, vista só pelo contrato', naLista, participante, true],
    ['de uma demanda em que a pessoa não está (vista pelo contrato)', { ...naLista, equipe_da_demanda: demandaDoContrato }, participante, true],
    ['de uma demanda em que a pessoa colabora', { ...naLista, equipe_da_demanda: { ...demandaDoContrato, colaboradores: ['u-part'] } }, participante, false],
    ['em que a pessoa é a responsável', { ...naLista, responsavel_id: 'u-part', equipe_da_demanda: demandaDoContrato }, participante, false],
    ['de uma demanda, para um administrador', { ...naLista, equipe_da_demanda: demandaDoContrato }, membro('u-adm', null, 'admin'), false]
  ])('dada uma tarefa %s, quando a lista confere, então ela fica só para ler: %s', (_caso, t, m, esperado) => {
    // Então
    expect(soLeATarefaNaLista(t, m)).toBe(esperado);
  });
});

describe('Só ler a demanda ou a tarefa (#326)', () => {
  const chaves = (equipe_ve_tudo: boolean, equipe_edita_tudo = false) => ({ modulos: { equipe_ve_tudo, equipe_edita_tudo } });

  it.each([
    ['chaves desligadas, fora do cartão e no contrato dele', chaves(false), false, true, SO_LEITURA_PELO_CONTRATO],
    ['chaves desligadas, fora do cartão e fora do contrato (só no banco fictício)', chaves(false), false, false, SO_LEITURA_FORA_DO_CARTAO],
    ['chaves desligadas, no cartão', chaves(false), true, true, null],
    ['toda a equipe vê, fora do cartão', chaves(true), false, false, SO_LEITURA_DO_CARTAO],
    ['toda a equipe vê, no cartão', chaves(true), true, false, null],
    ['fase de adaptação, fora do cartão', chaves(true, true), false, false, null]
  ])('dado %s, quando se confere, então o motivo de só ler é %s', (_caso, escritorio, estaNele, noContrato, esperado) => {
    // Dado
    const ctx = { escritorio, perfil: 'eu' };
    // Então
    expect(motivoDeSoLerOCartao(ctx, () => estaNele, () => noContrato)).toBe(esperado);
    expect(soLeSemEstarNele(ctx, () => estaNele)).toBe(esperado !== null);
  });
});
