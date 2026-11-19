// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A gravação da equipe do contrato mudada no topo do cartão (#356), no banco fictício: lê o contrato logo antes, grava pela mesma
// função do lápis (que deixa a mudança no histórico), quem entra fica com 0% e o Desfazer volta só o que ela fez.
import { describe, expect, it, vi } from 'vitest';
import { SD } from '../dados';
import { desfazerUltimo } from '../ui/avisos';
import { mudarAEquipeDoContrato } from './equipeDoContrato';

const marca = () => 'EQUIPE ' + Math.random().toString(36).slice(2, 8).toUpperCase();
const comoAdministrador = { id: 'u-master', pessoa_id: 'p-mateus', papel: 'master' };
/** Um contrato do Mateus, com os participantes dados (a pessoa e o %). */
async function contrato(participantes: { pessoa_id: string; percentual: number | null }[] = []) {
  const cliente = (await SD.pessoaCriar({ tipo: 'pf', nome: marca() })).id;
  return (await SD.contratoCriar({ clientes: [cliente], responsavel_id: 'u-master', objetos: [marca()], categoria: 'pro_labore', participantes })).id;
}
const participantesDo = async (id: string) => (await SD.contratoObter(id))!.participantes.map(p => ({ pessoa_id: p.pessoa.id, percentual: p.percentual }));

describe('Mudar a equipe do contrato pelas bolinhas do cartão', () => {
  it('dado um contrato com o Bruno a 10%, quando põe a Ana, então ela entra com 0%, o Bruno fica com os 10% e o histórico registra', async () => {
    // Dado
    const id = await contrato([{ pessoa_id: 'p-bruno', percentual: 10 }]);
    const antes = (await SD.contratoHistorico(id)).length;
    // Quando
    const fim = await mudarAEquipeDoContrato(id, { tipo: 'por', id: 'p-ana', nome: 'Ana Teste Lima' }, comoAdministrador);
    // Então
    expect(fim).toBe('gravou');
    expect(await participantesDo(id)).toEqual([{ pessoa_id: 'p-bruno', percentual: 10 }, { pessoa_id: 'p-ana', percentual: 0 }]);
    expect((await SD.contratoHistorico(id)).length).toBeGreaterThan(antes);
  });

  it('dada a Ana já no contrato, quando é posta de novo, então nada é gravado', async () => {
    // Dado
    const id = await contrato([{ pessoa_id: 'p-ana', percentual: 5 }]);
    const antes = (await SD.contratoHistorico(id)).length;
    // Quando
    const fim = await mudarAEquipeDoContrato(id, { tipo: 'por', id: 'p-ana', nome: 'Ana Teste Lima' }, comoAdministrador);
    // Então
    expect(fim).toBe('nada');
    expect((await SD.contratoHistorico(id)).length).toBe(antes);
  });

  it('dada a Ana tirada do contrato, quando desfaz, então ela volta com os 15% de antes, e quem entrou depois fica', async () => {
    // Dado
    const id = await contrato([{ pessoa_id: 'p-ana', percentual: 15 }, { pessoa_id: 'p-bruno', percentual: 5 }]);
    await mudarAEquipeDoContrato(id, { tipo: 'tirar', id: 'p-ana', nome: 'Ana Teste Lima' }, comoAdministrador);
    expect(await participantesDo(id)).toEqual([{ pessoa_id: 'p-bruno', percentual: 5 }]);
    await SD.contratoAtualizar(id, { participantes: [{ pessoa_id: 'p-bruno', percentual: 5 }, { pessoa_id: 'p-mateus', percentual: 0 }] });
    // Quando
    desfazerUltimo();
    // Então
    await vi.waitFor(async () => expect(await participantesDo(id)).toEqual([
      { pessoa_id: 'p-ana', percentual: 15 }, { pessoa_id: 'p-bruno', percentual: 5 }, { pessoa_id: 'p-mateus', percentual: 0 }]));
  });

  it('dado um contrato com participantes, quando a Ana passa a responder por ele, então só o responsável muda', async () => {
    // Dado
    const id = await contrato([{ pessoa_id: 'p-bruno', percentual: 10 }]);
    // Quando
    await mudarAEquipeDoContrato(id, { tipo: 'responsavel', id: 'u-ana', nome: 'Ana Teste Lima' }, comoAdministrador);
    // Então
    const k = (await SD.contratoObter(id))!;
    expect(k.responsavel_id).toBe('u-ana');
    expect(await participantesDo(id)).toEqual([{ pessoa_id: 'p-bruno', percentual: 10 }]);
  });

  it('dado um contrato que outra pessoa já excluiu, quando muda a equipe, então diz que ele não foi encontrado', async () => {
    // Dado
    const id = await contrato();
    await SD.contratosArquivar([id], true);
    await SD.contratosExcluir([id]);
    // Quando
    const pedido = mudarAEquipeDoContrato(id, { tipo: 'por', id: 'p-ana', nome: 'Ana Teste Lima' }, comoAdministrador);
    // Então
    await expect(pedido).rejects.toThrow('Este item não foi encontrado.');
  });

  it('dada a Ana tirada, quando a pessoa desfaz enquanto o Bruno ainda entra pelo "+", então um espera o outro e os dois ficam no contrato', async () => {
    // Dado
    const id = await contrato([{ pessoa_id: 'p-ana', percentual: 15 }]);
    await mudarAEquipeDoContrato(id, { tipo: 'tirar', id: 'p-ana', nome: 'Ana Teste Lima' }, comoAdministrador);
    // Quando: o "+" ainda grava quando o Desfazer do aviso anterior é clicado
    const entrada = mudarAEquipeDoContrato(id, { tipo: 'por', id: 'p-bruno', nome: 'Bruno Exemplo Souza' }, comoAdministrador);
    desfazerUltimo();
    await entrada;
    // Então
    await vi.waitFor(async () => expect(await participantesDo(id)).toEqual([
      { pessoa_id: 'p-ana', percentual: 15 }, { pessoa_id: 'p-bruno', percentual: 0 }]));
  });
});
