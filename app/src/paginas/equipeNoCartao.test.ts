// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// As gravações da equipe mudada no topo do cartão (#356), no banco fictício: cada uma lê a equipe gravada logo antes, grava pela
// mesma função do lápis (que deixa a mudança no histórico) e o Desfazer volta só o que ela fez.
import { describe, expect, it, vi } from 'vitest';
import { SD } from '../dados';
import { desfazerUltimo } from '../ui/avisos';
import { mudarAEquipe } from './equipeNoCartao';

const marca = () => 'EQUIPE ' + Math.random().toString(36).slice(2, 8).toUpperCase();
const comoAdministrador = { eu: 'u-master', podeSair: true };
const participantesDa = async (id: string) => (await SD.tarefaObter(id))!.participantes;

describe('Mudar a equipe pelas bolinhas do cartão', () => {
  it('dada uma tarefa em que outra pessoa pôs alguém depois de o cartão abrir, quando põe a Ana, então os dois ficam e o histórico registra', async () => {
    // Dado
    const { id } = await SD.tarefaCriar({ titulo: marca(), responsavel_id: 'u-bruno' });
    await SD.tarefaAtualizar(id, { participantes: ['u-master'] });
    const antes = (await SD.tarefaHistorico(id)).length;
    // Quando
    const fim = await mudarAEquipe('tarefas', id, { tipo: 'por', id: 'u-ana', nome: 'Ana Teste Lima' }, comoAdministrador);
    // Então
    expect(fim).toBe('gravou');
    expect(await participantesDa(id)).toEqual(['u-master', 'u-ana']);
    expect((await SD.tarefaHistorico(id)).length).toBeGreaterThan(antes);
  });

  it('dada a Ana já na tarefa, quando é posta de novo, então nada é gravado', async () => {
    // Dado
    const { id } = await SD.tarefaCriar({ titulo: marca(), responsavel_id: 'u-bruno', participantes: ['u-ana'] });
    const antes = (await SD.tarefaHistorico(id)).length;
    // Quando
    const fim = await mudarAEquipe('tarefas', id, { tipo: 'por', id: 'u-ana', nome: 'Ana Teste Lima' }, comoAdministrador);
    // Então
    expect(fim).toBe('nada');
    expect((await SD.tarefaHistorico(id)).length).toBe(antes);
  });

  it('dada a Ana tirada de uma demanda, quando desfaz, então ela volta e quem entrou depois fica', async () => {
    // Dado
    const { id } = await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-bruno', colaboradores: ['u-ana'] });
    await mudarAEquipe('demandas', id, { tipo: 'tirar', id: 'u-ana', nome: 'Ana Teste Lima' }, comoAdministrador);
    expect((await SD.demandaObter(id))!.colaboradores).toEqual([]);
    await SD.demandaAtualizar(id, { colaboradores: ['u-master'] });
    // Quando
    desfazerUltimo();
    // Então
    await vi.waitFor(async () => expect((await SD.demandaObter(id))!.colaboradores).toEqual(['u-master', 'u-ana']));
  });

  it('dado um processo, quando a Ana, colaboradora, passa a ser a responsável, então sai da lista de colaboradores', async () => {
    // Dado
    const pessoa = (await SD.pessoaCriar({ tipo: 'pf', nome: marca() })).id;
    const { id } = await SD.processoCriar({ tipo: 'administrativo', numero: marca(), responsavel_id: 'u-master', colaboradores: ['u-ana', 'u-bruno'], clientes: [pessoa] });
    // Quando
    await mudarAEquipe('processos', id, { tipo: 'responsavel', id: 'u-ana', nome: 'Ana Teste Lima' }, comoAdministrador);
    // Então
    const p = (await SD.processoObter(id))!;
    expect(p.responsavel_id).toBe('u-ana');
    expect(p.colaboradores).toEqual(['u-bruno']);
  });

  it('dada quem não pode ficar fora da tarefa e a saída recusada, quando se tira pela bolinha, então o aviso manda sair de novo pela bolinha', async () => {
    // Dado
    const { id } = await SD.tarefaCriar({ titulo: marca(), responsavel_id: 'u-bruno', participantes: ['u-ana'] });
    const sair = vi.spyOn(SD, 'cartaoSair').mockRejectedValueOnce(new Error('recusado'));
    // Quando
    const pedido = mudarAEquipe('tarefas', id, { tipo: 'tirar', id: 'u-ana', nome: 'Ana Teste Lima' }, { eu: 'u-ana', podeSair: false });
    // Então
    await expect(pedido).rejects.toThrow('A equipe foi gravada, mas você continua na tarefa. Para sair, use "Sair da tarefa" de novo na sua bolinha.');
    expect(sair).toHaveBeenCalledWith('tarefas', id);
    expect(await participantesDa(id)).toEqual(['u-ana']);
    sair.mockRestore();
  });

  it('dada uma anotação, quando é compartilhada com o Bruno pela bolinha, então ele entra nos participantes', async () => {
    // Dado
    const { id } = await SD.anotacaoCriar({ titulo: marca(), texto: '', responsavel_id: 'u-master', participantes: [] });
    // Quando
    await mudarAEquipe('anotacoes', id, { tipo: 'por', id: 'u-bruno', nome: 'Bruno Exemplo Souza' }, comoAdministrador);
    // Então
    expect((await SD.anotacaoObter(id))!.participantes).toEqual(['u-bruno']);
  });
});
