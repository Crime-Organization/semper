// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { GrupoDaLista, ItemDaLista, NoDoModelo } from '../dados/tipos';
import {
  ACOES_DO_NO, CHECKLIST_MUDOU, aplicarPosicoes, avisoDaPosicao, comOsNovos, descricaoDoNo, ondeEntramOsNovos, semOGrupo, tamanhoDoModelo,
  grupoDoNo, textoDaExclusaoDoGrupo, FORA_DOS_GRUPOS, GRUPO_DE_OUTRO_CHECKLIST, GRUPO_DENTRO_DELE, NIVEIS_DEMAIS, acharNo, acoesPossiveis, alturaDoNo,
  arvoreDaLista, arvoreDasLinhas, arvoreDoChecklist, arvoreDoModelo, arvoreDosItens, contagemDoGrupo, destinosDoNo, emOrdemDeLeitura, erroDaArvore,
  itensDaArvore, limparArvore, linhasColadas, listaDoModelo, moverEntreIrmaos, moverParaGrupo, mudancasDePosicao, noDeCima, numeroDoNo, ondeEntraONovo,
  planoDoChecklist, podeTerSubgrupo, posicoesDaArvore, reconciliarArvore, segueALeitura, type ChecklistDaArvore, type NoDaLista, type ResultadoDaAcao,
  emOrdemNaTela, erroAoAcrescentar, gruposDeCima, NAO_CABE_NO_GRUPO, noDeCimaNaTela, comAArvoreNova, ondeEntraAArvore
} from './gruposDaLista';

const grupo = (id: string, nome: string, pai_id: string | null, ordem: number, criado_em = '2026-11-19T10:00:00Z'): GrupoDaLista =>
  ({ id, nome, pai_id, ordem, criado_em });
const item = (id: string, texto: string, grupo_id: string | null, ordem: number, feito = false, criado_em = '2026-11-19T10:00:00Z'): ItemDaLista =>
  ({ id, texto, prazo: null, feito_em: feito ? '2026-11-19T11:00:00Z' : null, feito_por: null, ordem, grupo_id, criado_em });
// O exemplo do dono: 1. Documentos pessoais › 1.1 RG, 1.2 CPF; 2. Benefício › 2.1 Aposentadoria por idade › 2.1.1 CNIS,
// 2.1.2 Carteira de trabalho; 2.2 Auxílio-doença › 2.2.1 Laudo médico.
const EXEMPLO: ChecklistDaArvore = {
  grupos: [grupo('g1', 'Documentos pessoais', null, 1), grupo('g2', 'Benefício', null, 4), grupo('g3', 'Aposentadoria por idade', 'g2', 5),
    grupo('g4', 'Auxílio-doença', 'g2', 8)],
  itens: [item('rg', 'RG', 'g1', 2), item('cpf', 'CPF', 'g1', 3), item('cnis', 'CNIS', 'g3', 6), item('ctps', 'Carteira de trabalho', 'g3', 7),
    item('laudo', 'Laudo médico', 'g4', 9)]
};
const nome = (n: NoDaLista) => n.tipo === 'grupo' ? n.grupo.nome : n.item.texto;
const numerados = (arvore: NoDaLista[]) => emOrdemDeLeitura(arvore).map(n => `${n.numero} ${nome(n)}`);
const NUMERADO = ['1. Documentos pessoais', '1.1 RG', '1.2 CPF', '2. Benefício', '2.1 Aposentadoria por idade', '2.1.1 CNIS',
  '2.1.2 Carteira de trabalho', '2.2 Auxílio-doença', '2.2.1 Laudo médico'];
const arvoreDe = (r: ResultadoDaAcao) => { if ('motivo' in r) throw new Error(r.motivo); return r.arvore; };
const MODELO: NoDoModelo[] = [
  { texto: 'Documentos pessoais', filhos: [{ texto: 'RG' }, { texto: 'CPF' }] },
  { texto: 'Benefício', filhos: [
    { texto: 'Aposentadoria por idade', filhos: [{ texto: 'CNIS' }, { texto: 'Carteira de trabalho' }] },
    { texto: 'Auxílio-doença', filhos: [{ texto: 'Laudo médico' }] }] }
];

