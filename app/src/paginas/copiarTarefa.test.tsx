// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Copiar a tarefa para outra demanda (#312), com o banco fictício: a cópia nasce na demanda com os checklists desmarcados (e os
// prazos dos itens), com a diligência, o solicitante e as funções (#414), e a original não muda; se algo falhar no meio, a cópia
// sai inteira.
import { describe, expect, it, vi } from 'vitest';
import { SD } from '../dados';
import { copiarTarefa } from './copiarTarefa';

/** Uma tarefa com um checklist de dois itens, um marcado e com prazo. */
async function tarefaComChecklist() {
  const eu = 'u-master';   // o Mauro, quem está logado na semente do banco fictício
  const { id } = await SD.tarefaCriar({ titulo: 'Emitir a GRU', descricao: 'Pagar no banco', prazo: '2030-12-01', responsavel_id: eu, participantes: [], pessoas: [] });
  const lista = await SD.listaCriar('tarefas', id, 'Passos', [{ texto: 'Gerar o boleto' }, { texto: 'Pagar' }]);
  await SD.itemAtualizar(lista.itens[0].id, { feito: true, prazo: '2030-11-20' });
  return id;
}

describe('A cópia da tarefa em outra demanda (#312)', () => {
  it('dada uma tarefa com checklist marcado, quando é copiada para uma demanda, então a cópia nasce nela com o checklist desmarcado e os prazos dos itens, e a original não muda', async () => {
    // Dado
    const original = await tarefaComChecklist();
    const [demanda] = await SD.demandasParaLigar({});
    // A original, sem demanda, está na demanda contínua (#313)
    const daOriginal0 = (await SD.tarefaObter(original))?.demanda_id;
    // Quando
    const copia = await copiarTarefa(original, demanda);
    // Então
    const t = await SD.tarefaObter(copia.id);
    expect(t).toMatchObject({ titulo: 'Emitir a GRU', descricao: 'Pagar no banco', prazo: '2030-12-01', demanda_id: demanda.id });
    const [lista] = await SD.listasDoCartao('tarefas', copia.id);
    expect(lista.nome).toBe('Passos');
    expect(lista.itens.map(i => [i.texto, i.feito_em, i.prazo])).toEqual([['Gerar o boleto', null, '2030-11-20'], ['Pagar', null, null]]);
    const [daOriginal] = await SD.listasDoCartao('tarefas', original);
    expect(daOriginal.itens[0].feito_em).not.toBeNull();
    expect((await SD.tarefaObter(original))?.demanda_id).toBe(daOriginal0);
  });

  it('dada uma tarefa com diligência, solicitante e funções, quando é copiada, então a cópia tem a mesma diligência (com o motivo), o mesmo solicitante e as mesmas funções (#414)', async () => {
    // Dado: a Ana executa e o Bruno tem uma função criada pelo escritório (de fábrica só vem a Executa, #421); quem pediu foi o Bruno
    const revisa = await SD.funcaoNaTarefaCriar({ nome: 'Revisa', executa: false });
    const { id: original } = await SD.tarefaCriar({
      titulo: 'Protocolar a petição', responsavel_id: 'u-master', participantes: ['u-ana', 'u-bruno'], pessoas: [],
      diligencia: true, diligencia_motivo: 'Levar a petição ao cartório', solicitante_id: 'u-bruno',
      funcoes: { 'u-ana': 'fn-executa', 'u-bruno': revisa.id }
    });
    const [demanda] = await SD.demandasParaLigar({});
    // Quando
    const copia = await copiarTarefa(original, demanda);
    // Então
    expect(await SD.tarefaObter(copia.id)).toMatchObject({
      diligencia: true, diligencia_motivo: 'Levar a petição ao cartório', solicitante_id: 'u-bruno',
      participantes: ['u-ana', 'u-bruno'], funcoes: { 'u-ana': 'fn-executa', 'u-bruno': revisa.id }
    });
  });

  it('dado o banco recusando o checklist, quando a tarefa é copiada, então avisa o erro e a cópia pela metade sai', async () => {
    // Dado
    const original = await tarefaComChecklist();
    const [demanda] = await SD.demandasParaLigar({});
    vi.spyOn(SD, 'listaCriar').mockRejectedValueOnce(new Error('Sem permissão.'));
    const excluir = vi.spyOn(SD, 'tarefasExcluir');
    // Quando
    const copiando = copiarTarefa(original, demanda);
    // Então
    await expect(copiando).rejects.toThrow('Sem permissão.');
    expect(excluir).toHaveBeenCalledTimes(1);
  });
});
