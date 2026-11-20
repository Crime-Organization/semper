// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Os nomes são inventados.
import { describe, expect, it } from 'vitest';
import { GRUPOS_POR_ITEM } from '../dados/limites';
import type { GrupoDaEquipe, Membro } from '../dados/tipos';
import {
  avisoDaExclusao, candidatosDeGrupo, dicaDosIntegrantes, estaPeloGrupo, filtroQueVale, FILTRO_DOS_MEUS_GRUPOS, gruposDoFiltro, INTEGRANTES_NA_DICA,
  integrantesAtivos, itensPorModulo, meusGrupos, textoDoGrupo, AVISO_DOS_GRUPOS, desfazerNosGrupos, dicaDaPilula, gruposDoItem, GRUPOS_DEMAIS, linhaDosGruposNoLapis,
  maisGrupos, MUDANCAS_NOS_GRUPOS, corpoDaExclusao, linksDoGrupo, ondeOGrupoEsta, quantasPessoas, rotuloDoGrupoNoQuadro, textoDaMensagemDeGrupo, tituloDaExclusao, nomeDoGrupo, notaDaContagem, notaDeQuemEstaPeloGrupo, notaDoGrupoNoTopo, saiComOGrupo, soPeloGrupo, type QuemEstaNoCartao
} from './gruposDaEquipe';

const membro = (id: string, nome: string, extra: Partial<Membro> = {}): Membro => ({ id, nome, ativo: true, ...extra });
const equipe = [membro('u1', 'Ana Exemplo'), membro('u2', 'Beto Teste'), membro('u3', 'Caio Fictício'), membro('u4', 'Davi Desativado', { ativo: false }),
  membro('u5', 'Gil Reservado', { reservada: true }), membro('u6', 'Ivo Excluído', { excluido: true })];
const grupo = (id: string, nome: string, integrantes: string[]): GrupoDaEquipe => ({ id, nome, integrantes });
const nucleoA = grupo('ga', 'Núcleo A', ['u1', 'u2']), nucleoB = grupo('gb', 'Núcleo Bê', ['u2', 'u3', 'u4']);