describe('Montar e numerar o checklist (#309)', () => {
  it('dado o exemplo do dono, quando monta a árvore, então os grupos e os itens vêm numerados 1., 1.1, 2.1.1', () => {
    // Quando
    const arvore = arvoreDaLista(EXEMPLO);
    // Então
    expect(numerados(arvore)).toEqual(NUMERADO);
    expect(acharNo(arvore, 'cnis')).toMatchObject({ nivel: 3, caminho: '2. Benefício › 2.1 Aposentadoria por idade' });
    expect(acharNo(arvore, 'g1')).toMatchObject({ nivel: 1, caminho: '' });
  });

  it('dado um checklist sem grupos, quando monta a árvore, então os itens ficam 1., 2., 3.', () => {
    // Dado
    const lista = { grupos: [], itens: [item('c', 'C', null, 3), item('a', 'A', null, 1), item('b', 'B', null, 2)] };
    // Então
    expect(numerados(arvoreDaLista(lista))).toEqual(['1. A', '2. B', '3. C']);
  });

  it('quando pede o número pela posição, então o primeiro nível tem ponto e os outros não', () => {
    // Então
    expect([numeroDoNo([2]), numeroDoNo([2, 1]), numeroDoNo([2, 1, 1])]).toEqual(['2.', '2.1', '2.1.1']);
  });

  it('dado o grupo Benefício com um item feito num subgrupo, quando conta, então soma os itens de dentro, em qualquer nível', () => {
    // Dado
    const lista = { ...EXEMPLO, itens: EXEMPLO.itens.map(i => i.id === 'cnis' ? { ...i, feito_em: 'x' } : i) };
    // Quando
    const beneficio = acharNo(arvoreDaLista(lista), 'g2')!;
    // Então
    expect(beneficio).toMatchObject({ feitos: 1, total: 3 });
    expect(contagemDoGrupo(beneficio)).toEqual({ feitos: 1, total: 3 });
  });

  it('dado um grupo ou um item cujo grupo de cima não veio, quando monta, então ele fica no primeiro nível', () => {
    // Dado
    const lista = { grupos: [grupo('g', 'Solto', 'sumiu', 1)], itens: [item('i', 'Perdido', 'sumiu', 2)] };
    // Então
    expect(numerados(arvoreDaLista(lista))).toEqual(['1. Solto', '2. Perdido']);
  });

  it('dado um ciclo (que o banco não deixa), quando monta, então cada grupo aparece uma vez e nada trava', () => {
    // Dado
    const lista = { grupos: [grupo('a', 'A', 'b', 1), grupo('b', 'B', 'a', 2)], itens: [] };
    // Então
    expect(numerados(arvoreDaLista(lista))).toEqual(['1. A', '1.1 B']);
  });

  it('quando posiciona os grupos, então vale o primeiro item de dentro; o grupo vazio usa a dele; o empate vai por criado_em e id', () => {
    // Dado: o grupo G tem "ordem" 10, mas o item dele tem 1; o vazio V tem 2; X e Y empatam em 3
    const lista = {
      grupos: [grupo('G', 'G', null, 10), grupo('V', 'V', null, 2)],
      itens: [item('g1', 'Dentro de G', 'G', 1), item('y', 'Y', null, 3, false, '2026-11-19T12:00:00Z'), item('x', 'X', null, 3, false, '2026-11-19T11:00:00Z'),
        item('z2', 'Z2', null, 4), item('z1', 'Z1', null, 4)]
    };
    // Então
    expect(arvoreDaLista(lista).map(nome)).toEqual(['G', 'V', 'X', 'Y', 'Z1', 'Z2']);
  });

  it('dado que a versão anterior renumerou os itens de 1 a n, quando monta, então grupos e itens soltos continuam no lugar, e o novo dela vem no fim', () => {
    // Dado: G1 a, G2 b, G3 c (grupos 1, 3, 5; itens 2, 4, 6) renumerados pela versão anterior (a=1, b=2, c=3), mais o "X" dela (4)
    const lista = {
      grupos: [grupo('G1', 'G1', null, 1), grupo('G2', 'G2', null, 3), grupo('G3', 'G3', null, 5)],
      itens: [item('a', 'a', 'G1', 1), item('b', 'b', 'G2', 2), item('c', 'c', 'G3', 3), item('x', 'X', null, 4)]
    };
    // Então
    expect(numerados(arvoreDaLista(lista))).toEqual(['1. G1', '1.1 a', '2. G2', '2.1 b', '3. G3', '3.1 c', '4. X']);
    expect(segueALeitura(lista)).toBe(false);
  });

  it('quando pede a altura, o nó de cima e se o grupo pode ter subgrupo, então segue os níveis', () => {
    // Dado
    const arvore = arvoreDaLista(EXEMPLO);
    // Então
    expect([alturaDoNo(acharNo(arvore, 'g2')!), alturaDoNo(acharNo(arvore, 'g1')!), alturaDoNo(acharNo(arvore, 'rg')!)]).toEqual([3, 2, 1]);
    expect(noDeCima(arvore, 'cpf')?.id).toBe('rg');
    expect(noDeCima(arvore, 'g2')?.id).toBe('cpf');
    expect(noDeCima(arvore, 'g1')).toBeNull();
    expect([podeTerSubgrupo(acharNo(arvore, 'g2')!), podeTerSubgrupo(acharNo(arvore, 'g3')!), podeTerSubgrupo(acharNo(arvore, 'rg')!)]).toEqual([true, false, false]);
  });
});

