// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { Membro, Tarefa } from '../dados/tipos';
import {
  camposDaTarefa, continuaPelaDemanda, dadosDaTarefa, errosDaEtapaTarefa, motivoSemMencaoNaTarefa, papeisNaTarefa, primeiraEtapaComErroTarefa, semSairDaTarefa,
  TAREFA_VAZIA, tarefasDaDemandaConcluidas, validarTarefa, veATarefa
} from './tarefa';

const completa = { ...TAREFA_VAZIA, titulo: 'Emitir a GRU', responsavelId: 'u-ana' };
const membro = (id: string, papel: Membro['papel'] = 'usuario') => ({ id, nome: id, usuario: id, papel, ativo: true }) as Membro;

describe('Cadastro de tarefa', () => {
  it('quando faltam o título e o responsável, então o cadastro avisa os dois', () => {
    // Quando
    const erros = validarTarefa(TAREFA_VAZIA);
    // Então
    expect(erros).toEqual({ titulo: 'Dê um título à tarefa.', responsavelId: 'Escolha o responsável.' });
  });

  it.each([
    ['um prazo inválido', { prazo: '31/02/2026' }, 'prazo'],
    ['um participante repetido', { participantes: ['u-bruno', 'u-bruno'] }, 'participantes'],
    ['uma pessoa repetida', { pessoas: ['p1', 'p1'] }, 'pessoas']
  ])('quando há %s, então o campo tem erro', (_caso, mudanca, campo) => {
    // Quando
    const erros = validarTarefa({ ...completa, ...mudanca });
    // Então
    expect(Object.keys(erros)).toEqual([campo]);
  });

  it('quando a tarefa é salva, então o responsável sai dos participantes, as linhas vazias somem e as ligações vazias vão como nada', () => {
    // Quando
    const dados = dadosDaTarefa({ ...completa, descricao: '  ', prazo: '10/11/2026', participantes: ['u-bruno', 'u-ana', 'u-bruno'], pessoas: ['p1', '', 'p1'] });
    // Então
    expect(dados).toEqual({ titulo: 'Emitir a GRU', descricao: null, prazo: '2026-11-10', responsavel_id: 'u-ana',
      participantes: ['u-bruno'], pessoas: ['p1'], demanda_id: null, contrato_id: null });
  });

  it('quando a tarefa salva volta ao formulário, então os campos voltam como foram digitados', () => {
    // Dado
    const t = { titulo: 'X', descricao: null, prazo: '2026-11-10', responsavel_id: 'u-ana', participantes: ['u-bruno'],
      pessoas: [{ id: 'p1' }], demanda_id: 'd1', contrato_id: null } as unknown as Tarefa;
    // Quando
    const campos = camposDaTarefa(t);
    // Então
    expect(campos).toEqual({ titulo: 'X', descricao: '', prazo: '10/11/2026', responsavelId: 'u-ana', participantes: ['u-bruno'],
      pessoas: ['p1'], demandaId: 'd1', contratoId: '' });
  });

  it('quando o título falta, então a primeira etapa é a que tem erro, e a etapa das pessoas não acusa o título', () => {
    // Quando
    const primeira = primeiraEtapaComErroTarefa({ ...completa, titulo: '' });
    const daEtapaPessoas = errosDaEtapaTarefa('pessoas', { ...completa, titulo: '' });
    // Então
    expect(primeira).toBe(0);
    expect(daEtapaPessoas).toEqual({});
  });
});

