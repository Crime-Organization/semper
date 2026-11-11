// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { Demanda, Membro } from '../dados/tipos';
import {
  CAMPOS_DEMANDA, camposDaDemanda, dadosDaDemanda, DEMANDA_VAZIA, errosDaEtapaDemanda, motivoSemMencaoNaDemanda, papeisNaDemanda,
  primeiraEtapaComErroDemanda, rotuloDoPrazoComHora, seloDoPrazo, semSairDaDemanda, situacaoDoPrazo, validarDemanda, valorLegivelDemanda
} from './demanda';

const completa = { ...DEMANDA_VAZIA, titulo: 'Pedido de registro de marca', responsavelId: 'u-ana' };

describe('Cadastro de demanda', () => {
  it('quando faltam o título e o responsável, então o cadastro avisa os dois', () => {
    // Quando
    const erros = validarDemanda(DEMANDA_VAZIA);
    // Então
    expect(erros).toEqual({ titulo: 'Dê um título à demanda.', responsavelId: 'Escolha o responsável.' });
  });

  it.each([
    ['um prazo inválido', { prazo: '31/02/2026' }, 'prazo'],
    ['um colaborador repetido', { colaboradores: ['u-bruno', 'u-bruno'] }, 'colaboradores'],
    ['um cliente repetido', { clientes: ['p1', 'p1'] }, 'clientes']
  ])('quando há %s, então o campo tem erro', (_caso, mudanca, campo) => {
    // Quando
    const erros = validarDemanda({ ...completa, ...mudanca });
    // Então
    expect(Object.keys(erros)).toEqual([campo]);
  });

  it('quando a demanda é salva, então o responsável sai dos colaboradores, as linhas vazias somem e o prazo vai como data', () => {
    // Quando
    const dados = dadosDaDemanda({ ...completa, descricao: '  ', prazo: '10/11/2026', colaboradores: ['u-bruno', 'u-ana', 'u-bruno'], clientes: ['p1', '', 'p1'] });
    // Então
    expect(dados).toEqual({ titulo: 'Pedido de registro de marca', descricao: null, prazo: '2026-11-10', prazo_hora: null, lembrete: null, responsavel_id: 'u-ana',
      colaboradores: ['u-bruno'], clientes: ['p1'], contrato_id: null });
  });

  it('dado um prazo com hora e lembrete, quando a demanda é salva, então os dois vão junto', () => {
    // Quando
    const dados = dadosDaDemanda({ ...completa, prazo: '15/11/2030', hora: '14:00', lembrete: 60 });
    // Então
    expect(dados).toMatchObject({ prazo: '2030-11-15', prazo_hora: '14:00', lembrete: 60 });
  });

  it.each([
    ['a hora', { hora: '14:00' }, 'hora', 'Informe o prazo para pôr a hora'],
    ['o lembrete', { lembrete: 30 as const }, 'lembrete', 'Informe o prazo para marcar o lembrete'],
    ['o lembrete na hora do prazo', { lembrete: 0 as const }, 'lembrete', 'Informe o prazo para marcar o lembrete']
  ])('dado %s sem prazo, quando confere a demanda, então o campo tem erro', (_caso, mudanca, campo, mensagem) => {
    // Quando
    const erros = validarDemanda({ ...completa, ...mudanca });
    // Então
    expect(erros).toEqual({ [campo]: mensagem });
    expect(Object.keys(errosDaEtapaDemanda('demanda', { ...completa, ...mudanca }))).toEqual([campo]);
  });

  it('dado hora e lembrete, quando o prazo é apagado e a demanda é salva sem conferir, então os dois vão vazios', () => {
    // Quando
    const dados = dadosDaDemanda({ ...completa, prazo: '', hora: '14:00', lembrete: 1440 });
    // Então
    expect(dados).toMatchObject({ prazo: null, prazo_hora: null, lembrete: null });
  });

  it('dado uma demanda com hora e lembrete, quando volta ao formulário, então a hora vem sem os segundos', () => {
    // Dado
    const d = { titulo: 'X', descricao: null, prazo: '2030-11-15', prazo_hora: '14:00:00', lembrete: 1440, responsavel_id: 'u-ana', colaboradores: [],
      clientes: [], contrato_id: null } as unknown as Demanda;
    // Quando
    const campos = camposDaDemanda(d);
    // Então
    expect(campos).toMatchObject({ prazo: '15/11/2030', hora: '14:00', lembrete: 1440 });
  });

  it('dado uma demanda sem prazo que ficou com hora e lembrete no banco, quando volta ao formulário, então os dois vêm vazios e a edição não trava', () => {
    // Dado: o site antigo tirou o prazo sem conhecer as colunas novas
    const d = { titulo: 'X', descricao: null, prazo: null, prazo_hora: '14:00:00', lembrete: 1440, responsavel_id: 'u-ana', colaboradores: [],
      clientes: [], contrato_id: null } as unknown as Demanda;
    // Quando
    const campos = camposDaDemanda(d);
    // Então
    expect(campos).toMatchObject({ prazo: '', hora: '', lembrete: null });
    expect(primeiraEtapaComErroDemanda(campos)).toBe(-1);
  });

  it('quando a hora e o lembrete aparecem no histórico, então vêm com o nome e o formato da tela', () => {
    // Então
    expect(CAMPOS_DEMANDA.prazo_hora).toBe('Hora do prazo');
    expect(CAMPOS_DEMANDA.lembrete).toBe('Lembrete');
    expect(valorLegivelDemanda('prazo_hora', '14:00:00')).toBe('14:00');
    expect(valorLegivelDemanda('lembrete', 60)).toBe('1 hora antes');
    expect(valorLegivelDemanda('lembrete', 0)).toBe('Na hora do prazo');
    expect(valorLegivelDemanda('lembrete', null)).toBe('—');
  });

  it.each([
    ['com hora', '14:00:00', 'Prazo: 15/11/2030 às 14:00'],
    ['sem hora', null, 'Prazo: 15/11/2030']
  ])('dado um prazo %s, quando aparece no selo, então mostra a data e a hora', (_caso, hora, rotulo) => {
    // Então
    expect(rotuloDoPrazoComHora('2030-11-15', hora, '2030-11-01')).toBe(rotulo);
    expect(rotuloDoPrazoComHora(null, hora, '2030-11-01')).toBeNull();
  });

  it('quando a demanda salva volta ao formulário, então os campos voltam como foram digitados', () => {
    // Dado
    const d = { titulo: 'X', descricao: null, prazo: '2026-11-10', responsavel_id: 'u-ana', colaboradores: ['u-bruno'],
      clientes: [{ id: 'p1' }], contrato_id: 'k1' } as unknown as Demanda;
    // Quando
    const campos = camposDaDemanda(d);
    // Então
    expect(campos).toEqual({ titulo: 'X', descricao: '', prazo: '10/11/2026', hora: '', lembrete: null, responsavelId: 'u-ana', colaboradores: ['u-bruno'], clientes: ['p1'], contratoId: 'k1' });
  });

  it('quando o título falta, então a primeira etapa é a que tem erro, e a etapa das pessoas não acusa o título', () => {
    // Quando
    const primeira = primeiraEtapaComErroDemanda({ ...completa, titulo: '' });
    const daEtapaPessoas = errosDaEtapaDemanda('pessoas', { ...completa, titulo: '' });
    // Então
    expect(primeira).toBe(0);
    expect(daEtapaPessoas).toEqual({});
  });

  it('quando o prazo aparece no histórico, então vem como dia/mês/ano; vazio vira um traço', () => {
    // Então
    expect(valorLegivelDemanda('prazo', '2026-11-10')).toBe('10/11/2026');
    expect(valorLegivelDemanda('descricao', null)).toBe('—');
  });
});