describe('Subir, descer e mover para grupo (#309)', () => {
  it('quando o grupo 1 desce, então ele leva os itens e a numeração se ajusta', () => {
    // Quando
    const depois = arvoreDe(ACOES_DO_NO.descer.aplicar(arvoreDaLista(EXEMPLO), 'g1'));
    // Então
    expect(numerados(depois).slice(0, 2)).toEqual(['1. Benefício', '1.1 Aposentadoria por idade']);
    expect(numerados(depois)).toContain('2.1 RG');
  });

  it.each([
    ['o primeiro sobe', 'rg', -1, 'Já é o primeiro deste grupo.'],
    ['o último desce', 'cpf', 1, 'Já é o último deste grupo.'],
    ['some do checklist', 'nao-existe', 1, CHECKLIST_MUDOU]
  ] as const)('quando %s, então nada muda e o motivo é dado', (_caso, id, passo, motivo) => {
    // Então
    expect(moverEntreIrmaos(arvoreDaLista(EXEMPLO), id, passo)).toEqual({ motivo });
  });

  it('quando lista os destinos de um item, então vêm "Fora dos grupos" e todos os grupos numerados', () => {
    // Então
    expect(destinosDoNo(arvoreDaLista(EXEMPLO), 'rg').map(d => d.nome))
      .toEqual([FORA_DOS_GRUPOS, '1. Documentos pessoais', '2. Benefício', '2.1 Aposentadoria por idade', '2.2 Auxílio-doença']);
  });

  it('quando lista os destinos de um grupo, então ele mesmo, os de dentro dele e os que passariam de 3 níveis ficam de fora', () => {
    // Dado
    const arvore = arvoreDaLista(EXEMPLO);
    // Então: o Benefício (com subgrupos) só cabe fora dos grupos; o Documentos pessoais (com itens) cabe no 1º nível, não no 2º
    expect(destinosDoNo(arvore, 'g2').map(d => d.nome)).toEqual([FORA_DOS_GRUPOS]);
    expect(destinosDoNo(arvore, 'g1').map(d => d.nome)).toEqual([FORA_DOS_GRUPOS, '2. Benefício']);
  });

  it('dado um grupo vazio, quando lista os destinos, então ele não vai para um grupo do 2º nível (o grupo vai só até o 2º nível)', () => {
    // Dado
    const arvore = arvoreDaLista({ ...EXEMPLO, grupos: [...EXEMPLO.grupos, grupo('vazio', 'Vazio', null, 10)] });
    // Então
    expect(destinosDoNo(arvore, 'vazio').map(d => d.nome)).toEqual([FORA_DOS_GRUPOS, '1. Documentos pessoais', '2. Benefício']);
  });

  it('quando o RG vai para o 2.1, então ele vira o último de lá; e volta para fora dos grupos no fim do checklist', () => {
    // Quando
    const la = arvoreDe(moverParaGrupo(arvoreDaLista(EXEMPLO), 'rg', 'g3'));
    // Então
    expect(acharNo(la, 'rg')?.numero).toBe('2.1.3');
    expect(acharNo(la, 'cpf')?.numero).toBe('1.1');
    // E quando volta
    const fora = arvoreDe(moverParaGrupo(la, 'rg', null));
    expect(acharNo(fora, 'rg')?.numero).toBe('3.');
  });

  it('quando o grupo vai para outro, então leva o que está dentro', () => {
    // Quando
    const depois = arvoreDe(moverParaGrupo(arvoreDaLista(EXEMPLO), 'g1', 'g2'));
    // Então
    expect(numerados(depois)).toEqual(['1. Benefício', '1.1 Aposentadoria por idade', '1.1.1 CNIS', '1.1.2 Carteira de trabalho', '1.2 Auxílio-doença',
      '1.2.1 Laudo médico', '1.3 Documentos pessoais', '1.3.1 RG', '1.3.2 CPF']);
  });

  it.each([
    ['já está nesse grupo', 'rg', 'g1', 'Já está nesse grupo.'],
    ['iria para dentro de um subgrupo dele', 'g2', 'g3', GRUPO_DENTRO_DELE],
    ['iria para dentro dele mesmo', 'g2', 'g2', GRUPO_DENTRO_DELE],
    ['passaria de 3 níveis', 'g1', 'g3', NIVEIS_DEMAIS],
    ['o grupo de destino sumiu', 'rg', 'nao-existe', CHECKLIST_MUDOU]
  ] as const)('quando o nó %s, então nada muda e o motivo é o do banco', (_caso, id, destino, motivo) => {
    // Então
    expect(moverParaGrupo(arvoreDaLista(EXEMPLO), id, destino)).toEqual({ motivo });
  });

  it('dado um checklist sem grupos, quando pede as ações de um item, então "Mover para grupo" não aparece', () => {
    // Dado
    const arvore = arvoreDaLista({ grupos: [], itens: [item('a', 'A', null, 1), item('b', 'B', null, 2)] });
    // Então
    expect(acoesPossiveis(arvore, 'a')).toEqual({ ordem: ['descer'], moverParaGrupo: false });
    expect(acoesPossiveis(arvoreDaLista(EXEMPLO), 'cnis')).toEqual({ ordem: ['descer'], moverParaGrupo: true });
  });
});

