// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { BUSCA_GERAL_POR_MODULO } from '../dados/limites';
import type { PessoaLista, ProcessoLista, TarefaLista } from '../dados/tipos';
import { DIA } from '../ui/tempos';
import type { CompromissoLista } from '../dados/tipos';
import {
  achadoDoGrupo, ANUNCIO_DA_BUSCA, atalhoDaBusca, buscaPronta, ehAtalhoDaBusca, ehExato, enderecoDaLinha, enderecoDaPagina, enderecoDoCartao, FILTROS_PADRAO,
  gruposDosModulos, LEITURA_DO_TERMO, lerTermo, linhaDaOpcao, modulosLigados, montarGrupos, noPeriodo, opcoesDosGrupos, ordenarAchados, PARAMETROS_DO_VER_TODOS,
  proximaOpcao, resumoDosResultados, semAcessoQueAparece, situacaoDaBusca, textoDoVerTodos, trechoQueCombina,
  type BuscaDoGrupo, type ItemAchado, type ItemSemAcesso
} from './buscaGeral';

const AGORA = new Date('2026-11-18T12:00:00-03:00');
const haDias = (n: number) => new Date(AGORA.getTime() - n * DIA).toISOString();

/** Um achado qualquer do grupo, com o que importa para a ordem e os filtros. */
const achado = (dados: Partial<ItemAchado> & Pick<ItemAchado, 'id'>): ItemAchado => ({
  tipo: 'achado', grupo: 'tarefas', codigo: dados.id.toUpperCase(), titulo: 'Item ' + dados.id, contexto: '', criadoEm: haDias(1), exatos: [dados.id.toLowerCase()], ...dados
});
const busca = (grupo: BuscaDoGrupo['grupo'], itens: ItemAchado[], total = itens.length): BuscaDoGrupo => ({ grupo, itens: itens.map(i => ({ ...i, grupo })), total });

describe('Busca geral: o que a pessoa digitou', () => {
  it.each([
    ['529.982.247-25', 'cpf', '52998224725'],
    ['52998224725', 'cpf', '52998224725'],
    ['11.222.333/0001-81', 'cnpj', '11222333000181'],
    ['12.ABC.345/01DE-35', 'cnpj', '12ABC34501DE35'],
    ['12abc34501de35', 'cnpj', '12ABC34501DE35'],
    ['0001234-97.2026.8.13.0024', 'cnj', '00012349720268130024'],
    ['00012349720268130024', 'cnj', '00012349720268130024'],
    ['C0FFEE12', 'codigo', 'c0ffee12'],
    ['he62-0163-2026', 'codigo', 'he62-0163-2026'],
    ['(38) 99999-1234', 'numero', '38999991234'],
    ['  José   da Silva ', 'texto', 'jose da silva'],
    ['', 'vazio', '']
  ])('quando a pessoa digita "%s", então a busca entende %s e compara com "%s"', (texto, forma, comparavel) => {
    // Quando
    const termo = lerTermo(texto);
    // Então
    expect(termo.forma).toBe(forma);
    expect(termo.comparavel).toBe(comparavel);
  });

  it('dado um CPF com um dígito errado, quando é lido, então não é CPF: é um número qualquer (pode ser um telefone)', () => {
    // Quando
    const termo = lerTermo('529.982.247-26');
    // Então
    expect(termo.forma).toBe('numero');
  });

  it.each([['a', false], ['ab', true], ['1.', false], ['12', true], ['  .-  ', false]])('quando a pessoa digitou "%s", então a busca começa: %s', (texto, pronta) => {
    // Quando / Então
    expect(buscaPronta(lerTermo(texto))).toBe(pronta);
  });

  it.each([
    ['52998224725', 'CPF 529.982.247-25'],
    ['00012349720268130024', 'Número de processo 0001234-97.2026.8.13.0024'],
    ['12abc34501de35', 'CNPJ 12.ABC.345/01DE-35'],
    ['maria', null]
  ])('quando a pessoa digita "%s", então a janela confirma o que entendeu: %s', (texto, leitura) => {
    // Dado
    const termo = lerTermo(texto);
    // Quando / Então
    expect(LEITURA_DO_TERMO[termo.forma](termo)).toBe(leitura);
  });
});