describe('Grupos da equipe (#378)', () => {
  it('dada uma pessoa em dois grupos, quando se pergunta pelos grupos dela, então vêm os dois; quem não está em nenhum, nenhum', () => {
    // Então
    expect(meusGrupos([nucleoA, nucleoB], 'u2')).toEqual(['ga', 'gb']);
    expect(meusGrupos([nucleoA, nucleoB], 'u9')).toEqual([]);
    expect(meusGrupos(undefined, 'u2')).toEqual([]);
  });

  it.each([
    [['ga'], ['ga', 'gb'], true],
    [['gc'], ['ga'], false],
    [[], ['ga'], false],
    [undefined, ['ga'], false],
    [['ga'], [], false]
  ] as const)('dado o item com %j e a pessoa nos grupos %j, então ela está pelo grupo: %s', (doItem, meus, esperado) => {
    // Então
    expect(estaPeloGrupo(doItem, meus)).toBe(esperado);
  });

  it('dado um grupo com um desativado, uma conta reservada e um excluído, então só os ativos participam e contam', () => {
    // Dado
    const todos = grupo('gt', 'Núcleo Todos', ['u1', 'u4', 'u5', 'u6']);
    // Então
    expect(integrantesAtivos(todos, equipe).map(m => m.id)).toEqual(['u1']);
    expect(textoDoGrupo(todos, equipe)).toBe('Núcleo Todos · 1 pessoa');
    expect(textoDoGrupo(nucleoB, equipe)).toBe('Núcleo Bê · 2 pessoas');
  });

  it('dado um grupo, quando se mostra a dica, então ela traz os nomes em ordem e por extenso', () => {
    // Então
    expect(dicaDosIntegrantes(nucleoB, equipe)).toBe('Núcleo Bê · 2 pessoas: Beto Teste e Caio Fictício');
    expect(dicaDosIntegrantes(grupo('gv', 'Núcleo Vazio', []), equipe)).toBe('Núcleo Vazio · ninguém ainda');
  });

  it('dado um grupo com mais pessoas do que cabem na dica, então ela mostra as primeiras e "e mais N"', () => {
    // Dado
    const muitos = Array.from({ length: INTEGRANTES_NA_DICA + 16 }, (_, i) => membro(`m${String(i).padStart(2, '0')}`, `Pessoa ${String(i).padStart(2, '0')}`));
    const grande = grupo('gg', 'Núcleo Grande', muitos.map(m => m.id));
    // Quando
    const dica = dicaDosIntegrantes(grande, muitos);
    // Então
    expect(dica).toBe(`Núcleo Grande · ${muitos.length} pessoas: Pessoa 00, Pessoa 01, Pessoa 02, Pessoa 03, Pessoa 04 e mais 16`);
  });

  it('dado um termo sem acento, quando se buscam grupos para pôr no item, então vêm os que combinam e ainda não estão nele', () => {
    // Então
    expect(candidatosDeGrupo([nucleoA, nucleoB], 'nucleo', ['ga']).map(g => g.id)).toEqual(['gb']);
    expect(candidatosDeGrupo([nucleoA, nucleoB], 'BÊ', []).map(g => g.id)).toEqual(['gb']);
    expect(candidatosDeGrupo([nucleoA, nucleoB], '', []).map(g => g.id)).toEqual(['ga', 'gb']);
    expect(candidatosDeGrupo(undefined, '', [])).toEqual([]);
  });

  it('dado um item com o máximo de grupos, então nenhum grupo mais é oferecido', () => {
    // Dado
    const cheio = Array.from({ length: GRUPOS_POR_ITEM }, (_, i) => `g${i}`);
    // Então
    expect(candidatosDeGrupo([nucleoA], '', cheio)).toEqual([]);
  });

  it('dado o filtro "Grupo da equipe", então ele vira os ids dos grupos; vazio, nenhum filtro', () => {
    // Então
    expect(gruposDoFiltro(FILTRO_DOS_MEUS_GRUPOS, ['ga', 'gb'])).toEqual(['ga', 'gb']);
    expect(gruposDoFiltro('gb', ['ga'])).toEqual(['gb']);
    expect(gruposDoFiltro(undefined, ['ga'])).toBeNull();
    expect(gruposDoFiltro('', ['ga'])).toBeNull();
  });

  it('dado um filtro guardado de um grupo que não existe mais, então ele volta a "Todos os grupos"', () => {
    // Então
    expect(filtroQueVale('gx', [nucleoA])).toBeUndefined();
    expect(filtroQueVale('ga', [nucleoA])).toBe('ga');
    expect(filtroQueVale(FILTRO_DOS_MEUS_GRUPOS, [])).toBe(FILTRO_DOS_MEUS_GRUPOS);
    expect(filtroQueVale(undefined, [nucleoA])).toBeUndefined();
  });

  it('dada a contagem dos itens do grupo, então ela é dita em português, no singular e no plural', () => {
    // Então
    expect(itensPorModulo([{ modulo: 'demandas', quantos: 5 }, { modulo: 'tarefas', quantos: 7 }])).toBe('5 demandas e 7 tarefas');
    expect(itensPorModulo([{ modulo: 'processos', quantos: 1 }, { modulo: 'anotacoes', quantos: 2 }, { modulo: 'contratos', quantos: 1 }]))
      .toBe('1 processo, 2 documentos e 1 contrato');
  });

  it('dado um grupo em 12 itens, quando se vai excluí-lo, então o aviso diz quantos, em quais módulos, e que não dá para desfazer', () => {
    // Então
    expect(avisoDaExclusao('Núcleo A', [{ modulo: 'demandas', quantos: 5 }, { modulo: 'tarefas', quantos: 7 }])).toBe(
      'Excluir o grupo Núcleo A? Ele está em 12 itens, contando os arquivados (5 demandas e 7 tarefas). Quem participa só pelo grupo deixa de ver esses itens. '
      + 'As pessoas continuam na equipe. Não dá para desfazer.');
    expect(avisoDaExclusao('Núcleo A', [{ modulo: 'compromissos', quantos: 1 }])).toContain('Ele está em 1 item, contando os arquivados (1 compromisso). Quem participa só pelo grupo deixa de ver esse item.');
    expect(avisoDaExclusao('Núcleo A', [])).toBe('Excluir o grupo Núcleo A? Ele não está em nenhum item. As pessoas continuam na equipe. Não dá para desfazer.');
  });
});