describe('Gravar a ordem (#309)', () => {
  it('quando o grupo 1 desce, então só mudam as posições dos nós que trocaram de lugar', () => {
    // Dado: as posições guardadas já seguem a leitura, de 1 a 9
    expect(segueALeitura(EXEMPLO)).toBe(true);
    // Quando
    const mudancas = mudancasDePosicao(EXEMPLO, arvoreDe(ACOES_DO_NO.subir.aplicar(arvoreDaLista(EXEMPLO), 'g2')));
    // Então: o Benefício (4 a 9) passa para 1 a 6, e os Documentos (1 a 3) para 7 a 9
    expect(mudancas.map(p => [p.id, p.ordem])).toEqual([['g2', 1], ['g3', 2], ['cnis', 3], ['ctps', 4], ['g4', 5], ['laudo', 6], ['g1', 7], ['rg', 8], ['cpf', 9]]);
    expect(posicoesDaArvore(arvoreDaLista(EXEMPLO))[2]).toEqual({ id: 'cpf', tipo: 'item', pai_id: 'g1', ordem: 3 });
  });

  it('quando o item muda de grupo, então a posição dele leva o grupo novo', () => {
    // Quando
    const mudancas = mudancasDePosicao(EXEMPLO, arvoreDe(moverParaGrupo(arvoreDaLista(EXEMPLO), 'laudo', 'g3')));
    // Então
    expect(mudancas).toEqual([{ id: 'laudo', tipo: 'item', pai_id: 'g3', ordem: 8 }, { id: 'g4', tipo: 'grupo', pai_id: 'g2', ordem: 9 }]);
  });

  it('dado que a versão anterior renumerou os itens, quando algo muda, então o checklist volta a seguir a ordem de leitura', () => {
    // Dado
    const lista = { ...EXEMPLO, itens: EXEMPLO.itens.map((i, k) => ({ ...i, ordem: k + 1 })) };
    expect(segueALeitura(lista)).toBe(false);
    // Quando
    const mudancas = mudancasDePosicao(lista, arvoreDe(ACOES_DO_NO.subir.aplicar(arvoreDaLista(lista), 'cpf')));
    // Então: são gravadas as que não estão no lugar da leitura, e o checklist gravado volta a segui-la
    expect(mudancas.map(p => [p.id, p.ordem])).toEqual([['rg', 3], ['cnis', 6], ['ctps', 7], ['laudo', 9]]);
    const gravada = { ...lista, itens: lista.itens.map(i => ({ ...i, ordem: mudancas.find(p => p.id === i.id)?.ordem ?? i.ordem })) };
    expect(segueALeitura(gravada)).toBe(true);
    expect(numerados(arvoreDaLista(gravada)).slice(0, 3)).toEqual(['1. Documentos pessoais', '1.1 CPF', '1.2 RG']);
  });

  it('quando o novo entra no fim do checklist, então fica depois da maior posição de grupos e itens, no primeiro nível', () => {
    // Dado: um grupo vazio no fim, com a maior posição
    const arvore = arvoreDaLista({ ...EXEMPLO, grupos: [...EXEMPLO.grupos, grupo('vazio', 'Vazio', null, 20)] });
    // Então
    expect(ondeEntraONovo(arvore, null)).toEqual({ pai_id: null, ordem: 21, renumerar: [] });
  });

  it('quando o novo entra no fim de um grupo, então fica entre o último de dentro dele e o próximo nó', () => {
    // Então
    expect(ondeEntraONovo(arvoreDaLista(EXEMPLO), 'g1')).toEqual({ pai_id: 'g1', ordem: 3.5, renumerar: [] });
    expect(ondeEntraONovo(arvoreDaLista(EXEMPLO), 'g2')).toEqual({ pai_id: 'g2', ordem: 10, renumerar: [] });
  });

  it('dado um vão pequeno demais, quando o novo entra no grupo, então o checklist é renumerado com um lugar para ele', () => {
    // Dado
    const lista = { grupos: [grupo('g', 'G', null, 1)], itens: [item('a', 'A', 'g', 2), item('b', 'B', null, 2 + 1e-7)] };
    // Quando
    const onde = ondeEntraONovo(arvoreDaLista(lista), 'g');
    // Então
    expect(onde).toEqual({ pai_id: 'g', ordem: 3, renumerar: [{ id: 'b', tipo: 'item', pai_id: null, ordem: 4 }] });
  });

  it.each([
    ['certa', EXEMPLO, ''],
    ['com um grupo de outro checklist', { ...EXEMPLO, itens: [item('x', 'X', 'de-outro', 1)] }, GRUPO_DE_OUTRO_CHECKLIST],
    ['com um ciclo', { grupos: [grupo('a', 'A', 'b', 1), grupo('b', 'B', 'a', 2)], itens: [] }, GRUPO_DENTRO_DELE],
    ['com grupo no 3º nível', { grupos: [grupo('a', 'A', null, 1), grupo('b', 'B', 'a', 2), grupo('c', 'C', 'b', 3)], itens: [] }, NIVEIS_DEMAIS],
    ['com item no 4º nível', { ...EXEMPLO, grupos: [...EXEMPLO.grupos, grupo('g5', 'Fundo', 'g3', 10)], itens: [item('x', 'X', 'g5', 11)] }, NIVEIS_DEMAIS]
  ])('dada uma árvore %s, quando confere, então dá o erro do banco', (_caso, lista, erro) => {
    // Então
    expect(erroDaArvore(lista)).toBe(erro);
  });
});

