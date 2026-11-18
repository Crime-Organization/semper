// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { COLABORADORES_MAXIMOS, PARTICIPANTES_MAXIMOS } from '../dados/limites';
import type { ModuloDoPedido, PedidoDaMensagem } from '../dados/tipos';
import { CAMPOS_CONTRATO } from './contrato';
import {
  AVISO_AO_RESPONDER, CAMPOS_DO_PEDIDO_NO_HISTORICO, enderecoDaResposta, enderecoDoItemDoPedido, estadoDoItemSemAcesso, ITEM_SEM_ACESSO, LISTA_CHEIA, PEDIDO_DO_MODULO,
  RESPOSTA_DO_PEDIDO, respostaDoPedido
} from './pedidoDeParticipacao';

const pedido = (extra: Partial<PedidoDaMensagem> = {}): PedidoDaMensagem => ({
  id: 'p1', modulo: 'tarefas', item_id: 't1', item_codigo: 'F00D1234', pedido_por: 'u-bruno', situacao: 'pendente', respondido_por: null, tipo_do_processo: null, ...extra
});

describe('Pedir para participar (#363)', () => {
  it.each([
    ['tarefas', null, '/tarefas/?id=t1'],
    ['demandas', null, '/demandas/?id=t1'],
    ['processos', 'judicial', '/processos/judicial/?id=t1'],
    ['processos', 'administrativo', '/processos/administrativo/?id=t1'],
    ['compromissos', null, '/agenda/?id=t1'],
    ['contratos', null, '/contratos/?id=t1'],
    ['anotacoes', null, '/documentos/?id=t1']
  ] as const)('dado um pedido em %s (%s), quando quem aprova abre a mensagem, então vai ao cartão do item', (modulo, tipo, esperado) => {
    // Quando
    const endereco = enderecoDoItemDoPedido(pedido({ modulo, tipo_do_processo: tipo }));
    // Então
    expect(endereco).toBe(esperado);
  });

  it('dado um processo que a pessoa não vê (sem o tipo), quando se monta o endereço, então não há link', () => {
    // Então
    expect(enderecoDoItemDoPedido(pedido({ modulo: 'processos', tipo_do_processo: null }))).toBeNull();
  });

  it('dada a resposta, quando foi aprovada, então leva ao cartão; recusada, não leva a lugar nenhum', () => {
    // Então
    expect(enderecoDaResposta(pedido({ situacao: 'aprovado' }))).toBe('/tarefas/?id=t1');
    expect(enderecoDaResposta(pedido({ situacao: 'recusado' }))).toBeNull();
    expect(enderecoDaResposta(pedido({ situacao: 'cancelado' }))).toBeNull();
  });

  it.each([['pendente', null], ['cancelado', null], ['aprovado', 'aprovado'], ['recusado', 'recusado']] as const)(
    'dado um pedido %s, quando se pergunta se ele é uma resposta, então é %s', (situacao, esperado) => {
      // Então
      expect(respostaDoPedido(situacao)).toBe(esperado);
    });

  it('dada a resposta, quando a caixa de quem pediu a mostra, então diz quem respondeu e o que mudou', () => {
    // Então
    expect(RESPOSTA_DO_PEDIDO.aprovado.verbo).toBe('aprovou');
    expect(RESPOSTA_DO_PEDIDO.aprovado.depois('contratos')).toBe('Agora você é participante do contrato, com 0% da divisão.');
    expect(RESPOSTA_DO_PEDIDO.recusado.verbo).toBe('recusou');
    expect(RESPOSTA_DO_PEDIDO.recusado.depois('tarefas')).toBe('Você continua sem acesso a este item.');
  });

  it('dada uma resposta, quando quem aprova responde, então o aviso diz o que aconteceu com quem pediu', () => {
    // Então
    expect(AVISO_AO_RESPONDER.aprovado('Bruno', 'demandas')).toBe('Pedido aprovado: Bruno entra como colaborador.');
    expect(AVISO_AO_RESPONDER.recusado('Bruno', 'demandas')).toBe('Pedido recusado. Bruno vai receber a resposta nas Mensagens.');
  });

  it('dado o item na busca, quando há pedido pendente, então a linha mostra "Pedido enviado" e "Cancelar"; sem pedido, "Pedir para participar"', () => {
    // Quando
    const livre = ITEM_SEM_ACESSO[estadoDoItemSemAcesso(null)], pedido = ITEM_SEM_ACESSO[estadoDoItemSemAcesso('p1')];
    // Então
    expect([livre.meta, livre.botao, livre.rotulo('Tarefa', 'F00D1234')]).toEqual(['Você não faz parte deste item.', 'Pedir para participar', 'Pedir para participar: Tarefa F00D1234']);
    expect([pedido.meta, pedido.botao, pedido.rotulo('Tarefa', 'F00D1234')]).toEqual(['Pedido enviado · aguardando resposta', 'Cancelar', 'Cancelar o pedido: Tarefa F00D1234']);
  });

  it('dados os módulos, quando a lista está cheia, então o limite é o do banco: 20 na equipe e 10 no contrato', () => {
    // Então
    const modulos = Object.keys(PEDIDO_DO_MODULO) as ModuloDoPedido[];
    expect(modulos.map(m => LISTA_CHEIA[m].maximo)).toEqual(modulos.map(m => m === 'contratos' ? PARTICIPANTES_MAXIMOS : COLABORADORES_MAXIMOS));
    expect(LISTA_CHEIA.tarefas.aviso).toBe('Uma tarefa pode ter até 20 participantes.');
    expect(LISTA_CHEIA.contratos.aviso).toBe('Um contrato pode ter até 10 participantes.');
  });

  it('dada a resposta no histórico do item, quando o cartão mostra o histórico, então cada linha tem o nome dela, também no contrato', () => {
    // Então
    expect(CAMPOS_DO_PEDIDO_NO_HISTORICO).toEqual({ pedido_aprovado: 'Pedido para participar aprovado', pedido_recusado: 'Pedido para participar recusado' });
    expect(CAMPOS_CONTRATO.pedido_aprovado).toBe('Pedido para participar aprovado');
  });
});
