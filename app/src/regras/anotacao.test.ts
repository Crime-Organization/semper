// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { ITENS_DA_ANOTACAO, TAMANHO_ANOTACAO } from '../dados/limites';
import type { Anotacao, ItemParaLigar, Membro } from '../dados/tipos';
/** Um item escolhido para a anotação nova, com o nome que a tela mostra. */
type ItemComNome = ItemParaLigar & { nome: string };
import {
  ABRE_A_ANOTACAO, alteraAAnotacao, enderecoDoItem, excluiAAnotacao, ITEM_DA_ANOTACAO, itemDaAnotacao, ligaNaAnotacao, MODULOS_DA_ANOTACAO, modulosLigados,
  camposDaAnotacao, dadosDaAnotacao, dadosDaCopia, desdeDoPeriodo, gravaForaDaAnotacao, semSairDaAnotacao, errosDaAnotacao, NOME_DO_ITEM, PERIODOS_DA_ANOTACAO,
  SUFIXO_DA_COPIA, tituloDaCopia, veAAnotacao, comMaisUmItem, dadosDaEquipe, equipeDaAnotacao, erroDaEquipe, erroDoTexto, erroDoTitulo, ligacoesDaAnotacaoNova,
  edicaoPorSalvar, mencaoNegadaNaAnotacao, mesmoItem, motivoDaListaVazia, motivoSemMencaoNaAnotacao, motivoDeNaoLigarAAnotacao, QUEM_PASSA_A_LER, semOItem, type CamposAnotacao, type ChavesDaEquipe, type RascunhosDaAnotacao
} from './anotacao';

const anotacao = (campos: Partial<Anotacao> = {}): Anotacao => ({
  id: 'a1', codigo: 'ABC', titulo: 'Estratégia', texto: '', responsavel_id: 'u-ana', participantes: ['u-carla'], ligada_a: [], pasta_id: null, arquivado_em: null, arquivado_por: null,
  criado_por: 'u-dani', criado_em: '', atualizado_por: null, atualizado_em: '', ...campos
});
const membro = (id: string, papel: Membro['papel'] = 'usuario'): Pick<Membro, 'id' | 'papel'> => ({ id, papel });
const SEM_CHAVES: ChavesDaEquipe = { equipeVeTudo: false, equipeEditaTudo: false };

describe('Itens ligados a uma anotação', () => {
  it('quando se olha a tabela dos módulos, então todos os seis estão lá, cada um com o endereço do cartão e o parâmetro do cadastro', () => {
    // Então
    expect(MODULOS_DA_ANOTACAO).toEqual(['pessoas', 'processos', 'contratos', 'demandas', 'tarefas', 'compromissos']);
    expect(MODULOS_DA_ANOTACAO.map(m => ITEM_DA_ANOTACAO[m].parametro)).toEqual(['pessoa', 'processo', 'contrato', 'demanda', 'tarefa', 'compromisso']);
    expect(ITEM_DA_ANOTACAO.compromissos.endereco).toBe('/agenda/?id=');
  });

  it.each([
    ['pessoa', 'pessoas', { nome: 'JOSÉ' }, 'JOSÉ'],
    ['processo com número', 'processos', { numero: '0001', titulo: 'Inventário', cliente_nome: 'JOSÉ' }, '0001'],
    ['processo sem número', 'processos', { numero: '', titulo: 'Inventário', cliente_nome: 'JOSÉ' }, 'Inventário'],
    ['processo sem número nem título', 'processos', { numero: '', titulo: null, cliente_nome: 'JOSÉ; MARIA' }, 'JOSÉ e MARIA'],
    ['contrato', 'contratos', { servico: 'Registro de marca' }, 'Registro de marca'],
    ['demanda', 'demandas', { titulo: 'Contestação' }, 'Contestação'],
    ['tarefa', 'tarefas', { titulo: 'Emitir a GRU' }, 'Emitir a GRU'],
    ['compromisso com título', 'compromissos', { titulo: 'Reunião', tipo: 'reuniao', data: '2026-11-10' }, 'Reunião'],
    ['compromisso sem título', 'compromissos', { titulo: null, tipo: 'audiencia', data: '2026-11-10' }, 'Audiência · 10/11/2026']
  ] as const)('quando o item é %s, então o nome é o certo', (_caso, modulo, linha, nome) => {
    // Quando
    const dado = (NOME_DO_ITEM[modulo] as (x: typeof linha) => string)(linha);
    // Então
    expect(dado).toBe(nome);
  });

  it('dado um processo administrativo, quando se monta o item, então ele leva o tipo e abre na página dos administrativos', () => {
    // Dado
    const linha = { id: 'p1', codigo: 'P1', tipo: 'administrativo' as const, numero: '9123', titulo: null, cliente_nome: 'MARIA', arquivado_em: null };
    // Quando
    const item = itemDaAnotacao('processos', linha);
    // Então
    expect(item).toEqual({ modulo: 'processos', id: 'p1', codigo: 'P1', nome: '9123', arquivado_em: null, tipo: 'administrativo' });
    expect(enderecoDoItem(item)).toBe('/processos/administrativo/?id=p1');
  });

  it('dada uma demanda arquivada, quando se monta o item, então ele vem sem tipo, com a data do arquivo e o endereço da demanda', () => {
    // Quando
    const item = itemDaAnotacao('demandas', { id: 'd1', codigo: 'D1', titulo: 'Contestação', arquivado_em: '2026-11-01' });
    // Então
    expect(item).toEqual({ modulo: 'demandas', id: 'd1', codigo: 'D1', nome: 'Contestação', arquivado_em: '2026-11-01' });
    expect(enderecoDoItem(item)).toBe('/demandas/?id=d1');
  });

  it('quando os módulos ligados vêm repetidos e fora de ordem, então ficam em ordem alfabética e sem repetir, como o banco guarda', () => {
    // Então
    expect(modulosLigados(['tarefas', 'demandas', 'tarefas', 'compromissos'])).toEqual(['compromissos', 'demandas', 'tarefas']);
  });

  it('quando se pergunta que ligação abre a anotação, então só a pessoa não abre', () => {
    // Então
    expect(MODULOS_DA_ANOTACAO.filter(m => !ABRE_A_ANOTACAO[m])).toEqual(['pessoas']);
  });
});

