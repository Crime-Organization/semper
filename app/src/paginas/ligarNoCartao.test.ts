// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// As gravações de ligar, no cartão de um item, outro que já existe (#341, etapa 2), no banco fictício: cada uma lê o que está
// gravado logo antes, diz se gravou (o Desfazer) ou se já estava (null), e o Desfazer tira só o que ela pôs.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SD } from '../dados';
import { CLIENTES_MAXIMOS } from '../dados/limites';
import { LISTA_CHEIA, TAREFA_DE_OUTRO_CONTRATO, TAREFA_DE_OUTRO_PROCESSO } from '../regras/ligarExistente';
import { ligarContratoNaTarefa, ligarContratoNoProcesso, ligarDemandaNoProcesso, ligarNoItem, ligarTarefaNaDemanda, ligarTarefaNoPrazo, porAPessoa, relacionarDemandas } from './ligarNoCartao';

const marca = () => 'LIGAR ' + Math.random().toString(36).slice(2, 8).toUpperCase();
const pessoa = async () => (await SD.pessoaCriar({ tipo: 'pf', nome: marca() })).id;
const contrato = async () => SD.contratoCriar({ clientes: [await pessoa()], responsavel_id: 'u-master', objetos: [marca()], categoria: 'pro_labore' });
const processo = async () => SD.processoCriar({ tipo: 'administrativo', numero: marca(), responsavel_id: 'u-master', clientes: [await pessoa()] });
const clientesDa = async (id: string) => (await SD.demandaObter(id))!.clientes.map(c => c.id);
const prazoDe = async (processoId: string, prazoId: string) => (await SD.processoPrazos(processoId)).find(x => x.id === prazoId)!;
afterEach(() => { vi.restoreAllMocks(); });
const PRAZO = { descricao: 'Contestação', final: '2026-12-01', intimacao: null, dias: null, contagem: null, disponibilizacao: false, sem_recesso: false, andamento_id: null };

describe('Pôr uma pessoa na lista do item', () => {
  it('dada uma demanda com um cliente, quando liga outra pessoa, então ela entra no fim; e o Desfazer tira só ela, mesmo com alguém que entrou depois', async () => {
    // Dado
    const [a, b, c] = [await pessoa(), await pessoa(), await pessoa()];
    const { id } = await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master', clientes: [a] });
    // Quando
    const desfazer = await porAPessoa('demandas', id, b);
    // Então
    expect(await clientesDa(id)).toEqual([a, b]);
    // Quando: outra pessoa pôs c, e esta ligação é desfeita
    await SD.demandaAtualizar(id, { clientes: [a, b, c] });
    await desfazer!();
    // Então
    expect(await clientesDa(id)).toEqual([a, c]);
  });

  it('dada uma tarefa que já tem a pessoa (alguém a pôs enquanto a busca estava aberta), quando liga, então nada é gravado e não há Desfazer', async () => {
    // Dado
    const a = await pessoa();
    const { id } = await SD.tarefaCriar({ titulo: marca(), responsavel_id: 'u-master', pessoas: [a] });
    const antes = (await SD.tarefaHistorico(id)).length;
    // Quando
    const desfazer = await porAPessoa('tarefas', id, a);
    // Então
    expect(desfazer).toBeNull();
    expect((await SD.tarefaHistorico(id)).length).toBe(antes);
  });

  it('dado um compromisso com a lista cheia, quando liga mais uma pessoa, então é recusado', async () => {
    // Dado
    const cheia = await Promise.all(Array.from({ length: CLIENTES_MAXIMOS }, pessoa));
    const { id } = await SD.compromissoCriar({ tipo: 'reuniao', titulo: marca(), data: '2026-12-10', hora: '10:00', responsavel_id: 'u-master', pessoas: cheia });
    // Quando / Então
    await expect(porAPessoa('compromissos', id, await pessoa())).rejects.toThrow(LISTA_CHEIA);
  });

  it('dado um processo, quando liga uma pessoa como cliente, então ela entra nos clientes dele', async () => {
    // Dado
    const p = await processo(), a = await pessoa();
    // Quando
    await porAPessoa('processos', p.id, a);
    // Então
    expect((await SD.processoObter(p.id))!.clientes.map(c => c.id)).toContain(a);
  });
});