describe('Modelos com grupos (#309)', () => {
  it('quando pede as folhas do modelo, então vêm os itens na ordem de leitura', () => {
    // Então
    expect(itensDaArvore(MODELO)).toEqual(['RG', 'CPF', 'CNIS', 'Carteira de trabalho', 'Laudo médico']);
  });

  it('dado um modelo de antes (sem árvore), quando lê, então os itens viram a árvore sem grupos', () => {
    // Então
    expect(arvoreDoModelo({ itens: ['A', 'B'], arvore: null })).toEqual([{ texto: 'A' }, { texto: 'B' }]);
    expect(arvoreDosItens(['A'])).toEqual([{ texto: 'A' }]);
  });

  it('dado que a árvore está em dia com os itens, quando reconcilia, então devolve a mesma árvore', () => {
    // Então
    expect(reconciliarArvore(MODELO, itensDaArvore(MODELO))).toBe(MODELO);
    expect(arvoreDoModelo({ itens: itensDaArvore(MODELO), arvore: MODELO })).toBe(MODELO);
  });

  it('dado que a versão anterior tirou o Laudo e pôs um item novo, quando reconcilia, então o grupo vazio some e o novo vai para o fim', () => {
    // Quando
    const nova = reconciliarArvore(MODELO, ['RG', 'CPF', 'CNIS', 'Carteira de trabalho', 'Procuração']);
    // Então
    expect(nova).toEqual([MODELO[0], { texto: 'Benefício', filhos: [MODELO[1].filhos![0]] }, { texto: 'Procuração' }]);
  });

  it('dado que a versão anterior trocou a ordem dentro de um grupo e repetiu um texto, quando reconcilia, então as folhas seguem a ordem nova', () => {
    // Quando
    const nova = reconciliarArvore(MODELO, ['CPF', 'RG', 'Carteira de trabalho', 'CNIS', 'Laudo médico', 'RG']);
    // Então
    expect(nova[0]).toEqual({ texto: 'Documentos pessoais', filhos: [{ texto: 'CPF' }, { texto: 'RG' }] });
    expect(nova[1].filhos![0].filhos).toEqual([{ texto: 'Carteira de trabalho' }, { texto: 'CNIS' }]);
    expect(nova.at(-1)).toEqual({ texto: 'RG' });
  });

  it('quando limpa a árvore, então tira os espaços, os itens vazios e os grupos sem nada dentro', () => {
    // Dado
    const suja: NoDoModelo[] = [{ texto: ' Documentos ', filhos: [{ texto: ' RG ' }, { texto: '  ' }] }, { texto: 'Vazio', filhos: [{ texto: '' }] }, { texto: 'Solto' }];
    // Então
    expect(limparArvore(suja)).toEqual([{ texto: 'Documentos', filhos: [{ texto: 'RG' }] }, { texto: 'Solto' }]);
  });

  it.each([
    ['grupo no 3º nível', [{ texto: 'A', filhos: [{ texto: 'B', filhos: [{ texto: 'C', filhos: [{ texto: 'D' }] }] }] }], NIVEIS_DEMAIS],
    ['51 grupos', Array.from({ length: 51 }, (_, i) => ({ texto: `G${i}`, filhos: [{ texto: `I${i}` }] })), 'Um modelo pode ter até 50 grupos.'],
    ['101 itens', Array.from({ length: 101 }, (_, i) => ({ texto: `I${i}` })), 'Um modelo pode ter até 100 itens.'],
    ['item grande', [{ texto: 'a'.repeat(501) }], 'Cada item do modelo pode ter até 500 caracteres.'],
    ['nome de grupo grande', [{ texto: 'a'.repeat(121), filhos: [{ texto: 'B' }] }], 'O nome de cada grupo pode ter até 120 caracteres.']
  ])('dado um modelo com %s, quando limpa, então dá o motivo', (_caso, arvore, motivo) => {
    // Então
    expect(limparArvore(arvore)).toBe(motivo);
  });

  it('quando o modelo vira checklist em memória e volta, então a árvore é a mesma, numerada como no cartão', () => {
    // Quando
    const lista = listaDoModelo(MODELO);
    // Então
    expect(numerados(arvoreDaLista(lista))).toEqual(NUMERADO);
    expect(arvoreDoChecklist(lista)).toEqual(MODELO);
    expect(arvoreDoChecklist(EXEMPLO)).toEqual(MODELO);
  });

  it('quando monta o plano para criar o checklist, então o grupo de cima vem antes dos de dentro, com a ordem de leitura', () => {
    // Quando
    const plano = planoDoChecklist(MODELO);
    // Então
    expect(plano.grupos).toEqual([
      { chave: 'g1', pai: null, nome: 'Documentos pessoais', ordem: 1 }, { chave: 'g2', pai: null, nome: 'Benefício', ordem: 4 },
      { chave: 'g3', pai: 'g2', nome: 'Aposentadoria por idade', ordem: 5 }, { chave: 'g4', pai: 'g2', nome: 'Auxílio-doença', ordem: 8 }]);
    expect(plano.itens.map(i => [i.pai, i.texto, i.ordem])).toEqual([['g1', 'RG', 2], ['g1', 'CPF', 3], ['g3', 'CNIS', 6], ['g3', 'Carteira de trabalho', 7],
      ['g4', 'Laudo médico', 9]]);
  });
});