describe('Sair da demanda', () => {
  const dados = { responsavel_id: 'u2', colaboradores: ['u3'] };
  const ANTES = { responsavel_id: 'u2', lista: ['u3', 'u1'] };

  it('quando não pode sair, então continua como colaborador', () => {
    // Então
    expect(semSairDaDemanda(dados, 'u1', false, ANTES)).toEqual({ dados: { responsavel_id: 'u2', colaboradores: ['u3', 'u1'] }, ficou: true });
  });

  it('quando é administrador ou criou a demanda, ou continua nela, então nada muda', () => {
    // Então
    expect(semSairDaDemanda(dados, 'u1', true, ANTES)).toEqual({ dados, ficou: false });
    expect(semSairDaDemanda(dados, 'u2', false, ANTES)).toEqual({ dados, ficou: false });
    expect(semSairDaDemanda(dados, 'u3', false, ANTES)).toEqual({ dados, ficou: false });
  });
});

describe('Prazo da demanda', () => {
  it.each([
    ['antes de hoje', '2026-10-28', 'vencido'],
    ['hoje', '2026-10-29', 'hoje'],
    ['depois de hoje', '2026-11-05', 'em_dia'],
    ['sem prazo', null, null]
  ])('quando o prazo é %s, então a situação é %s', (_caso, prazo, esperada) => {
    // Quando
    const s = situacaoDoPrazo(prazo, '2026-10-29');
    // Então
    expect(s).toBe(esperada);
  });

  it.each([
    ['vencido', '2026-10-28'],
    ['de hoje', '2026-10-29'],
    ['futuro', '2026-11-05']
  ])('dado um cartão concluído com prazo %s, quando se vê a situação, então ela é "concluido"', (_caso, prazo) => {
    // Quando
    const s = situacaoDoPrazo(prazo, '2026-10-29', true);
    // Então
    expect(s).toBe('concluido');
    expect(situacaoDoPrazo(null, '2026-10-29', true)).toBeNull();
  });

  it('dada uma tarefa concluída depois do prazo, quando aparece nas listas, então o texto não diz "vencido"', () => {
    // Quando
    const texto = rotuloDoPrazoComHora('2026-10-20', '14:00:00', '2026-10-29', true);
    // Então
    expect(texto).toBe('Prazo: 20/10/2026 às 14:00');
  });

  it.each([
    ['tarefas', 'Concluída · Prazo: 20/10/2026'],
    ['demandas', 'Concluído · Prazo: 20/10/2026']
  ] as const)('dado um cartão de %s concluído com prazo vencido, quando aparece o selo, então ele é verde e diz que terminou', (modulo, texto) => {
    // Quando
    const selo = seloDoPrazo('2026-10-20', null, '2026-10-29', modulo);
    // Então
    expect(selo).toEqual({ tipo: 'ok', texto });
  });

  it.each([
    ['vencido', '2026-10-20', { tipo: 'erro', texto: 'Prazo vencido: 20/10/2026' }],
    ['de hoje', '2026-10-29', { tipo: 'pend', texto: 'Vence hoje: 29/10/2026' }],
    ['futuro', '2026-11-05', { tipo: 'arq', texto: 'Prazo: 05/11/2026' }],
    ['vazio', null, null]
  ])('dado um cartão aberto com prazo %s, quando aparece o selo, então a cor e o texto seguem a data', (_caso, prazo, esperado) => {
    // Quando
    const selo = seloDoPrazo(prazo, null, '2026-10-29');
    // Então
    expect(selo).toEqual(esperado);
  });
});