describe('Grupos da equipe na tela (#378)', () => {
  it('dado o item com um grupo que já foi excluído, quando a tela pede os grupos dele, então vêm só os que existem, na ordem do item', () => {
    // Então
    expect(gruposDoItem([nucleoA, nucleoB], ['gb', 'gx', 'ga']).map(g => g.id)).toEqual(['gb', 'ga']);
    expect(gruposDoItem(undefined, ['ga'])).toEqual([]);
    expect(gruposDoItem([nucleoA], undefined)).toEqual([]);
  });

  it('dado um grupo com um desativado, quando a pílula se apresenta, então conta só os ativos e marca o grupo de quem está logado', () => {
    // Então
    expect(nomeDoGrupo(nucleoB, equipe)).toBe('Grupo Núcleo Bê, 2 pessoas');
    expect(nomeDoGrupo(grupo('gc', 'Só Um', ['u1']), equipe)).toBe('Grupo Só Um, 1 pessoa');
    expect(dicaDaPilula(nucleoA, equipe, 'u1')).toBe('Núcleo A · 2 pessoas: Ana Exemplo e Beto Teste. Você está neste grupo');
    expect(dicaDaPilula(nucleoA, equipe, 'u3')).toBe('Núcleo A · 2 pessoas: Ana Exemplo e Beto Teste');
    expect(maisGrupos(1)).toBe('+1 grupo');
    expect(maisGrupos(7)).toBe('+7 grupos');
  });

  it('dados os grupos do item, quando se põe e se tira um grupo, então grava a lista nova; repetido, ausente e cheio dão o aviso', () => {
    // Então
    expect(MUDANCAS_NOS_GRUPOS.porGrupo(['ga'], { id: 'gb', nome: 'Núcleo Bê' }, 'na demanda')).toEqual({ gravar: ['ga', 'gb'] });
    expect(MUDANCAS_NOS_GRUPOS.porGrupo(['ga'], { id: 'ga', nome: 'Núcleo A' }, 'na demanda')).toEqual({ aviso: 'O grupo Núcleo A já estava na demanda.', tipo: 'info' });
    const cheio = Array.from({ length: GRUPOS_POR_ITEM }, (_, i) => 'g' + i);
    expect(MUDANCAS_NOS_GRUPOS.porGrupo(cheio, { id: 'gz', nome: 'Z' }, 'na demanda')).toEqual({ aviso: GRUPOS_DEMAIS, tipo: 'erro' });
    expect(MUDANCAS_NOS_GRUPOS.tirarGrupo(['ga', 'gb'], { id: 'ga', nome: 'Núcleo A' }, 'na tarefa')).toEqual({ gravar: ['gb'] });
    expect(MUDANCAS_NOS_GRUPOS.tirarGrupo(['gb'], { id: 'ga', nome: 'Núcleo A' }, 'na tarefa')).toEqual({ aviso: 'O grupo Núcleo A já não estava na tarefa.', tipo: 'info' });
    expect(AVISO_DOS_GRUPOS.porGrupo('Núcleo A', 'na demanda', 'da demanda')).toBe('Grupo Núcleo A posto na demanda.');
    expect(AVISO_DOS_GRUPOS.tirarGrupo('Núcleo A', 'na demanda', 'da demanda')).toBe('Grupo Núcleo A tirado da demanda.');
  });

  it('dada uma mudança nos grupos, quando se desfaz sobre os grupos lidos de novo, então volta só o que ela fez', () => {
    // Então
    expect(desfazerNosGrupos('porGrupo', ['ga', 'gb'], 'gb')).toEqual(['ga']);
    expect(desfazerNosGrupos('porGrupo', ['ga'], 'gb')).toBeNull();
    expect(desfazerNosGrupos('tirarGrupo', ['gb'], 'ga')).toEqual(['gb', 'ga']);
    expect(desfazerNosGrupos('tirarGrupo', ['ga'], 'ga')).toBeNull();
    expect(desfazerNosGrupos('tirarGrupo', Array.from({ length: GRUPOS_POR_ITEM }, (_, i) => 'g' + i), 'ga')).toEqual({ aviso: GRUPOS_DEMAIS });
  });

  const quem = (extra: Partial<QuemEstaNoCartao> = {}): QuemEstaNoCartao =>
    ({ eu: 'u2', responsavel_id: 'u1', lista: [], grupos: ['ga'], meus: ['ga', 'gb'], podeSair: false, ...extra });
  it.each([
    ['só pelo grupo', quem(), true],
    ['também por outro grupo do item', quem({ grupos: ['ga', 'gb'] }), false],
    ['também na lista', quem({ lista: ['u2'] }), false],
    ['como responsável', quem({ responsavel_id: 'u2' }), false],
    ['podendo gravar fora do cartão', quem({ podeSair: true }), false],
    ['também pelo item ligado', quem({ peloLigado: true }), false],
    ['sem estar no grupo tirado', quem({ meus: ['gb'] }), false]
  ] as const)('dada a pessoa no cartão %s, quando quer tirar o grupo Núcleo A, então sairia do cartão (e não pode): %s', (_caso, q, sai) => {
    // Então
    expect(saiComOGrupo(q, 'ga')).toBe(sai);
  });

  it('dada a pessoa que não está na lista nem é responsável, quando está num grupo do item, então ela está só por ele, com a nota', () => {
    // Então
    expect(soPeloGrupo({ eu: 'u2', responsavel_id: 'u1', lista: [], meus: ['gb'] }, [nucleoA, nucleoB])?.nome).toBe('Núcleo Bê');
    expect(soPeloGrupo({ eu: 'u2', responsavel_id: 'u1', lista: ['u2'], meus: ['gb'] }, [nucleoB])).toBeNull();
    expect(soPeloGrupo({ eu: 'u2', responsavel_id: 'u1', lista: [], meus: [] }, [nucleoB])).toBeNull();
    expect(notaDeQuemEstaPeloGrupo('Núcleo A')).toBe('Você participa deste cartão pelo grupo Núcleo A. Para sair, peça a um administrador.');
  });

  it.each([
    ['só pelo grupo, sem gravar fora do cartão', {}, 'Você participa deste cartão pelo grupo Núcleo Bê. Para sair, peça a um administrador.'],
    ['podendo gravar fora do cartão (administradora, quem criou)', { podeSair: true }, null],
    ['também pelo item ligado', { peloLigado: true }, null],
    ['também na lista do cartão', { lista: ['u2'] }, null]
  ] as const)('dada a pessoa no cartão %s, quando abre a pílula do grupo dela, então a nota é: %s', (_caso, muda, nota) => {
    // Dado
    const q = { eu: 'u2', responsavel_id: 'u1', lista: [] as readonly string[], meus: ['gb'], podeSair: false, ...muda };
    // Então
    expect(notaDoGrupoNoTopo(q, nucleoB, [nucleoB])).toBe(nota);
    expect(notaDoGrupoNoTopo({ ...q, meus: [] }, nucleoA, [nucleoA])).toBeNull();
  });

  it('dado o lápis de um item, quando ele tem grupos, então a linha diz quais; sem grupos, não há linha', () => {
    // Então
    expect(linhaDosGruposNoLapis(['Núcleo A', 'Núcleo Bê'])).toBe('Grupos: Núcleo A e Núcleo Bê (mude no topo do cartão)');
    expect(linhaDosGruposNoLapis([])).toBeNull();
  });
});