describe('Quem vê e quem altera a anotação', () => {
  it.each([
    ['o master', membro('u-x', 'master'), true],
    ['um administrador', membro('u-x', 'admin'), true],
    ['quem criou', membro('u-dani'), true],
    ['o responsável', membro('u-ana'), true],
    ['um participante', membro('u-carla'), true],
    ['outro usuário', membro('u-bruno'), false]
  ] as const)('quando quem pergunta é %s, então alterar é %s', (_caso, m, pode) => {
    // Então
    expect(alteraAAnotacao(anotacao(), m, SEM_CHAVES)).toBe(pode);
    expect(veAAnotacao(anotacao(), m, SEM_CHAVES)).toBe(pode);
  });

  it('dado um usuário fora da anotação, quando ele vê um item ligado que a abre, então ele vê, mas não altera', () => {
    // Quando
    const ve = veAAnotacao(anotacao(), membro('u-bruno'), SEM_CHAVES, true);
    // Então
    expect(ve).toBe(true);
    expect(alteraAAnotacao(anotacao(), membro('u-bruno'), SEM_CHAVES)).toBe(false);
  });

  it('dada a chave "equipe_ve_tudo", quando um usuário de fora pergunta, então ele vê, mas não altera', () => {
    // Dado
    const chaves = { equipeVeTudo: true, equipeEditaTudo: false };
    // Então
    expect(veAAnotacao(anotacao(), membro('u-bruno'), chaves)).toBe(true);
    expect(alteraAAnotacao(anotacao(), membro('u-bruno'), chaves)).toBe(false);
  });

  it('dada a chave "equipe_edita_tudo", quando um usuário de fora pergunta, então ele vê e altera', () => {
    // Dado
    const chaves = { equipeVeTudo: false, equipeEditaTudo: true };
    // Então
    expect(veAAnotacao(anotacao(), membro('u-bruno'), chaves)).toBe(true);
    expect(alteraAAnotacao(anotacao(), membro('u-bruno'), chaves)).toBe(true);
  });

  it.each([
    ['o responsável', membro('u-ana'), SEM_CHAVES, null],
    ['um participante', membro('u-carla'), SEM_CHAVES, null],
    ['quem criou', membro('u-dani'), SEM_CHAVES, null],
    ['um administrador', membro('u-x', 'admin'), SEM_CHAVES, null],
    ['outro usuário', membro('u-bruno'), SEM_CHAVES, 'não participa; inclua como participante'],
    ['outro usuário, com "equipe_ve_tudo"', membro('u-bruno'), { equipeVeTudo: true, equipeEditaTudo: false }, null],
    ['outro usuário, com "equipe_edita_tudo"', membro('u-bruno'), { equipeVeTudo: false, equipeEditaTudo: true }, null]
  ] as const)('quando %s é mencionado num comentário da anotação, então o motivo para não poder é %s (#364)', (_caso, m, chaves, motivo) => {
    // Quando
    const r = motivoSemMencaoNaAnotacao(anotacao(), chaves)(m);
    // Então
    expect(r).toBe(motivo);
  });

  it('quando alguém que não está na anotação aparece num comentário dela, então a mensagem diz quem e o que fazer (a mesma do banco)', () => {
    // Então
    expect(mencaoNegadaNaAnotacao('Eli')).toBe('Não é possível mencionar Eli nesta anotação: inclua essa pessoa como participante antes.');
  });

  it('dada uma anotação arquivada, quando o responsável quer ligar um item, então não pode (mas pode alterar, para desarquivar)', () => {
    // Dado
    const a = anotacao({ arquivado_em: '2026-11-01' });
    // Então
    expect(ligaNaAnotacao(a, membro('u-ana'), SEM_CHAVES)).toBe(false);
    expect(alteraAAnotacao(a, membro('u-ana'), SEM_CHAVES)).toBe(true);
    expect(ligaNaAnotacao(anotacao(), membro('u-ana'), SEM_CHAVES)).toBe(true);
  });

  it.each([
    ['quem criou, arquivada', { arquivado_em: '2026-11-01' }, membro('u-dani'), true],
    ['um administrador, arquivada', { arquivado_em: '2026-11-01' }, membro('u-x', 'admin'), true],
    ['o responsável, arquivada', { arquivado_em: '2026-11-01' }, membro('u-ana'), false],
    ['quem criou, ativa', {}, membro('u-dani'), false]
  ] as const)('quando quem exclui é %s, então excluir é %s', (_caso, campos, m, pode) => {
    // Então
    expect(excluiAAnotacao(anotacao(campos), m)).toBe(pode);
  });
});