describe('Busca geral: módulos e endereços', () => {
  it('dado um escritório sem Contratos e sem Agenda, quando a busca escolhe onde procurar, então ficam as pessoas e os módulos ligados', () => {
    // Quando
    const modulos = modulosLigados({ processos: true, demandas: true, tarefas: true, anotacoes: true });
    // Então
    expect(modulos).toEqual(['pessoas', 'processos', 'demandas', 'tarefas', 'anotacoes']);
    expect(gruposDosModulos(modulos)).toEqual(['pessoas', 'judiciais', 'administrativos', 'demandas', 'tarefas', 'anotacoes']);
  });

  it.each([
    ['pessoas', '/pessoas/?id=p1'], ['judiciais', '/processos/judicial/?id=p1'], ['administrativos', '/processos/administrativo/?id=p1'],
    ['compromissos', '/agenda/?id=p1'], ['anotacoes', '/documentos/?id=p1']
  ] as const)('quando um achado de %s é aberto, então vai ao cartão em %s', (grupo, endereco) => {
    // Quando / Então
    expect(enderecoDoCartao(grupo, 'p1')).toBe(endereco);
  });

  it('quando a pessoa escolhe "Ver todos", então vai à página do módulo com a busca preenchida', () => {
    // Quando / Então
    expect(enderecoDaPagina('contratos', ' josé da silva ')).toBe('/contratos/?busca=jos%C3%A9+da+silva');
  });

  it('quando a pessoa escolhe "Ver todos em Agenda", então a Agenda abre na tabela (a visão por data só mostra o período da tela)', () => {
    // Quando / Então
    expect(enderecoDaPagina('compromissos', 'montes claros')).toBe('/agenda/?busca=montes+claros&visao=tabela');
    expect(PARAMETROS_DO_VER_TODOS).toEqual(['busca', 'visao']);
  });

  it.each([
    ['um achado', { tipo: 'resultado', id: 'tarefas-t1', grupo: 'tarefas', resultado: achado({ id: 't1' }) }, '/tarefas/?id=t1'],
    ['o "Ver todos"', { tipo: 'verTodos', id: 'pessoas-ver-todos', grupo: 'pessoas' }, '/pessoas/?busca=maria'],
    ['um item de que a pessoa não faz parte (#363)', { tipo: 'resultado', id: 'tarefas-x', grupo: 'tarefas', resultado: { tipo: 'semAcesso', grupo: 'tarefas', id: 'x', codigo: 'BEEF0001' } }, null]
  ] as const)('dada a linha de %s, quando a pessoa a abre, então vai a %s', (_caso, opcao, endereco) => {
    // Quando / Então
    expect(enderecoDaLinha(linhaDaOpcao(opcao), 'maria')).toBe(endereco);
  });
});