describe('Colar uma lista (#309)', () => {
  it.each([
    ['a maioria numerada', '1. Documentos\n1.1 RG\n\n  2. Benefício  \nCNIS', true],
    ['sem números', 'RG\nCPF\n1. Procuração', false],
    ['uma linha só', '1. Procuração', false]
  ])('quando cola %s, então diz se oferece usar os números', (_caso, texto, numeradas) => {
    // Então
    expect(linhasColadas(texto).numeradas).toBe(numeradas);
  });

  it('quando cola, então as linhas vêm sem espaços nas pontas e sem as vazias', () => {
    // Então
    expect(linhasColadas(' RG \r\n\r\n CPF').linhas).toEqual(['RG', 'CPF']);
  });

  it('quando usa os números, então eles dizem o nível e saem do texto; quem tem linhas dentro vira grupo', () => {
    // Quando
    const { arvore, erro } = arvoreDasLinhas(['1. Documentos pessoais', '1.1 RG', '1.2 CPF', '2. Benefício', '2.1 Aposentadoria por idade', '2.1.1 CNIS',
      '2.1.2 Carteira de trabalho', '2.2 Auxílio-doença', '2.2.1 Laudo médico'], true);
    // Então
    expect(erro).toBe('');
    expect(arvore).toEqual(MODELO);
  });

  it('quando o número pula (3.1 sem 3.), então a linha entra na de nível menor mais próxima de cima; a sem número fica ao lado da anterior', () => {
    // Quando
    const { arvore } = arvoreDasLinhas(['1. Documentos', '1.1 RG', 'CPF', '3.1 CNIS'], true);
    // Então
    expect(arvore).toEqual([{ texto: 'Documentos', filhos: [{ texto: 'RG' }, { texto: 'CPF' }, { texto: 'CNIS' }] }]);
  });

  it('quando passa de 3 níveis, então dá o erro e nenhuma árvore', () => {
    // Então
    expect(arvoreDasLinhas(['1. A', '1.1 B', '1.1.1 C', '1.1.1.1 D'], true)).toEqual({ arvore: [], erro: 'A linha "1.1.1.1 D" passa de 3 níveis (como 2.1.1).' });
  });

  it('quando não usa os números, então cada linha é um item, com o texto como veio ("1.000 cópias" fica no texto)', () => {
    // Então
    expect(arvoreDasLinhas(['1.000 cópias', '2. Procuração'], false)).toEqual({ arvore: [{ texto: '1.000 cópias' }, { texto: '2. Procuração' }], erro: '' });
  });
});