describe('Ligar, no cartão de um item, uma anotação que já existe (#341)', () => {
  it.each([
    [0, ''],
    [ITENS_DA_ANOTACAO - 1, ''],
    [ITENS_DA_ANOTACAO, `Já está ligada a ${ITENS_DA_ANOTACAO} itens, o máximo.`]
  ])('dada uma anotação ligada a %i itens, quando aparece na busca, então o motivo de não ligar é "%s"', (itens, motivo) => {
    // Dado / Quando / Então
    expect(motivoDeNaoLigarAAnotacao({ itens })).toBe(motivo);
  });

  it.each(MODULOS_DA_ANOTACAO)('dado o cartão de %s, então o aviso de quem passa a ler só aparece onde o item abre a anotação', modulo => {
    // Dado / Quando / Então: a pessoa não abre a anotação, e não há o que avisar; os outros avisam.
    expect(!!QUEM_PASSA_A_LER[modulo]).toBe(ABRE_A_ANOTACAO[modulo]);
  });
});

describe('O filtro "Data" da página Documentos', () => {
  it.each([
    ['qualquer data', '', undefined],
    ['os últimos 7 dias', 'semana', '2026-11-10'],
    ['os últimos 30 dias', 'mes', '2026-10-18'],
    ['os últimos 12 meses', 'ano', '2025-11-17']
  ] as const)('dado hoje 17/11/2026, quando o período é %s, então as anotações valem a partir de %s', (_caso, periodo, desde) => {
    // Dado / Quando / Então
    expect(desdeDoPeriodo(periodo, '2026-11-17')).toBe(desde);
  });

  it('dado o começo do mês ou do ano, quando o período volta, então a data passa para o mês ou o ano anterior', () => {
    // Dado / Quando / Então
    expect(desdeDoPeriodo('semana', '2026-03-03')).toBe('2026-02-24');
    expect(desdeDoPeriodo('mes', '2026-01-10')).toBe('2025-12-11');
  });

  it('então cada período tem o nome que aparece no filtro', () => {
    // Então
    expect(Object.values(PERIODOS_DA_ANOTACAO).map(p => p.rotulo)).toEqual(['Qualquer data', 'Últimos 7 dias', 'Últimos 30 dias', 'Últimos 12 meses']);
  });
});