describe('Busca geral: o que cada módulo mostra', () => {
  it('dada uma pessoa, quando aparece na busca, então mostra o nome, o tipo, o documento pontuado e a cidade, e o CPF inteiro é busca exata', () => {
    // Dado
    const p = { id: 'p1', codigo: 'AB12CD34', tipo: 'pf', nome: 'JOSÉ DA SILVA TESTE', nome_fantasia: null, documento: '52998224725', municipio: 'Montes Claros', uf: 'MG',
      criado_em: haDias(3) } as unknown as PessoaLista;
    // Quando
    const item = achadoDoGrupo('pessoas', p);
    // Então
    expect(item).toMatchObject({ tipo: 'achado', grupo: 'pessoas', titulo: 'JOSÉ DA SILVA TESTE', codigo: 'AB12CD34', contexto: 'Pessoa física · 529.982.247-25 · Montes Claros/MG' });
    expect(item.exatos).toEqual(['ab12cd34', '52998224725']);
  });

  it.each(['12.ABC.345/01DE-35', '12abc34501de35'])('dada uma empresa com CNPJ com letras, quando a pessoa digita "%s", então a empresa é a busca exata', texto => {
    // Dado
    const p = { id: 'e1', codigo: 'EE12EE34', tipo: 'pj', nome: 'EMPRESA EXEMPLO', nome_fantasia: null, documento: '12ABC34501DE35', municipio: null, uf: null,
      criado_em: haDias(3) } as unknown as PessoaLista;
    // Quando
    const item = achadoDoGrupo('pessoas', p);
    // Então
    expect(ehExato(item, lerTermo(texto))).toBe(true);
  });

  it('dada uma empresa com CNPJ com letras, quando a pessoa digita só os algarismos dele, então a empresa não é a busca exata', () => {
    // Dado
    const p = { id: 'e1', codigo: 'EE12EE34', tipo: 'pj', nome: 'EMPRESA EXEMPLO', nome_fantasia: null, documento: '12ABC34501DE35', municipio: null, uf: null,
      criado_em: haDias(3) } as unknown as PessoaLista;
    // Quando / Então
    expect(ehExato(achadoDoGrupo('pessoas', p), lerTermo('123450135'))).toBe(false);
  });

  it('dado um compromisso com hora, quando aparece, então o contexto traz o tipo, a data e a hora sem os segundos', () => {
    // Dado
    const c = { id: 'c1', codigo: 'CC11CC22', tipo: 'reuniao', titulo: 'Reunião de equipe', data: '2026-11-20', hora: '09:30:00', local: 'Sala de reuniões',
      processo_numero: null, pessoa_nome: '', criado_em: haDias(1) } as unknown as CompromissoLista;
    // Quando / Então
    expect(achadoDoGrupo('compromissos', c).contexto).toBe('Reunião · 20/11/2026 às 09:30 · Sala de reuniões');
  });

  it('dado um processo judicial, quando aparece, então o título é o número pontuado e o contexto traz o nome, os clientes, o órgão e a vara', () => {
    // Dado
    const p = { id: 'x', codigo: 'F1F1F1F1', tipo: 'judicial', numero: '00012349720268130024', titulo: 'Cobrança', cliente_nome: 'JOSÉ; MARIA', orgao: 'TJMG', vara: '2ª Vara Cível',
      comarca: 'Montes Claros', criado_em: haDias(1) } as unknown as ProcessoLista;
    // Quando
    const item = achadoDoGrupo('judiciais', p);
    // Então
    expect(item.titulo).toBe('0001234-97.2026.8.13.0024');
    expect(item.contexto).toBe('Cobrança · JOSÉ e MARIA · TJMG · 2ª Vara Cível');
    expect(item.exatos).toContain('00012349720268130024');
  });

  it('dada uma tarefa sem pessoa, sem demanda e sem prazo, quando aparece, então o contexto fica vazio', () => {
    // Dado
    const t = { id: 't', codigo: 'C0FFEE12', titulo: 'Emitir a GRU', pessoa_nome: '', demanda_codigo: null, prazo: null, criado_em: haDias(1) } as unknown as TarefaLista;
    // Quando / Então
    expect(achadoDoGrupo('tarefas', t)).toMatchObject({ titulo: 'Emitir a GRU', contexto: '', exatos: ['c0ffee12'] });
  });
});