describe('As ligações de um só', () => {
  it('dada uma demanda sem contrato, quando liga um contrato, então ela passa a tê-lo; ligar de novo não grava; e o Desfazer a deixa sem contrato', async () => {
    // Dado
    const k = await contrato(), { id } = await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master' });
    // Quando
    const desfazer = await ligarNoItem('contrato da demanda', id, k.id);
    // Então
    expect((await SD.demandaObter(id))!.contrato_id).toBe(k.id);
    expect(await ligarNoItem('contrato da demanda', id, k.id)).toBeNull();
    // Quando
    await desfazer!();
    // Então
    expect((await SD.demandaObter(id))!.contrato_id).toBeNull();
  });

  it('dada uma tarefa já num processo, quando liga a outro, então é recusado (trocar a tiraria do outro)', async () => {
    // Dado
    const [p, outro] = [await processo(), await processo()];
    const { id } = await SD.tarefaCriar({ titulo: marca(), responsavel_id: 'u-master', processo_id: p.id });
    // Quando / Então
    await expect(ligarNoItem('processo da tarefa', id, outro.id)).rejects.toThrow('Esta tarefa já está ligada a outro processo.');
  });

  it('dada uma tarefa de um contrato (#283), quando liga outro contrato, então fica nos dois, e o Desfazer tira só o novo', async () => {
    // Dado
    const [k1, k2] = [await contrato(), await contrato()];
    const { id } = await SD.tarefaCriar({ titulo: marca(), responsavel_id: 'u-master', contrato_ids: [k1.id] });
    // Quando
    const desfazer = await ligarContratoNaTarefa(id, k2.id);
    // Então
    expect(await SD.tarefaObter(id)).toMatchObject({ contrato_id: k1.id, contrato_ids: [k1.id, k2.id] });
    expect((await SD.tarefasDoContrato(k2.id)).map(t => t.id)).toContain(id);
    expect(await ligarContratoNaTarefa(id, k2.id)).toBeNull();
    // Quando
    await desfazer!();
    // Então
    expect(await SD.tarefaObter(id)).toMatchObject({ contrato_id: k1.id, contrato_ids: [k1.id] });
  });

  it('dada uma demanda sem contrato com uma tarefa de outro contrato, quando liga a demanda a um contrato, então é recusado (a tarefa ficaria em dois)', async () => {
    // Dado
    const [k1, k2] = [await contrato(), await contrato()];
    const d = await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master' });
    await SD.tarefaCriar({ titulo: marca(), responsavel_id: 'u-master', demanda_id: d.id, contrato_id: k1.id });
    // Quando / Então
    await expect(ligarNoItem('contrato da demanda', d.id, k2.id)).rejects.toThrow(TAREFA_DE_OUTRO_CONTRATO);
    expect((await SD.demandaObter(d.id))!.contrato_id).toBeNull();
    expect(await ligarNoItem('contrato da demanda', d.id, k1.id)).not.toBeNull();
  });

  it('dado um compromisso sem processo, quando liga um processo, então ele aparece nos compromissos do processo', async () => {
    // Dado
    const p = await processo();
    const { id } = await SD.compromissoCriar({ tipo: 'reuniao', titulo: marca(), data: '2026-12-10', hora: '10:00', responsavel_id: 'u-master' });
    // Quando
    await ligarNoItem('processo do compromisso', id, p.id);
    // Então
    expect((await SD.compromissosDoProcesso(p.id)).map(c => c.id)).toEqual([id]);
  });
});