describe('O cadastro de anotação', () => {
  const campos = (c: Partial<CamposAnotacao> = {}): CamposAnotacao => ({ titulo: 'Estratégia do caso', texto: '', responsavelId: 'u-ana', participantes: [], ...c });

  it('dado um cadastro com título e responsável, então não há erro', () => {
    // Dado / Quando / Então
    expect(errosDaAnotacao(campos())).toEqual({});
  });

  it('dado o título em branco, sem responsável e o texto grande demais, então cada campo diz o que falta', () => {
    // Dado
    const c = campos({ titulo: '   ', responsavelId: '', texto: 'x'.repeat(TAMANHO_ANOTACAO.texto + 1) });
    // Quando
    const erros = errosDaAnotacao(c);
    // Então
    expect(erros).toEqual({ titulo: 'Dê um título à anotação.', texto: 'O texto pode ter até 200.000 caracteres.', responsavelId: 'Escolha o responsável.' });
    expect(errosDaAnotacao(campos({ titulo: 'x'.repeat(TAMANHO_ANOTACAO.titulo + 1) })).titulo).toBe('O título pode ter até 300 caracteres.');
  });

  it('quando o cadastro grava, então o título perde os espaços das pontas e o responsável sai dos participantes', () => {
    // Dado
    const c = campos({ titulo: '  Estratégia  ', participantes: ['u-ana', 'u-bruno'] });
    // Quando / Então
    expect(dadosDaAnotacao(c)).toEqual({ titulo: 'Estratégia', texto: '', responsavel_id: 'u-ana', participantes: ['u-bruno'] });
  });

  it('dada uma anotação gravada, quando ela é editada, então os campos vêm dela', () => {
    // Dado / Quando / Então
    expect(camposDaAnotacao(anotacao({ texto: '# Plano' }))).toEqual({ titulo: 'Estratégia', texto: '# Plano', responsavelId: 'u-ana', participantes: ['u-carla'] });
  });
});

describe('Sair da anotação (#303, padrão da #276)', () => {
  const comum = { ehAdmin: false, escritorio: { modulos: {} } };
  const antes = { responsavel_id: 'u-ana', lista: ['u-bruno', 'u-carla'] };

  it('dado um participante que se tira e não pode gravar fora da anotação, quando grava, então esta gravação ainda o mantém, no mesmo lugar, e a saída vem depois', () => {
    // Quando
    const r = semSairDaAnotacao({ titulo: 'X', responsavel_id: 'u-ana', participantes: ['u-carla'] }, 'u-bruno', false, antes);
    // Então
    expect(r).toEqual({ dados: { titulo: 'X', responsavel_id: 'u-ana', participantes: ['u-bruno', 'u-carla'] }, ficou: true });
  });

  it('dado o responsável que passa a anotação a outra pessoa, quando grava, então fica como participante até sair', () => {
    // Quando
    const r = semSairDaAnotacao({ responsavel_id: 'u-carla', participantes: [] }, 'u-ana', false, antes);
    // Então
    expect(r).toEqual({ dados: { responsavel_id: 'u-carla', participantes: ['u-ana'] }, ficou: true });
  });

  it.each([
    ['continua na anotação', ['u-bruno'], false],
    ['pode gravar fora dela', [], true]
  ] as const)('dado quem %s, quando grava, então nada muda', (_caso, participantes, podeSair) => {
    // Dado
    const d = { responsavel_id: 'u-ana', participantes: [...participantes] };
    // Então
    expect(semSairDaAnotacao(d, 'u-bruno', podeSair, antes)).toEqual({ dados: d, ficou: false });
  });

  it.each([
    ['um administrador', { ...comum, ehAdmin: true }, false, true],
    ['quem a criou', comum, true, true],
    ['a equipe, com a chave de ver tudo (a leitura das anotações abre com ela)', { ehAdmin: false, escritorio: { modulos: { equipe_ve_tudo: true } } }, false, true],
    ['a equipe, na fase de adaptação', { ehAdmin: false, escritorio: { modulos: { equipe_edita_tudo: true } } }, false, true],
    ['um usuário comum, sem as chaves', comum, false, false]
  ] as const)('dado %s, quando confere se grava fora da anotação, então dá %s', (_caso, ctx, criou, esperado) => {
    // Então
    expect(gravaForaDaAnotacao(ctx, criou)).toBe(esperado);
  });
});