describe('Busca geral: ordem, filtros e grupos', () => {
  it('dados achados que vieram dos mais novos aos mais antigos, quando a busca ordena, então o exato vem primeiro, depois os que começam com o termo', () => {
    // Dado
    const itens = [achado({ id: 'a', titulo: 'Pedir a Maria' }), achado({ id: 'b', titulo: 'Maria Aparecida' }), achado({ id: 'c', titulo: 'Outra', exatos: ['maria'] })];
    // Quando
    const ordem = ordenarAchados(itens, lerTermo('maria')).map(i => i.id);
    // Então
    expect(ordem).toEqual(['c', 'b', 'a']);
  });

  it('dado o título exato como o 6º candidato mais novo, quando os grupos são montados, então ele aparece em primeiro', () => {
    // Dado: cinco cadastros mais novos que contêm "maria souza", e a própria Maria Souza depois deles
    const maisNovos = Array.from({ length: BUSCA_GERAL_POR_MODULO }, (_, i) => achado({ id: 'n' + i, titulo: `Ana Maria Souza Lima ${i}` }));
    const buscas = [busca('pessoas', [...maisNovos, achado({ id: 'maria', titulo: 'Maria Souza' })], 30)];
    // Quando
    const [pessoas] = montarGrupos(buscas, [], lerTermo('Maria Souza'), FILTROS_PADRAO, AGORA);
    // Então
    expect(pessoas.resultados).toHaveLength(BUSCA_GERAL_POR_MODULO);
    expect(pessoas.resultados[0].id).toBe('maria');
  });

  it('dados resultados de vários módulos, quando o filtro é um módulo, então só ele aparece', () => {
    // Dado
    const buscas = [busca('pessoas', [achado({ id: 'p' })]), busca('judiciais', [achado({ id: 'j' })]), busca('administrativos', [achado({ id: 'a' })]), busca('tarefas', [achado({ id: 't' })])];
    // Quando
    const grupos = montarGrupos(buscas, [], lerTermo('item'), { ...FILTROS_PADRAO, modulo: 'processos' }, AGORA);
    // Então
    expect(grupos.map(g => g.grupo)).toEqual(['judiciais', 'administrativos']);
  });

  it.each([['qualquer', ['novo', 'mes', 'velho']], ['semana', ['novo']], ['mes', ['novo', 'mes']]] as const)('quando o filtro de data é "%s", então ficam %j', (periodo, ids) => {
    // Dado
    const buscas = [busca('tarefas', [achado({ id: 'novo', criadoEm: haDias(2) }), achado({ id: 'mes', criadoEm: haDias(20) }), achado({ id: 'velho', criadoEm: haDias(400) })])];
    // Quando
    const grupos = montarGrupos(buscas, [], lerTermo('item'), { modulo: 'todos', periodo }, AGORA);
    // Então
    expect(grupos[0].resultados.map(r => r.id)).toEqual(ids);
  });

  it('dado um período sem nada, quando a busca monta os grupos, então o grupo não aparece', () => {
    // Dado
    const buscas = [busca('tarefas', [achado({ id: 'velho', criadoEm: haDias(400) })])];
    // Quando / Então
    expect(montarGrupos(buscas, [], lerTermo('item'), { modulo: 'todos', periodo: 'semana' }, AGORA)).toEqual([]);
    expect(noPeriodo(haDias(6), 'semana', AGORA)).toBe(true);
  });

  it('dado um módulo com mais itens do que a janela mostra, quando os grupos são montados, então ele oferece "Ver todos", e os outros não', () => {
    // Dado
    const cheios = Array.from({ length: BUSCA_GERAL_POR_MODULO }, (_, i) => achado({ id: 'p' + i }));
    const buscas = [busca('pessoas', cheios, BUSCA_GERAL_POR_MODULO + 7), busca('tarefas', [achado({ id: 't' })])];
    // Quando
    const grupos = montarGrupos(buscas, [], lerTermo('item'), FILTROS_PADRAO, AGORA);
    // Então
    expect(grupos.map(g => [g.grupo, g.maisNaPagina, g.total])).toEqual([['pessoas', true, BUSCA_GERAL_POR_MODULO + 7], ['tarefas', false, 1]]);
    expect(opcoesDosGrupos(grupos).map(o => o.id)).toEqual([...cheios.map(c => 'pessoas-' + c.id), 'pessoas-ver-todos', 'tarefas-t']);
  });

  it('dado o código exato de uma tarefa, quando os grupos são montados, então o grupo das tarefas vem antes das pessoas', () => {
    // Dado
    const buscas = [busca('pessoas', [achado({ id: 'p', exatos: ['p'] })]), busca('tarefas', [achado({ id: 'c0ffee12' })])];
    // Quando
    const grupos = montarGrupos(buscas, [], lerTermo('C0FFEE12'), FILTROS_PADRAO, AGORA);
    // Então
    expect(grupos.map(g => g.grupo)).toEqual(['tarefas', 'pessoas']);
  });

  it.each([
    ['qualquer', '12 no total · a página abre com a busca e os filtros dela'],
    ['semana', 'Em todas as datas · a página abre com a busca e os filtros dela']
  ] as const)('dado o filtro de data "%s", quando a janela escreve o "Ver todos", então diz "%s"', (periodo, texto) => {
    // Quando / Então
    expect(textoDoVerTodos(12, periodo)).toBe(texto);
  });

  it.each([
    ['antes', { pronta: false, respondida: false, linhas: 0 }],
    ['buscando', { pronta: true, respondida: false, linhas: 0 }],
    ['resultados', { pronta: true, respondida: false, linhas: 3 }],
    ['resultados', { pronta: true, respondida: true, linhas: 3 }],
    ['nada', { pronta: true, respondida: true, linhas: 0 }]
  ] as const)('quando a janela está em %s (%j), então mostra isso', (situacao, estado) => {
    // Quando / Então
    expect(situacaoDaBusca(estado)).toBe(situacao);
  });

  it('dadas as linhas da busca anterior à vista, quando a nova ainda não chegou, então o leitor de tela ouve que está buscando', () => {
    // Dado
    const grupos = montarGrupos([busca('tarefas', [achado({ id: 't' })])], [], lerTermo('item'), FILTROS_PADRAO, AGORA);
    // Quando / Então
    expect(ANUNCIO_DA_BUSCA.resultados(grupos, false)).toBe('Buscando…');
    expect(ANUNCIO_DA_BUSCA.resultados(grupos, true)).toBe('1 resultado em 1 módulo.');
    expect(ANUNCIO_DA_BUSCA.antes(grupos, false)).toBe('');
  });

  it.each([['1 resultado em 1 módulo.', 1, 0], ['3 resultados em 2 módulos.', 2, 1], ['Nada encontrado.', 0, 0]])('quando a janela resume, então diz "%s"', (resumo, nPessoas, nTarefas) => {
    // Dado
    const buscas = [busca('pessoas', Array.from({ length: nPessoas }, (_, i) => achado({ id: 'p' + i }))), busca('tarefas', Array.from({ length: nTarefas }, (_, i) => achado({ id: 't' + i })))];
    // Quando / Então
    expect(resumoDosResultados(montarGrupos(buscas, [], lerTermo('item'), FILTROS_PADRAO, AGORA))).toBe(resumo);
  });
});