describe('Quem está na tarefa e quem a vê', () => {
  const tarefa = { criado_por: 'u-ana', responsavel_id: 'u-bruno', participantes: ['u-carla'] };
  const demanda = { criado_por: 'u-master', responsavel_id: 'u-master', colaboradores: ['u-davi'] };

  it('quando se pergunta o papel de cada um, então vêm na ordem: ligada, responsável, participante', () => {
    // Dado
    const t = { pessoas: ['p-bruno'], responsavel_id: 'u-bruno', participantes: [] };
    // Então
    expect(papeisNaTarefa(t, 'p-bruno', 'u-bruno')).toEqual(['pessoa', 'responsavel']);
    expect(papeisNaTarefa(t, 'p-outra')).toEqual([]);
  });

  it.each([
    ['quem criou', membro('u-ana'), null, true],
    ['o responsável', membro('u-bruno'), null, true],
    ['um participante', membro('u-carla'), null, true],
    ['um administrador', membro('u-zeca', 'admin'), null, true],
    ['quem colabora na demanda ligada', membro('u-davi'), demanda, true],
    ['quem não está nela nem na demanda', membro('u-davi'), null, false]
  ])('quando é %s, então vê a tarefa: %s', (_caso, m, d, ve) => {
    // Então
    expect(veATarefa(tarefa, m, d)).toBe(ve);
  });

  it('quando alguém não vê a tarefa, então não pode ser mencionado nela, e o motivo diz o que fazer', () => {
    // Quando
    const motivo = motivoSemMencaoNaTarefa(tarefa);
    // Então
    expect(motivo(membro('u-davi'))).toBe('não participa; inclua como participante');
    expect(motivo(membro('u-carla'))).toBeNull();
  });
});

describe('Sair da tarefa', () => {
  const dados = { responsavel_id: 'u2', participantes: ['u3'] };
  const ANTES = { responsavel_id: 'u2', lista: ['u3', 'u1'] };
  const demanda = { id: 'd1', codigo: 'D1', titulo: 'Demanda', etapa_id: null, criado_por: 'u9', responsavel_id: 'u9', colaboradores: [] };

  it('quando não pode sair, então continua como participante', () => {
    // Então
    expect(semSairDaTarefa(dados, 'u1', false, ANTES)).toEqual({ dados: { responsavel_id: 'u2', participantes: ['u3', 'u1'] }, ficou: true });
  });

  it('quando pode sair ou continua na tarefa, então nada muda', () => {
    // Então
    expect(semSairDaTarefa(dados, 'u1', true, ANTES)).toEqual({ dados, ficou: false });
    expect(semSairDaTarefa(dados, 'u2', false, ANTES)).toEqual({ dados, ficou: false });
    expect(semSairDaTarefa(dados, 'u3', false, ANTES)).toEqual({ dados, ficou: false });
  });

  it.each([
    ['a demanda ligada, que a pessoa vê', { demanda_id: 'd1', demanda }, 'd1', true],
    ['a demanda ligada, que a pessoa não vê', { demanda_id: 'd1', demanda: null }, 'd1', false],
    ['outra demanda, escolhida na lista de quem a vê', { demanda_id: 'd1', demanda: null }, 'd2', true],
    ['nenhuma demanda, depois de tirar a ligada', { demanda_id: 'd1', demanda }, null, false],
    ['nenhuma demanda, como antes', { demanda_id: null, demanda: null }, null, false]
  ])('quando a tarefa fica com %s, então continuar vendo pela demanda é %s', (_caso, alvo, depois, continua) => {
    // Então
    expect(continuaPelaDemanda(alvo, depois)).toBe(continua);
  });
});

describe('Demanda com as tarefas concluídas', () => {
  it.each([
    ['todas as ativas estão na coluna concluída (a arquivada não conta)', [{ etapa_id: 'c', arquivado_em: null }, { etapa_id: 'a', arquivado_em: 'x' }], true],
    ['alguma ainda não está', [{ etapa_id: 'c', arquivado_em: null }, { etapa_id: 'a', arquivado_em: null }], false],
    ['não há tarefa ativa', [{ etapa_id: 'c', arquivado_em: 'x' }], false]
  ])('quando %s, então oferecer concluir a demanda é %s', (_caso, tarefas, esperado) => {
    // Então
    expect(tarefasDaDemandaConcluidas(tarefas, 'c')).toBe(esperado);
  });

  it('quando o quadro não tem coluna concluída, então não oferece', () => {
    // Então
    expect(tarefasDaDemandaConcluidas([{ etapa_id: 'c', arquivado_em: null }], null)).toBe(false);
  });
});