describe('Acrescentar e tirar na tela (#309)', () => {
  it('quando três novos entram no fim de um grupo, então as posições ficam no vão, em ordem, sem renumerar', () => {
    // Quando: o grupo 1 termina no CPF (3) e o próximo é o Benefício (4)
    const onde = ondeEntramOsNovos(arvoreDaLista(EXEMPLO), 'g1', 3);
    // Então
    expect(onde).toEqual({ pai_id: 'g1', ordens: [3.25, 3.5, 3.75], renumerar: [] });
  });

  it('dado um vão pequeno demais, quando dois novos entram no grupo, então o checklist é renumerado com dois lugares', () => {
    // Dado
    const lista = { grupos: [grupo('g', 'G', null, 1)], itens: [item('a', 'A', 'g', 2), item('b', 'B', null, 2 + 1e-7)] };
    // Quando
    const onde = ondeEntramOsNovos(arvoreDaLista(lista), 'g', 2);
    // Então
    expect(onde).toEqual({ pai_id: 'g', ordens: [3, 4], renumerar: [{ id: 'b', tipo: 'item', pai_id: null, ordem: 5 }] });
  });

  it('dado o editor de modelos, quando uma árvore colada entra no fim do grupo 1, então o grupo novo vem antes do item de dentro dele, e o item, dentro dele', () => {
    // Dado
    let n = 0;
    // Quando
    const { lista } = comOsNovos(EXEMPLO, 'g1', [{ texto: 'Certidões', filhos: [{ texto: 'Nascimento' }] }, { texto: 'Foto' }], () => `novo${++n}`);
    // Então
    expect(lista.grupos.find(g => g.nome === 'Certidões')).toMatchObject({ id: 'novo1', pai_id: 'g1', ordem: 3.25 });
    expect(lista.itens.filter(i => i.id.startsWith('novo')).map(i => [i.texto, i.grupo_id, i.ordem]))
      .toEqual([['Nascimento', 'novo1', 3.5], ['Foto', 'g1', 3.75]]);
  });

  it('dado o editor de modelos, quando acrescenta um subgrupo com um item, então a árvore numera 1.3 e 1.3.1, e o grupo novo vem na resposta', () => {
    // Dado
    let n = 0;
    // Quando
    const { lista, grupos } = comOsNovos(EXEMPLO, 'g1', [{ texto: 'Certidões', filhos: [{ texto: 'Nascimento' }] }], () => `novo${++n}`);
    // Então
    expect(grupos).toEqual(['novo1']);
    expect(numerados(arvoreDaLista(lista)).slice(0, 5)).toEqual(['1. Documentos pessoais', '1.1 RG', '1.2 CPF', '1.3 Certidões', '1.3.1 Nascimento']);
  });

  it('quando uma árvore colada vai entrar no fim do grupo 1 de uma vez (#375), então cada nó tem a ordem dele, na leitura', () => {
    // Quando: Certidões, Nascimento (dentro dele) e Foto
    const onde = ondeEntraAArvore(arvoreDaLista(EXEMPLO), 'g1', [{ texto: 'Certidões', filhos: [{ texto: 'Nascimento' }] }, { texto: 'Foto' }]);
    // Então
    expect(onde).toEqual({ ordens: [3.25, 3.5, 3.75], renumerar: [] });
  });

  it('dado um vão pequeno demais no grupo, quando a árvore colada vai entrar nele, então vem junto o que renumerar antes', () => {
    // Dado
    const lista = { grupos: [grupo('g', 'G', null, 1)], itens: [item('a', 'A', 'g', 2), item('b', 'B', null, 2 + 1e-7)] };
    // Quando
    const onde = ondeEntraAArvore(arvoreDaLista(lista), 'g', [{ texto: 'C' }, { texto: 'D' }]);
    // Então
    expect(onde).toEqual({ ordens: [3, 4], renumerar: [{ id: 'b', tipo: 'item', pai_id: null, ordem: 5 }] });
  });

  it('quando o banco grava a árvore colada nas posições dadas, então ela entra no fim do grupo 2.1, numerada, e o grupo novo vem na resposta', () => {
    // Dado: o 2.1 termina na Carteira de trabalho (7) e o próximo é o Auxílio-doença (8)
    let n = 0;
    const nova = [{ texto: 'Vínculos', filhos: [] }, { texto: 'PPP' }];
    // Quando
    const { lista, grupos } = comAArvoreNova(EXEMPLO, 'g3', nova, ondeEntraAArvore(arvoreDaLista(EXEMPLO), 'g3', nova), () => `novo${++n}`);
    // Então
    expect(grupos).toEqual(['novo1']);
    expect(numerados(arvoreDaLista(lista)).slice(4, 9)).toEqual(['2.1 Aposentadoria por idade', '2.1.1 CNIS', '2.1.2 Carteira de trabalho', '2.1.3 Vínculos',
      '2.1.4 PPP']);
    expect(lista.itens.find(i => i.texto === 'PPP')).toMatchObject({ grupo_id: 'g3', ordem: 7 + 2 / 3 });
  });

  it('dado o que renumerar, quando o banco grava a árvore colada, então renumera antes e os novos ficam no vão aberto', () => {
    // Dado
    let n = 0;
    const lista = { grupos: [grupo('g', 'G', null, 1)], itens: [item('a', 'A', 'g', 2), item('b', 'B', null, 2 + 1e-7)] };
    const nova = [{ texto: 'C' }, { texto: 'D' }];
    // Quando
    const depois = comAArvoreNova(lista, 'g', nova, ondeEntraAArvore(arvoreDaLista(lista), 'g', nova), () => `novo${++n}`).lista;
    // Então
    expect(numerados(arvoreDaLista(depois))).toEqual(['1. G', '1.1 A', '1.2 C', '1.3 D', '2. B']);
    expect(segueALeitura(depois)).toBe(true);
  });

  it('quando aplica as posições de uma ação, então a árvore lida de novo mostra o que mudou', () => {
    // Dado
    const depois = arvoreDe(ACOES_DO_NO.descer.aplicar(arvoreDaLista(EXEMPLO), 'g1'));
    // Quando
    const lista = aplicarPosicoes(EXEMPLO, mudancasDePosicao(EXEMPLO, depois));
    // Então
    expect(numerados(arvoreDaLista(lista))[0]).toBe('1. Benefício');
    expect(acharNo(arvoreDaLista(lista), 'rg')?.numero).toBe('2.1');
  });

  it('quando tira o grupo Benefício, então saem os subgrupos e os itens de dentro, e o resto fica', () => {
    // Quando
    const lista = semOGrupo(EXEMPLO, 'g2');
    // Então
    expect(numerados(arvoreDaLista(lista))).toEqual(['1. Documentos pessoais', '1.1 RG', '1.2 CPF']);
  });

  it('quando pede os textos da tela, então dizem o tamanho do modelo, a exclusão do grupo, o caminho e o número novo', () => {
    // Dado
    const arvore = arvoreDaLista(EXEMPLO);
    // Então
    expect(tamanhoDoModelo(MODELO)).toBe('5 itens em 4 grupos');
    expect(tamanhoDoModelo([{ texto: 'A' }])).toBe('1 item');
    expect(textoDaExclusaoDoGrupo(acharNo(arvore, 'g2')!)).toBe('O grupo "2. Benefício", 2 subgrupos e 3 itens serão excluídos.');
    expect(textoDaExclusaoDoGrupo(acharNo(arvoreDaLista({ grupos: [grupo('v', 'Vazio', null, 1)], itens: [] }), 'v')!)).toBe('O grupo "1. Vazio" será excluído.');
    expect(descricaoDoNo(acharNo(arvore, 'rg')!)).toBe('1.1, no grupo 1. Documentos pessoais');
    expect(descricaoDoNo(acharNo(arvore, 'g1')!)).toBe('1.');
    expect(avisoDaPosicao(acharNo(arvore, 'rg')!)).toBe('"RG" agora é 1.1.');
    expect(avisoDaPosicao(acharNo(arvore, 'g2')!)).toBe('"Benefício" agora é 2.');
    expect([grupoDoNo(arvore, 'cnis'), grupoDoNo(arvore, 'g1')]).toEqual(['g3', null]);
  });
});