describe('Busca geral: item de que a pessoa não faz parte (ponto de encaixe da #363)', () => {
  const alheia: ItemSemAcesso = { tipo: 'semAcesso', grupo: 'tarefas', id: 'x', codigo: 'BEEF0001' };
  const processo: ItemSemAcesso = { tipo: 'semAcesso', grupo: 'administrativos', id: 'y', codigo: 'AAAA0001', numero: '912345678' };

  it.each([
    ['o código exato', alheia, 'beef0001', true],
    ['parte do código', alheia, 'BEEF', false],
    ['um nome', alheia, 'emitir a gru', false],
    ['o número do processo', processo, '912345678', true],
    ['outro número', processo, '912345670', false]
  ])('quando a pessoa busca %s, então o item aparece: %s', (_caso, item, texto, aparece) => {
    // Quando / Então
    expect(semAcessoQueAparece(item, lerTermo(texto))).toBe(aparece);
  });

  it('dado o código exato, quando os grupos são montados, então o item aparece no grupo dele, depois dos achados', () => {
    // Dado
    const buscas = [busca('tarefas', [])];
    // Quando
    const grupos = montarGrupos(buscas, [alheia], lerTermo('BEEF0001'), FILTROS_PADRAO, AGORA);
    // Então
    expect(grupos).toEqual([{ grupo: 'tarefas', resultados: [alheia], total: 0, maisNaPagina: false }]);
  });
});

describe('Busca geral: o realce e o teclado', () => {
  it.each([
    ['José da Silva', 'jose', ['', 'José', ' da Silva']],
    ['Ação de cobrança', 'cobranca', ['Ação de ', 'cobrança', '']],
    ['Emitir a GRU', 'xyz', null]
  ])('dado o título "%s", quando a pessoa digitou "%s", então o realce é %j', (titulo, texto, partes) => {
    // Quando / Então
    expect(trechoQueCombina(titulo, lerTermo(texto))).toEqual(partes);
  });

  it('dado um número, quando a janela realça, então não realça (o número combinou pelos algarismos)', () => {
    // Quando / Então
    expect(trechoQueCombina('0001234-97.2026.8.13.0024', lerTermo('00012349720268130024'))).toBeNull();
  });

  it.each([[-1, 1, 0], [-1, -1, 4], [0, 1, 1], [4, 1, 0], [0, -1, 4]] as const)('dada a linha %i de 5, quando a seta anda %i, então vai à linha %i', (atual, passo, proxima) => {
    // Quando / Então
    expect(proximaOpcao(atual, 5, passo)).toBe(proxima);
  });

  it('dada uma lista vazia, quando a seta anda, então nenhuma linha fica escolhida', () => {
    // Quando / Então
    expect(proximaOpcao(-1, 0, 1)).toBe(-1);
  });

  it.each([
    [{ key: 'k', ctrlKey: true }, true], [{ key: 'K', metaKey: true }, true], [{ key: 'k' }, false],
    [{ key: 'k', ctrlKey: true, shiftKey: true }, false], [{ key: 'j', ctrlKey: true }, false]
  ])('quando a pessoa aperta %j, então é o atalho da busca: %s', (tecla, atalho) => {
    // Quando / Então
    expect(ehAtalhoDaBusca({ ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...tecla })).toBe(atalho);
  });

  it.each([[true, '⌘ K'], [false, 'Ctrl K']])('dado um Mac (%s), então a dica do atalho é "%s"', (mac, dica) => {
    // Quando / Então
    expect(atalhoDaBusca(mac)).toBe(dica);
  });
});