describe('A tarefa e a demanda', () => {
  it('dada uma tarefa sem pessoas e sem contrato, quando entra numa demanda de um contrato, então leva os clientes e o contrato; o Desfazer tira os três', async () => {
    // Dado
    const k = await contrato(), cliente = await pessoa();
    const d = await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master', contrato_id: k.id, clientes: [cliente] });
    const { id } = await SD.tarefaCriar({ titulo: marca(), responsavel_id: 'u-master' });
    // Sem demanda, a tarefa nasce na demanda contínua (#313); ao ganhar uma demanda de verdade, sai dela
    const continua = (await SD.tarefaObter(id))?.demanda_id;
    // Quando
    const desfazer = await ligarTarefaNaDemanda(id, d.id);
    // Então
    expect(await SD.tarefaObter(id)).toMatchObject({ demanda_id: d.id, demanda_ids: [d.id], contrato_id: k.id, pessoas: [expect.objectContaining({ id: cliente })] });
    expect((await SD.tarefasDaDemanda(d.id)).map(t => t.id)).toContain(id);
    // Quando
    await desfazer!();
    // Então
    expect(await SD.tarefaObter(id)).toMatchObject({ demanda_id: continua, contrato_id: null, pessoas: [] });
  });

  it('dada uma tarefa que levou os clientes da demanda, quando outra pessoa pôs mais alguém nela e a ligação é desfeita, então essa pessoa fica', async () => {
    // Dado
    const k = await contrato(), [cliente, outra] = [await pessoa(), await pessoa()];
    const d = await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master', contrato_id: k.id, clientes: [cliente] });
    const { id } = await SD.tarefaCriar({ titulo: marca(), responsavel_id: 'u-master' });
    const continua = (await SD.tarefaObter(id))?.demanda_id;   // sem demanda, ela nasce na contínua (#313)
    const desfazer = await ligarTarefaNaDemanda(id, d.id);
    // Quando: outra pessoa pôs mais uma pessoa na tarefa, e esta ligação é desfeita
    await SD.tarefaAtualizar(id, { pessoas: [cliente, outra] });
    await desfazer!();
    // Então
    const t = (await SD.tarefaObter(id))!;
    expect(t).toMatchObject({ demanda_id: continua, contrato_id: null });
    expect(t.pessoas.map(p => p.id)).toEqual([outra]);
  });

  it('dada uma tarefa que outra pessoa já pôs em outra demanda, quando esta ligação é desfeita, então nada muda nela', async () => {
    // Dado
    const cliente = await pessoa();
    const [d1, d2] = [await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master', clientes: [cliente] }), await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master' })];
    const { id } = await SD.tarefaCriar({ titulo: marca(), responsavel_id: 'u-master' });
    const desfazer = await ligarTarefaNaDemanda(id, d1.id);
    await SD.tarefaAtualizar(id, { demanda_id: d2.id });
    // Quando
    await desfazer!();
    // Então
    const t = (await SD.tarefaObter(id))!;
    expect(t.demanda_id).toBe(d2.id);
    expect(t.pessoas.map(p => p.id)).toEqual([cliente]);
  });

  it('dada uma tarefa de uma demanda e de um contrato (#283), quando entra numa demanda de outro contrato, então fica nas duas demandas e nos dois contratos', async () => {
    // Dado
    const [k1, k2] = [await contrato(), await contrato()];
    const d1 = await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master', contrato_id: k1.id });
    const d2 = await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master', contrato_id: k2.id });
    const { id } = await SD.tarefaCriar({ titulo: marca(), responsavel_id: 'u-master', demanda_ids: [d1.id], contrato_ids: [k1.id] });
    // Quando
    await ligarTarefaNaDemanda(id, d2.id);
    // Então
    const t = (await SD.tarefaObter(id))!;
    expect(t).toMatchObject({ demanda_id: d1.id, demanda_ids: [d1.id, d2.id], contrato_ids: [k1.id, k2.id] });
    expect(t.demandas_ligadas.map(l => l.codigo)).toEqual([d1.codigo, d2.codigo]);
    for (const d of [d1, d2]) expect((await SD.tarefasDaDemanda(d.id)).map(x => x.id)).toContain(id);
  });

  it('dada uma tarefa em duas demandas, quando uma delas é excluída, então a tarefa continua, ligada à outra', async () => {
    // Dado
    const [d1, d2] = [await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master' }), await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master' })];
    const { id } = await SD.tarefaCriar({ titulo: marca(), responsavel_id: 'u-master', demanda_ids: [d1.id, d2.id] });
    // Quando
    await SD.demandasArquivar([d1.id], true);
    await SD.demandasExcluir([d1.id]);
    // Então
    expect(await SD.tarefaObter(id)).toMatchObject({ demanda_id: d2.id, demanda_ids: [d2.id] });
  });
});