describe('A cópia da anotação (#343)', () => {
  const equipe = [{ id: 'u-ana' }, { id: 'u-bruno', ativo: true }, { id: 'u-carla' }, { id: 'u-dani' }, { id: 'u-desativado', ativo: false },
    { id: 'u-excluido', excluido: true }];
  const quem = (id: string, alteraAOriginal: boolean) => ({ id, alteraAOriginal, equipe });

  it('dado um título curto, quando duplica, então a cópia tem "(cópia)" no fim', () => {
    // Dado / Quando / Então
    expect(tituloDaCopia('  Estratégia do caso  ')).toBe('Estratégia do caso (cópia)');
  });

  it('dado um título no tamanho máximo, quando duplica, então a original é cortada antes do sufixo e a cópia cabe no banco', () => {
    // Dado
    const titulo = 'x'.repeat(TAMANHO_ANOTACAO.titulo);
    // Quando
    const copia = tituloDaCopia(titulo);
    // Então
    expect(copia).toHaveLength(TAMANHO_ANOTACAO.titulo);
    expect(copia).toBe('x'.repeat(TAMANHO_ANOTACAO.titulo - SUFIXO_DA_COPIA.length) + SUFIXO_DA_COPIA);
  });

  it('dado um título longo com espaço ou emoji bem no corte, quando duplica, então nem o espaço nem meio emoji ficam antes do sufixo', () => {
    // Dado
    const corte = TAMANHO_ANOTACAO.titulo - SUFIXO_DA_COPIA.length;
    const comEspaco = 'x'.repeat(corte - 1) + ' resto';
    const comEmoji = 'x'.repeat(corte - 1) + '😀 resto';   // o emoji ocupa duas posições: só a primeira caberia
    // Quando / Então
    expect(tituloDaCopia(comEspaco)).toBe('x'.repeat(corte - 1) + SUFIXO_DA_COPIA);
    expect(tituloDaCopia(comEmoji)).toBe('x'.repeat(corte - 1) + SUFIXO_DA_COPIA);
  });

  it('dado um título longo com bandeira ou emoji de família bem no corte, quando duplica, então nenhum pedaço deles fica antes do sufixo', () => {
    // Dado
    const corte = TAMANHO_ANOTACAO.titulo - SUFIXO_DA_COPIA.length;
    const comBandeira = 'x'.repeat(corte - 2) + '🇧🇷 resto';   // a bandeira são duas letras regionais (quatro posições): só a primeira caberia
    const comFamilia = 'x'.repeat(corte - 3) + '👨‍👩‍👧 resto';   // o homem e o ZWJ que o junta ao resto caberiam
    const comTom = 'x'.repeat(corte - 2) + '👍🏽 resto';   // a mão caberia, sem o tom de pele
    // Quando / Então
    expect(tituloDaCopia(comBandeira)).toBe('x'.repeat(corte - 2) + SUFIXO_DA_COPIA);
    expect(tituloDaCopia(comFamilia)).toBe('x'.repeat(corte - 3) + SUFIXO_DA_COPIA);
    expect(tituloDaCopia(comTom)).toBe('x'.repeat(corte - 2) + SUFIXO_DA_COPIA);
  });

  it('dado um título longo com bandeira inteira antes do corte, quando duplica, então a bandeira fica', () => {
    // Dado
    const corte = TAMANHO_ANOTACAO.titulo - SUFIXO_DA_COPIA.length;
    const titulo = 'x'.repeat(corte - 4) + '🇧🇷 resto';
    // Quando / Então
    expect(tituloDaCopia(titulo)).toBe('x'.repeat(corte - 4) + '🇧🇷' + SUFIXO_DA_COPIA);
  });

  it('dado quem altera a original, quando duplica, então a cópia leva o mesmo texto, o mesmo responsável e os mesmos participantes', () => {
    // Dado
    const a = anotacao({ texto: '# Plano', participantes: ['u-carla', 'u-dani'] });
    // Quando / Então
    expect(dadosDaCopia(a, quem('u-dani', true))).toEqual({ titulo: 'Estratégia (cópia)', texto: '# Plano', responsavel_id: 'u-ana', participantes: ['u-carla', 'u-dani'], pasta_id: null });
  });

  it('dada uma anotação numa pasta, quando alguém a duplica, então a cópia fica na mesma pasta (#342)', () => {
    // Dado
    const a = anotacao({ pasta_id: 'p-pops' });
    // Quando / Então
    expect(dadosDaCopia(a, quem('u-dani', true)).pasta_id).toBe('p-pops');
    expect(dadosDaCopia(a, quem('u-bruno', false)).pasta_id).toBe('p-pops');
  });

  it('dado quem só lê a original, quando duplica, então ela é a responsável da cópia, e os participantes continuam', () => {
    // Dado
    const a = anotacao({ participantes: ['u-carla', 'u-bruno'] });
    // Quando / Então
    expect(dadosDaCopia(a, quem('u-bruno', false))).toMatchObject({ responsavel_id: 'u-bruno', participantes: ['u-carla'] });
  });

  it('dado um responsável e um participante que saíram da equipe, quando duplica, então quem copia fica responsável e o participante fica de fora', () => {
    // Dado
    const a = anotacao({ responsavel_id: 'u-saiu', participantes: ['u-carla', 'u-saiu-tambem'] });
    // Quando / Então
    expect(dadosDaCopia(a, quem('u-dani', true))).toMatchObject({ responsavel_id: 'u-dani', participantes: ['u-carla'] });
  });

  it('dado um responsável desativado e um participante excluído da equipe, quando duplica, então nenhum dos dois vai para a cópia', () => {
    // Dado
    const a = anotacao({ responsavel_id: 'u-desativado', participantes: ['u-excluido', 'u-carla', 'u-desativado'] });
    // Quando / Então
    expect(dadosDaCopia(a, quem('u-dani', true))).toMatchObject({ responsavel_id: 'u-dani', participantes: ['u-carla'] });
  });

  it('dado um participante desativado e um responsável excluído, quando quem altera duplica, então quem copia fica responsável e o desativado fica de fora', () => {
    // Dado
    const a = anotacao({ responsavel_id: 'u-excluido', participantes: ['u-desativado', 'u-bruno'] });
    // Quando / Então
    expect(dadosDaCopia(a, quem('u-ana', true))).toMatchObject({ responsavel_id: 'u-ana', participantes: ['u-bruno'] });
  });
});

