// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { Membro, Tarefa } from '../dados/tipos';
import {
  CAMPOS_TAREFA, valorLegivelTarefa, camposDaTarefa, comMaisUm, continuaPelaDemanda, CONTRATOS_DA_TAREFA_CHEIA, contratosDaTarefa, dadosDaTarefa, DEMANDAS_DA_TAREFA_CHEIA,
  demandasDaTarefa, demandasQueAbre, errosDaEtapaTarefa, estaNaTarefa, ETAPAS_TAREFA, ligadasDaTarefa, motivoSemMencaoNaTarefa, naOrdemDoLapisTarefa, oQueADemandaTraz,
  papeisNaTarefa, primeiraEtapaComErroTarefa, semADemanda, semSairDaTarefa, TAREFA_VAZIA, tarefasDaDemandaConcluidas, validarTarefa, veATarefa
} from './tarefa';
import { CONTRATOS_POR_TAREFA, DEMANDAS_POR_TAREFA } from '../dados/limites';

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
    expect(dados).toEqual({ titulo: 'Emitir a GRU', descricao: null, prazo: '2026-11-10', prazo_hora: null, lembrete: null, responsavel_id: 'u-ana',
      participantes: ['u-bruno'], pessoas: ['p1'], demanda_ids: [], contrato_ids: [], processo_id: null });
  });

  it('dadas duas demandas e dois contratos (#283), quando a tarefa é salva, então vão as listas inteiras, na ordem e sem repetir', () => {
    // Quando
    const dados = dadosDaTarefa({ ...completa, demandas: ['d1', 'd2', 'd1'], contratos: ['k2', 'k1'] });
    // Então
    expect(dados).toMatchObject({ demanda_ids: ['d1', 'd2'], contrato_ids: ['k2', 'k1'] });
  });

  it('dada a lista de demandas ou de contratos acima do máximo do banco, quando confere, então o campo avisa', () => {
    // Dado
    const muitas = Array.from({ length: DEMANDAS_POR_TAREFA + 1 }, (_, i) => 'd' + i), muitos = Array.from({ length: CONTRATOS_POR_TAREFA + 1 }, (_, i) => 'k' + i);
    // Quando
    const erros = validarTarefa({ ...completa, demandas: muitas, contratos: muitos });
    // Então
    expect(erros).toEqual({ demandas: DEMANDAS_DA_TAREFA_CHEIA, contratos: CONTRATOS_DA_TAREFA_CHEIA });
  });

  it('dada a lista cheia, quando a pessoa tenta acrescentar mais uma, então nada muda; sem repetir a que já está', () => {
    // Dado / Quando / Então
    expect(comMaisUm(['d1'], 'd2', 2)).toEqual(['d1', 'd2']);
    expect(comMaisUm(['d1', 'd2'], 'd3', 2)).toEqual(['d1', 'd2']);
    expect(comMaisUm(['d1'], 'd1', 2)).toEqual(['d1']);
  });

  it('dado um processo escolhido, quando a tarefa é salva, então ele vai junto; tirado, vai como nada (#294)', () => {
    // Quando
    const comProcesso = dadosDaTarefa({ ...completa, processoId: 'pr1' });
    const semProcesso = dadosDaTarefa({ ...completa, processoId: '' });
    // Então
    expect(comProcesso.processo_id).toBe('pr1');
    expect(semProcesso.processo_id).toBeNull();
  });

  it('dado um prazo com hora e lembrete, quando a tarefa é salva, então os dois vão junto', () => {
    // Quando
    const dados = dadosDaTarefa({ ...completa, prazo: '15/11/2030', hora: '09:30', lembrete: 30 });
    // Então
    expect(dados).toMatchObject({ prazo: '2030-11-15', prazo_hora: '09:30', lembrete: 30 });
  });

  it('dado um prazo sem hora e com lembrete, quando a tarefa é salva, então a hora vai vazia e o lembrete vai', () => {
    // Quando
    const dados = dadosDaTarefa({ ...completa, prazo: '15/11/2030', lembrete: 1440 });
    // Então
    expect(dados).toMatchObject({ prazo_hora: null, lembrete: 1440 });
  });

  it.each([
    ['a hora', { hora: '14:00' }, 'hora', 'Informe o prazo para pôr a hora'],
    ['o lembrete', { lembrete: 60 as const }, 'lembrete', 'Informe o prazo para marcar o lembrete']
  ])('dado %s sem prazo, quando confere a tarefa, então o campo tem erro na primeira etapa', (_caso, mudanca, campo, mensagem) => {
    // Quando
    const erros = validarTarefa({ ...completa, ...mudanca });
    // Então
    expect(erros).toEqual({ [campo]: mensagem });
    expect(primeiraEtapaComErroTarefa({ ...completa, ...mudanca })).toBe(0);
  });

  it('dado hora e lembrete, quando o prazo é apagado e a tarefa é salva sem conferir, então os dois vão vazios', () => {
    // Quando
    const dados = dadosDaTarefa({ ...completa, prazo: '', hora: '14:00', lembrete: 0 });
    // Então
    expect(dados).toMatchObject({ prazo: null, prazo_hora: null, lembrete: null });
  });

  it('quando a hora e o lembrete aparecem no histórico, então vêm com o nome e o formato da tela', () => {
    // Então
    expect(CAMPOS_TAREFA.prazo_hora).toBe('Hora do prazo');
    expect(CAMPOS_TAREFA.lembrete).toBe('Lembrete');
    // E o que acontece com um registro de tempo (#400) tem nome próprio
    expect(CAMPOS_TAREFA.tempo).toBe('Registro de tempo');
    expect(valorLegivelTarefa('prazo_hora', '14:00:00')).toBe('14:00');
    expect(valorLegivelTarefa('lembrete', 60)).toBe('1 hora antes');
  });

  it('quando a tarefa salva volta ao formulário, então os campos voltam como foram digitados', () => {
    // Dado
    const t = { titulo: 'X', descricao: null, prazo: '2026-11-10', data_inicio: '2026-11-05', responsavel_id: 'u-ana', participantes: ['u-bruno'],
      pessoas: [{ id: 'p1' }], demanda_id: 'd1', demanda_ids: ['d1', 'd2'], contrato_id: null, contrato_ids: [], processo_id: 'pr1' } as unknown as Tarefa;
    // Quando
    const campos = camposDaTarefa(t);
    // Então
    expect(campos).toEqual({ titulo: 'X', descricao: '', prazo: '10/11/2026', hora: '', lembrete: null, inicio: '05/11/2026', responsavelId: 'u-ana', participantes: ['u-bruno'],
      pessoas: ['p1'], demandas: ['d1', 'd2'], contratos: [], processoId: 'pr1' });
  });

  it('dada uma tarefa gravada sem as listas (numa importação), quando volta ao formulário ou ao cartão, então conta a demanda e o contrato principais', () => {
    // Dado
    const t = { demanda_id: 'd1', demanda_codigo: 'D1', demanda: null, contrato_id: 'k1', demanda_ids: [], contrato_ids: [] };
    // Então
    expect(demandasDaTarefa(t)).toEqual(['d1']);
    expect(contratosDaTarefa(t)).toEqual(['k1']);
    expect(ligadasDaTarefa(t)).toEqual([{ id: 'd1', codigo: 'D1', item: null }]);
    expect(demandasDaTarefa({ demanda_id: null })).toEqual([]);
  });

  it('dado uma tarefa sem prazo que ficou com hora e lembrete no banco, quando volta ao formulário, então os dois vêm vazios e a edição não trava', () => {
    // Dado: o site antigo tirou o prazo sem conhecer as colunas novas
    const t = { titulo: 'X', descricao: null, prazo: null, prazo_hora: '14:00:00', lembrete: 60, data_inicio: '2026-11-05', responsavel_id: 'u-ana', participantes: [],
      pessoas: [], demanda_id: null, contrato_id: null } as unknown as Tarefa;
    // Quando
    const campos = camposDaTarefa(t);
    // Então
    expect(campos).toMatchObject({ prazo: '', hora: '', lembrete: null });
    expect(primeiraEtapaComErroTarefa(campos)).toBe(-1);
  });

  it('quando o título falta, então a primeira etapa é a que tem erro, e a etapa das pessoas não acusa o título', () => {
    // Quando
    const primeira = primeiraEtapaComErroTarefa({ ...completa, titulo: '' });
    const daEtapaPessoas = errosDaEtapaTarefa('pessoas', { ...completa, titulo: '' });
    // Então
    expect(primeira).toBe(0);
    expect(daEtapaPessoas).toEqual({});
  });

  it('quando a pessoa percorre o cadastro, então há duas etapas (a tarefa, com o prazo e as ligações, e as pessoas), e a das pessoas é a de antes (#299)', () => {
    // Então
    expect(ETAPAS_TAREFA.map(e => e.id)).toEqual(['tarefa', 'pessoas']);
    expect(ETAPAS_TAREFA[0].campos).toEqual(expect.arrayContaining(['titulo', 'prazo', 'hora', 'lembrete', 'demandas', 'contratos', 'processoId']));
    expect(ETAPAS_TAREFA[1]).toMatchObject({ titulo: 'Pessoas', campos: ['responsavelId', 'participantes', 'pessoas'] });
  });

  it('dado o lápis do cartão, quando ele mostra as seções, então as pessoas vêm antes da demanda, do contrato e do processo, como antes da #299', () => {
    // Quando
    const noLapis = naOrdemDoLapisTarefa(ETAPAS_TAREFA).map(e => e.id);
    // Então
    expect(noLapis).toEqual(['pessoas', 'tarefa']);
    // O cadastro continua na ordem dele.
    expect(ETAPAS_TAREFA.map(e => e.id)).toEqual(['tarefa', 'pessoas']);
  });
});