describe('Pessoas da demanda', () => {
  const demanda = { clientes: ['p-cliente'], responsavel_id: 'u-ana', colaboradores: ['u-bruno'], criado_por: 'u-carla' };

  it.each([
    ['o cliente', 'p-cliente', null, ['cliente']],
    ['a responsável', 'p-ana', 'u-ana', ['responsavel']],
    ['o colaborador', 'p-bruno', 'u-bruno', ['colaborador']],
    ['quem não está nela', 'p-outra', 'u-outra', []]
  ])('quando se pergunta o papel de %s, então a resposta é %j', (_quem, pessoa, perfil, papeis) => {
    // Quando
    const r = papeisNaDemanda(demanda, pessoa, perfil);
    // Então
    expect(r).toEqual(papeis);
  });

  it.each([
    ['um administrador de fora da demanda', { id: 'u-adm', nome: 'Adm', papel: 'admin' }, null],
    ['o colaborador', { id: 'u-bruno', nome: 'Bruno', papel: 'usuario' }, null],
    ['quem criou', { id: 'u-carla', nome: 'Carla', papel: 'usuario' }, null],
    ['alguém da equipe de fora da demanda', { id: 'u-davi', nome: 'Davi', papel: 'usuario' }, 'não participa; inclua como colaborador']
  ] as [string, Membro, string | null][])('quando %s é mencionado num comentário da demanda, então o motivo para não poder é %s', (_quem, m, motivo) => {
    // Quando
    const r = motivoSemMencaoNaDemanda(demanda)(m);
    // Então
    expect(r).toBe(motivo);
  });
});