describe('O título e o texto editados no próprio lugar (#339)', () => {
  it.each([
    ['um título comum', 'Estratégia', ''],
    ['o título só com espaços', '   ', 'Dê um título à anotação.'],
    ['o título no tamanho máximo', 'x'.repeat(TAMANHO_ANOTACAO.titulo), ''],
    ['o título maior que o máximo', 'x'.repeat(TAMANHO_ANOTACAO.titulo + 1), 'O título pode ter até 300 caracteres.']
  ])('dado %s, quando a pessoa salva o título, então o erro é "%s"', (_caso, titulo, erro) => {
    // Quando / Então
    expect(erroDoTitulo(titulo)).toBe(erro);
  });

  it.each([
    ['o texto vazio', '', ''],
    ['o texto no tamanho máximo', 'x'.repeat(TAMANHO_ANOTACAO.texto), ''],
    ['o texto maior que o máximo', 'x'.repeat(TAMANHO_ANOTACAO.texto + 1), 'O texto pode ter até 200.000 caracteres.']
  ])('dado %s, quando a pessoa salva o texto, então o erro é "%s"', (_caso, texto, erro) => {
    // Quando / Então
    expect(erroDoTexto(texto)).toBe(erro);
  });
});

describe('A equipe da anotação, pelo lápis do cartão (#339)', () => {
  it('dada uma anotação gravada, quando o lápis abre, então os campos são só o responsável e os participantes', () => {
    // Dado / Quando / Então
    expect(equipeDaAnotacao(anotacao())).toEqual({ responsavelId: 'u-ana', participantes: ['u-carla'] });
  });

  it('quando a equipe é gravada, então vão só o responsável e os participantes, sem ele, e nunca o título e o texto', () => {
    // Dado / Quando
    const dados = dadosDaEquipe({ responsavelId: 'u-bruno', participantes: ['u-bruno', 'u-carla'] });
    // Então
    expect(dados).toEqual({ responsavel_id: 'u-bruno', participantes: ['u-carla'] });
  });

  it('dado o responsável em branco, então a equipe pede que ele seja escolhido', () => {
    // Dado / Quando / Então
    expect(erroDaEquipe({ responsavelId: '', participantes: [] })).toBe('Escolha o responsável.');
    expect(erroDaEquipe({ responsavelId: 'u-ana', participantes: [] })).toBe('');
  });
});