describe('As demandas ligadas no cadastro da tarefa (#299, #283)', () => {
  const demandaA = { id: 'd-a', clientes: ['p-maria', 'p-joao'], contratoId: 'k-a' };

  it('dada a tarefa sem pessoas e sem contrato, quando a demanda chega, então os clientes e o contrato dela entram, e fica guardado o que ela trouxe', () => {
    // Quando
    const r = oQueADemandaTraz({ ...completa, demandas: ['d-a'] }, demandaA);
    // Então
    expect(r).toEqual({ mudancas: { pessoas: ['p-maria', 'p-joao'], contratos: ['k-a'] }, trazido: { demandaId: 'd-a', pessoas: ['p-maria', 'p-joao'], contratoId: 'k-a' } });
  });

  it('dada a tarefa que já tem pessoas e outro contrato, quando mais uma demanda chega, então as pessoas ficam e o contrato dela entra junto do outro', () => {
    // Quando
    const r = oQueADemandaTraz({ ...completa, demandas: ['d-b', 'd-a'], pessoas: ['p-ana'], contratos: ['k-outro'] }, demandaA);
    // Então
    expect(r).toEqual({ mudancas: { contratos: ['k-outro', 'k-a'] }, trazido: { demandaId: 'd-a', pessoas: [], contratoId: 'k-a' } });
  });

  it('dada a tarefa que já tem o contrato da demanda, quando ela chega, então nada muda e ela não trouxe o contrato', () => {
    // Quando
    const r = oQueADemandaTraz({ ...completa, demandas: ['d-a'], pessoas: ['p-ana'], contratos: ['k-a'] }, demandaA);
    // Então
    expect(r).toEqual({ mudancas: {}, trazido: { demandaId: 'd-a', pessoas: [], contratoId: '' } });
  });

  it('dada a demanda tirada enquanto a resposta vinha, quando a resposta chega, então ela não vale', () => {
    // Então
    expect(oQueADemandaTraz({ ...completa, demandas: [] }, demandaA)).toBeNull();
    expect(oQueADemandaTraz({ ...completa, demandas: ['d-b'] }, demandaA)).toBeNull();
  });

  it('dada a demanda que trouxe clientes e contrato, quando a pessoa a tira, então saem os clientes e o contrato que vieram dela; quem a pessoa pôs fica', () => {
    // Dado
    const c = { ...completa, demandas: ['d-a'], pessoas: ['p-maria', 'p-ana', 'p-joao'], contratos: ['k-a'] };
    // Quando
    const r = semADemanda(c, 'd-a', [{ demandaId: 'd-a', pessoas: ['p-maria', 'p-joao'], contratoId: 'k-a' }]);
    // Então
    expect(r).toEqual({ mudancas: { demandas: [], pessoas: ['p-ana'], contratos: [] }, ficam: [false, true, false] });
  });

  it('dada a demanda que trouxe só os clientes, quando a pessoa a tira, então as pessoas ficam vazias e o contrato que a pessoa tirou continua fora', () => {
    // Dado
    const c = { ...completa, demandas: ['d-a'], pessoas: ['p-maria'], contratos: ['k-outro'] };
    // Quando
    const r = semADemanda(c, 'd-a', [{ demandaId: 'd-a', pessoas: ['p-maria'], contratoId: 'k-a' }]);
    // Então
    expect(r).toEqual({ mudancas: { demandas: [], pessoas: [''] }, ficam: [false] });
  });

  it('dada a demanda que já vinha na tarefa salva (nada foi trazido agora), quando a pessoa a tira, então só ela sai, e as outras ficam', () => {
    // Dado
    const c = { ...completa, demandas: ['d-a', 'd-b'], pessoas: ['p-maria'], contratos: ['k-a'] };
    // Quando
    const r = semADemanda(c, 'd-a', [{ demandaId: 'd-b', pessoas: [], contratoId: 'k-b' }]);
    // Então
    expect(r).toEqual({ mudancas: { demandas: ['d-b'] }, ficam: [true] });
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

  it('dada uma tarefa ligada a duas demandas (#283), quando quem está só na segunda a abre, então está nela e a vê', () => {
    // Dado
    const outra = { criado_por: 'u-master', responsavel_id: 'u-master', colaboradores: ['u-eva'] };
    // Então
    expect(estaNaTarefa(tarefa, membro('u-eva'), [demanda, outra])).toBe(true);
    expect(veATarefa(tarefa, membro('u-davi'), [demanda, outra])).toBe(true);
    expect(estaNaTarefa(tarefa, membro('u-fora'), [demanda, outra])).toBe(false);
  });

  it('dada uma tarefa ligada a dois contratos (#283), quando quem está só no segundo pergunta, então a vê, só para ler', () => {
    // Dado
    const t = { ...tarefa, contrato_id: 'k1', contrato_ids: ['k1', 'k2'] };
    // Então
    expect(veATarefa(t, membro('u-eva'), null, ['k2'])).toBe(true);
    expect(estaNaTarefa(t, membro('u-eva'))).toBe(false);
    expect(veATarefa(t, membro('u-eva'), null, ['k3'])).toBe(false);
  });

  it('dada uma tarefa com demandas que quem lê abre e não abre, então só as que abre contam', () => {
    // Dado
    const aberta = { id: 'd2', codigo: 'D2', titulo: 'Aberta', etapa_id: null, criado_por: null, responsavel_id: 'u-x', colaboradores: [], contrato_id: null, contrato: null };
    // Então
    expect(demandasQueAbre({ demanda: null, demandas_ligadas: [{ id: 'd1', codigo: 'D1', item: null }, { id: 'd2', codigo: 'D2', item: aberta }] })).toEqual([aberta]);
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
  const demanda = { id: 'd1', codigo: 'D1', titulo: 'Demanda', etapa_id: null, criado_por: 'u9', responsavel_id: 'u9', colaboradores: [], contrato_id: null, contrato: null };

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
    ['a demanda ligada, que a pessoa vê', { demanda_id: 'd1', demanda }, ['d1'], true],
    ['a demanda ligada, que a pessoa não vê', { demanda_id: 'd1', demanda: null }, ['d1'], false],
    ['outra demanda, escolhida na lista de quem a vê', { demanda_id: 'd1', demanda: null }, ['d2'], true],
    ['nenhuma demanda, depois de tirar a ligada', { demanda_id: 'd1', demanda }, [], false],
    ['nenhuma demanda, como antes', { demanda_id: null, demanda: null }, [], false],
    ['a segunda demanda, que a pessoa vê (#283)', { demanda_id: 'd1', demanda: null, demanda_ids: ['d1', 'd2'],
      demandas_ligadas: [{ id: 'd1', codigo: 'D1', item: null }, { id: 'd2', codigo: 'D2', item: { ...demanda, id: 'd2' } }] }, ['d1', 'd2'], true]
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