describe('O prazo do processo e a tarefa que o cumpre', () => {
  it('dado um prazo sem tarefa, quando liga uma tarefa sem processo e com outra data, então o prazo a mostra e ela passa a ser do processo, com o último dia do prazo; o Desfazer volta tudo', async () => {
    // Dado
    const p = await processo(), z = await SD.processoPrazoCriar(p.id, PRAZO);
    const t = await SD.tarefaCriar({ titulo: marca(), responsavel_id: 'u-master', prazo: '2026-12-20' });
    // Quando
    const desfazer = await ligarTarefaNoPrazo(p.id, z.id, t.id);
    // Então
    expect((await prazoDe(p.id, z.id)).tarefa_id).toBe(t.id);
    expect(await SD.tarefaObter(t.id)).toMatchObject({ processo_id: p.id, prazo: PRAZO.final });
    expect(await ligarTarefaNoPrazo(p.id, z.id, t.id)).toBeNull();
    // Quando
    await desfazer!();
    // Então
    expect((await prazoDe(p.id, z.id)).tarefa_id).toBeNull();
    expect(await SD.tarefaObter(t.id)).toMatchObject({ processo_id: null, prazo: '2026-12-20' });
  });

  it('dada uma tarefa que ganhou outro processo depois da busca, quando liga ao prazo, então é recusado e nada é gravado', async () => {
    // Dado
    const [p, outro] = [await processo(), await processo()];
    const z = await SD.processoPrazoCriar(p.id, PRAZO);
    const t = await SD.tarefaCriar({ titulo: marca(), responsavel_id: 'u-master' });
    await SD.tarefaAtualizar(t.id, { processo_id: outro.id });
    // Quando / Então
    await expect(ligarTarefaNoPrazo(p.id, z.id, t.id)).rejects.toThrow(TAREFA_DE_OUTRO_PROCESSO);
    expect((await prazoDe(p.id, z.id)).tarefa_id).toBeNull();
    expect((await SD.tarefaObter(t.id))!.processo_id).toBe(outro.id);
  });

  it('dada uma tarefa ligada ao prazo, quando outra pessoa mudou a data dela e a ligação é desfeita, então a data dela fica', async () => {
    // Dado
    const p = await processo(), z = await SD.processoPrazoCriar(p.id, PRAZO);
    const t = await SD.tarefaCriar({ titulo: marca(), responsavel_id: 'u-master', prazo: '2026-12-20' });
    const desfazer = await ligarTarefaNoPrazo(p.id, z.id, t.id);
    await SD.tarefaAtualizar(t.id, { prazo: '2026-11-28' });
    // Quando
    await desfazer!();
    // Então
    expect((await prazoDe(p.id, z.id)).tarefa_id).toBeNull();
    expect(await SD.tarefaObter(t.id)).toMatchObject({ processo_id: null, prazo: '2026-11-28' });
  });

  it('dado um prazo em que outra pessoa já pôs outra tarefa, quando esta ligação é desfeita, então nada muda no prazo nem na tarefa', async () => {
    // Dado
    const p = await processo(), z = await SD.processoPrazoCriar(p.id, PRAZO);
    const [t, outra] = [await SD.tarefaCriar({ titulo: marca(), responsavel_id: 'u-master' }), await SD.tarefaCriar({ titulo: marca(), responsavel_id: 'u-master' })];
    const desfazer = await ligarTarefaNoPrazo(p.id, z.id, t.id);
    await SD.processoPrazoAtualizar(z.id, { tarefa_id: null });
    await SD.processoPrazoAtualizar(z.id, { tarefa_id: outra.id });
    // Quando
    await desfazer!();
    // Então
    expect((await prazoDe(p.id, z.id)).tarefa_id).toBe(outra.id);
    expect((await SD.tarefaObter(t.id))!.processo_id).toBe(p.id);
  });
});