describe('Os itens escolhidos antes de salvar a anotação nova (#339)', () => {
  const demanda: ItemComNome = { modulo: 'demandas', id: 'd1', nome: 'Registro de marca' };
  const pessoa: ItemComNome = { modulo: 'pessoas', id: 'p1', nome: 'JOSÉ' };

  it('quando a pessoa escolhe dois itens, então eles ficam na ordem da escolha', () => {
    // Quando
    const lista = comMaisUmItem(comMaisUmItem([], demanda), pessoa);
    // Então
    expect(lista).toEqual([demanda, pessoa]);
  });

  it('dado um item já escolhido, quando a pessoa o escolhe de novo, então ele não se repete', () => {
    // Dado
    const lista = [demanda];
    // Quando / Então
    expect(comMaisUmItem(lista, { ...demanda })).toBe(lista);
  });

  it('dada a lista no máximo de itens do banco, quando a pessoa escolhe mais um, então ele não entra', () => {
    // Dado
    const cheia = Array.from({ length: ITENS_DA_ANOTACAO }, (_, i): ItemParaLigar => ({ modulo: 'pessoas', id: 'p' + i }));
    // Quando / Então
    expect(comMaisUmItem(cheia, { modulo: 'demandas', id: 'd1' })).toHaveLength(ITENS_DA_ANOTACAO);
  });

  it('dados dois itens escolhidos, quando a pessoa tira um, então fica só o outro', () => {
    // Dado / Quando / Então
    expect(semOItem([demanda, pessoa], { modulo: 'demandas', id: 'd1' })).toEqual([pessoa]);
    expect(mesmoItem(demanda, { modulo: 'pessoas', id: 'd1' })).toBe(false);
  });

  it('quando a anotação nova é salva, então vão para o banco só o módulo e o id de cada item, na ordem', () => {
    // Dado / Quando / Então
    expect(ligacoesDaAnotacaoNova([pessoa, demanda])).toEqual([{ modulo: 'pessoas', id: 'p1' }, { modulo: 'demandas', id: 'd1' }]);
  });
});

describe('A edição por salvar no cartão da anotação (#339)', () => {
  const a = anotacao({ titulo: 'Estratégia', texto: 'Plano', responsavel_id: 'u-ana', participantes: ['u-carla'] });

  it.each<[string, RascunhosDaAnotacao, boolean]>([
    ['nada aberto', {}, false],
    ['o título aberto e igual', { titulo: 'Estratégia', texto: null }, false],
    ['o título aberto só com espaços a mais nas pontas', { titulo: '  Estratégia ' }, false],
    ['o título mudado', { titulo: 'Estratégia nova' }, true],
    ['o texto aberto e igual', { texto: 'Plano' }, false],
    ['o texto mudado', { texto: 'Plano B' }, true],
    ['a equipe aberta e igual', { equipe: { responsavelId: 'u-ana', participantes: ['u-carla'] } }, false],
    ['a equipe com o responsável repetido entre os participantes', { equipe: { responsavelId: 'u-ana', participantes: ['u-carla', 'u-ana'] } }, false],
    ['a equipe com mais alguém', { equipe: { responsavelId: 'u-ana', participantes: ['u-carla', 'u-bruno'] } }, true]
  ])('dado %s, então a edição por salvar é %s', (_caso, rascunhos, esperado) => {
    // Quando / Então
    expect(edicaoPorSalvar(a, rascunhos)).toBe(esperado);
  });
});

describe('Lista de documentos vazia', () => {
  const nada = { filtrada: false, arquivadas: false, pasta: false };
  it.each([
    ['com filtros, mesmo nas arquivadas e numa pasta', 'filtrada', { filtrada: true, arquivadas: true, pasta: true }],
    ['nas arquivadas, mesmo numa pasta', 'arquivadas', { ...nada, arquivadas: true, pasta: true }],
    ['numa pasta', 'pasta', { ...nada, pasta: true }],
    ['sem filtros nem pasta', 'nenhuma', nada]
  ] as const)('dada a lista vazia %s, então o motivo é "%s"', (_caso, motivo, situacao) => {
    // Quando / Então
    expect(motivoDaListaVazia(situacao)).toBe(motivo);
  });
});