describe('Acrescentar uma lista colada dentro de um grupo (#309)', () => {
  const tresNiveis = arvoreDasLinhas(['1. A', '1.1 B', '1.1.1 C'], true).arvore;
  const doisNiveis = arvoreDasLinhas(['1. A', '1.1 B'], true).arvore;

  it('quando a lista colada tem 3 níveis e vai para o grupo 1. (1º nível), então é recusada, com o motivo', () => {
    // Quando
    const erro = erroAoAcrescentar(arvoreDaLista(EXEMPLO), 'g1', tresNiveis);
    // Então
    expect(erro).toBe(`${NIVEIS_DEMAIS} ${NAO_CABE_NO_GRUPO}`);
  });

  it('quando a lista colada tem 2 níveis e vai para o grupo 2.1 (2º nível), então é recusada; no grupo 1., cabe', () => {
    // Então
    expect(erroAoAcrescentar(arvoreDaLista(EXEMPLO), 'g3', doisNiveis)).toBe(`${NIVEIS_DEMAIS} ${NAO_CABE_NO_GRUPO}`);
    expect(erroAoAcrescentar(arvoreDaLista(EXEMPLO), 'g1', doisNiveis)).toBe('');
  });

  it('quando a lista colada tem 3 níveis e vai para o fim do checklist, então cabe; com só itens, cabe até no 2º nível', () => {
    // Então
    expect(erroAoAcrescentar(arvoreDaLista(EXEMPLO), null, tresNiveis)).toBe('');
    expect(erroAoAcrescentar(arvoreDaLista(EXEMPLO), 'g3', [{ texto: 'X' }, { texto: 'Y' }])).toBe('');
  });

  it('quando um grupo vazio vai para o 2º nível, então cabe; para dentro de um do 2º nível, não (grupo vai até o penúltimo)', () => {
    // Então
    expect(erroAoAcrescentar(arvoreDaLista(EXEMPLO), 'g1', [{ texto: 'Sub', filhos: [] }])).toBe('');
    expect(erroAoAcrescentar(arvoreDaLista(EXEMPLO), 'g3', [{ texto: 'Sub', filhos: [] }])).not.toBe('');
  });

  it('quando o grupo de destino já não existe, então é recusado com "o checklist mudou"', () => {
    // Então
    expect(erroAoAcrescentar(arvoreDaLista(EXEMPLO), 'sumiu', doisNiveis)).toBe(CHECKLIST_MUDOU);
  });
});

describe('O que está à vista com grupos fechados (#309)', () => {
  it('quando pede os grupos de cima do CNIS, então vêm o 2. e o 2.1, na ordem; do RG, o 1.; do grupo 1., nenhum', () => {
    // Dado
    const arvore = arvoreDaLista(EXEMPLO);
    // Então
    expect(gruposDeCima(arvore, 'cnis')).toEqual(['g2', 'g3']);
    expect(gruposDeCima(arvore, 'rg')).toEqual(['g1']);
    expect(gruposDeCima(arvore, 'g1')).toEqual([]);
  });

  it('dado o grupo 1. fechado, quando pede o nó à vista acima do grupo 2., então é o grupo 1. (e não o CPF, escondido)', () => {
    // Dado
    const arvore = arvoreDaLista(EXEMPLO), fechados = new Set(['g1']);
    // Então
    expect(noDeCima(arvore, 'g2')?.id).toBe('cpf');
    expect(noDeCimaNaTela(arvore, 'g2', fechados)?.id).toBe('g1');
    expect(emOrdemNaTela(arvore, fechados).map(n => n.id)).toEqual(['g1', 'g2', 'g3', 'cnis', 'ctps', 'g4', 'laudo']);
    expect(noDeCimaNaTela(arvore, 'g1', fechados)).toBeNull();
  });
});