describe('Grupos da equipe: textos da tela (#378)', () => {
  it('dada a contagem dos itens, quando a tela pergunta antes de excluir, então o título e o corpo vêm separados, para a janela', () => {
    // Então
    expect(tituloDaExclusao('Núcleo A')).toBe('Excluir o grupo Núcleo A?');
    expect(corpoDaExclusao('Núcleo A', [{ modulo: 'anotacoes', quantos: 2 }])).toBe(
      'Ele está em 2 itens, contando os arquivados (2 documentos). Quem participa só pelo grupo deixa de ver esses itens. As pessoas continuam na equipe. Não dá para desfazer.');
    expect(ondeOGrupoEsta([{ modulo: 'demandas', quantos: 5 }, { modulo: 'tarefas', quantos: 1 }])).toBe('5 demandas e 1 tarefa');
    expect(ondeOGrupoEsta([])).toBe('Nenhum item');
    expect(notaDaContagem([{ modulo: 'tarefas', quantos: 2 }])).toBe('2 tarefas, contando os arquivados.');
    expect(notaDaContagem(null)).toBe('Contando os itens…');
    expect(notaDaContagem('falhou')).toBe('Não foi possível contar os itens.');
  });

  it('dado um grupo, quando a tela fala dele, então conta as pessoas e diz quem está para o leitor de tela', () => {
    // Então
    expect(quantasPessoas(1)).toBe('1 pessoa');
    expect(quantasPessoas(0)).toBe('0 pessoas');
    expect(rotuloDoGrupoNoQuadro(nucleoA, equipe)).toBe('Grupo Núcleo A · 2 pessoas: Ana Exemplo e Beto Teste');
  });

  it('dada a pessoa posta num grupo, quando a caixa mostra a mensagem, então há o texto sem número e os dois links filtrados no grupo', () => {
    // Então
    expect(textoDaMensagemDeGrupo('Ana Exemplo', 'Núcleo A')).toEqual({ titulo: 'Ana Exemplo incluiu você no grupo Núcleo A.', trecho: 'Você passa a participar dos itens dele.' });
    expect(linksDoGrupo('ga')).toEqual([
      { texto: 'Ver as demandas do grupo', para: '/demandas/?grupo=ga' },
      { texto: 'Ver as tarefas do grupo', para: '/tarefas/?grupo=ga' }
    ]);
  });
});