describe('As ligações de muitos para muitos', () => {
  it('dado um processo, quando liga uma demanda e um contrato, então aparecem nele; ligar de novo não grava', async () => {
    // Dado
    const p = await processo(), k = await contrato();
    const d = await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master' });
    // Quando
    const [demanda, contratoLigado] = [await ligarDemandaNoProcesso(p.id, d.id), await ligarContratoNoProcesso(p.id, k.id)];
    // Então
    expect(demanda).not.toBeNull();
    expect(contratoLigado).not.toBeNull();
    expect((await SD.demandasDoProcesso(p.id)).map(x => x.id)).toEqual([d.id]);
    expect((await SD.contratosDoProcesso(p.id)).visiveis.map(x => x.id)).toEqual([k.id]);
    expect(await ligarDemandaNoProcesso(p.id, d.id)).toBeNull();
    expect(await ligarContratoNoProcesso(p.id, k.id)).toBeNull();
    // Quando
    await demanda!();
    // Então
    expect(await SD.demandasDoProcesso(p.id)).toEqual([]);
  });

  it('dado um processo em que outra pessoa ligou a demanda e o contrato entre a leitura e a gravação, quando liga, então não há Desfazer que apague a ligação dela', async () => {
    // Dado
    const p = await processo(), k = await contrato();
    const d = await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master' });
    await SD.processoDemandaLigar(p.id, d.id, 'atua');
    await SD.contratoProcessoLigar(k.id, p.id);
    // A leitura de antes ainda não via as duas ligações.
    vi.spyOn(SD, 'demandasDoProcesso').mockResolvedValueOnce([]);
    vi.spyOn(SD, 'contratosDoProcesso').mockResolvedValueOnce({ visiveis: [], ocultos: 0 });
    // Quando / Então
    expect(await ligarDemandaNoProcesso(p.id, d.id)).toBeNull();
    expect(await ligarContratoNoProcesso(p.id, k.id)).toBeNull();
  });
});

describe('As demandas relacionadas (#310)', () => {
  it('dadas duas demandas, quando relaciona, então as duas se mostram, e o Desfazer tira a ligação dos dois lados', async () => {
    // Dado
    const [d, e] = [await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master' }), await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master' })];
    // Quando
    const desfazer = await relacionarDemandas(d.id, e.id);
    // Então
    expect((await SD.demandasRelacionadas(e.id)).map(r => r.id)).toEqual([d.id]);
    // Quando
    await desfazer!();
    // Então
    expect(await SD.demandasRelacionadas(d.id)).toEqual([]);
  });

  it('dada uma ligação que já existe (no outro sentido), quando relaciona de novo, então não há Desfazer', async () => {
    // Dado
    const [d, e] = [await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master' }), await SD.demandaCriar({ titulo: marca(), responsavel_id: 'u-master' })];
    await relacionarDemandas(e.id, d.id);
    // Quando / Então
    expect(await relacionarDemandas(d.id, e.id)).toBeNull();
  });
});
