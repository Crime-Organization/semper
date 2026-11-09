// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { gravaForaDoCartao, listaAteSair, pessoasAoGravar } from './sairDoCartao';

const VE_TUDO = { modulos: { equipe_ve_tudo: true } };
const FASE = { modulos: { equipe_ve_tudo: true, equipe_edita_tudo: true } };

describe('O banco aceita a gravação que deixa a pessoa fora do cartão?', () => {
  it.each([
    ['administradora', { ehAdmin: true }, false, false, true],
    ['quem criou', { ehAdmin: false }, true, false, true],
    ['quem só participa', { ehAdmin: false }, false, false, false],
    ['quem vê pelo item ligado', { ehAdmin: false }, false, true, true],
    ['quem vê pelo item ligado com a chave de ver tudo', { ehAdmin: false, escritorio: VE_TUDO }, false, true, false],
    ['quem só participa na fase de adaptação', { ehAdmin: false, escritorio: FASE }, false, false, true]
  ])('dado %s, então a resposta sai certa', (_caso, ctx, criou, peloLigado, esperado) => {
    // Quando
    const r = gravaForaDoCartao(ctx, criou, peloLigado);
    // Então
    expect(r).toBe(esperado);
  });
});

describe('O que vai para o banco', () => {
  const lista = ['u-carlos'];
  it('dado quem estava na lista e se desmarcou, então a gravação a mantém e a saída vem depois', () => {
    // Quando
    const r = pessoasAoGravar(lista, 'u-ana', 'u-bia', { responsavel_id: 'u-ana', lista: ['u-bia', 'u-carlos'] }, false);
    // Então
    expect(r).toEqual({ lista: ['u-bia', 'u-carlos'], ficou: true });
  });
  it('dada a responsável que passou o cartão, então a gravação a mantém e a saída vem depois', () => {
    // Quando
    const r = pessoasAoGravar(lista, 'u-ana', 'u-bia', { responsavel_id: 'u-bia', lista: ['u-carlos'] }, false);
    // Então
    expect(r).toEqual({ lista: ['u-carlos', 'u-bia'], ficou: true });
  });
  it('dado quem nunca esteve e continua vendo pelo item ligado, então não entra nem sai', () => {
    // Quando
    const r = pessoasAoGravar(lista, 'u-ana', 'u-bia', { responsavel_id: 'u-ana', lista }, false, true);
    // Então
    expect(r).toEqual({ lista, ficou: false });
  });
  it('dado quem nunca esteve e tirou a ligação, então entra na lista para não perder o acesso, sem saída', () => {
    // Quando
    const r = pessoasAoGravar(lista, 'u-ana', 'u-bia', { responsavel_id: 'u-ana', lista }, false, false);
    // Então
    expect(r).toEqual({ lista: ['u-carlos', 'u-bia'], ficou: false });
  });
  it('dado quem pode gravar fora do cartão, então nada muda, mesmo tendo saído', () => {
    // Quando
    const r = pessoasAoGravar(lista, 'u-ana', 'u-bia', { responsavel_id: 'u-ana', lista: ['u-bia', 'u-carlos'] }, true);
    // Então
    expect(r).toEqual({ lista, ficou: false });
  });
});

describe('A lista da gravação que ainda mantém a pessoa', () => {
  it('dado que ela estava em primeiro, quando se desmarca, então volta ao primeiro lugar', () => {
    // Quando
    const r = listaAteSair(['u-carlos'], 'u-bia', ['u-bia', 'u-carlos']);
    // Então
    expect(r).toEqual(['u-bia', 'u-carlos']);
  });
  it('dado que a lista encolheu, quando o lugar antigo não existe mais, então ela fica no fim', () => {
    // Quando
    const r = listaAteSair([], 'u-bia', ['u-carlos', 'u-bia']);
    // Então
    expect(r).toEqual(['u-bia']);
  });
  it('dado que ela era a responsável e não estava na lista, então entra no fim', () => {
    // Quando
    const r = listaAteSair(['u-carlos'], 'u-bia', ['u-carlos']);
    // Então
    expect(r).toEqual(['u-carlos', 'u-bia']);
  });
});
