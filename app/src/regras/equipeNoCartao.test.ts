// A equipe mudada no topo do cartão (#356). Padrão Dado / Quando / Então: app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { COLABORADORES_MAXIMOS } from '../dados/limites';
import { AVISO_DA_MUDANCA, desfazerMudanca, EQUIPE_DO_MODULO, MUDANCAS, planoDaMudanca, saidaPelaBolinhaFalhou, tirarPelaBolinha, type ModuloDaEquipe } from './equipeNoCartao';

const equipe = (responsavel_id: string, lista: string[]) => ({ responsavel_id, lista });
const cheia = Array.from({ length: COLABORADORES_MAXIMOS }, (_, i) => 'u' + i);
const modulos = Object.keys(EQUIPE_DO_MODULO) as ModuloDaEquipe[];

describe('Pôr alguém da equipe pelo "+" do cartão', () => {
  it('dada uma tarefa sem participantes, quando põe a Ana, então ela entra na lista', () => {
    // Dado / Quando / Então
    expect(MUDANCAS.por('tarefas', equipe('u-bruno', []), 'u-ana', 'Ana')).toEqual({ gravar: { lista: ['u-ana'] } });
  });

  it('dada uma lista em que outra pessoa já pôs alguém, quando põe mais um, então ele vai para o fim e o outro fica', () => {
    // Dado / Quando / Então
    expect(MUDANCAS.por('demandas', equipe('u-bruno', ['u-ana']), 'u-master', 'Mateus')).toEqual({ gravar: { lista: ['u-ana', 'u-master'] } });
  });

  it('dada a pessoa que já estava (alguém a pôs com a busca aberta), quando põe de novo, então avisa e não grava', () => {
    // Dado / Quando / Então
    expect(MUDANCAS.por('tarefas', equipe('u-bruno', ['u-ana']), 'u-ana', 'Ana')).toEqual({ aviso: 'Ana já estava na tarefa.', tipo: 'info' });
  });

  it('dado o responsável, quando é posto como participante, então avisa que ele já é o responsável', () => {
    // Dado / Quando / Então
    expect(MUDANCAS.por('processos', equipe('u-ana', []), 'u-ana', 'Ana')).toEqual({ aviso: 'Ana já é responsável pelo processo.', tipo: 'info' });
  });

  it.each(modulos)('dada a lista cheia em %s, quando põe mais um, então recusa com o máximo do banco', modulo => {
    // Dado / Quando
    const r = MUDANCAS.por(modulo, equipe('u-dono', cheia), 'u-novo', 'Novo');
    // Então
    expect(r).toEqual({ aviso: EQUIPE_DO_MODULO[modulo].cheia, tipo: 'erro' });
    expect(EQUIPE_DO_MODULO[modulo].cheia).toContain(String(COLABORADORES_MAXIMOS));
  });
});

describe('Tirar alguém pela bolinha', () => {
  it('dada uma demanda com dois colaboradores, quando tira um, então o outro fica', () => {
    // Dado / Quando / Então
    expect(MUDANCAS.tirar('demandas', equipe('u-bruno', ['u-ana', 'u-master']), 'u-ana', 'Ana')).toEqual({ gravar: { lista: ['u-master'] } });
  });

  it('dado alguém que outra pessoa já tirou, quando tira, então avisa e não grava', () => {
    // Dado / Quando / Então
    expect(MUDANCAS.tirar('compromissos', equipe('u-bruno', []), 'u-ana', 'Ana')).toEqual({ aviso: 'Ana já não estava no compromisso.', tipo: 'info' });
  });
});

describe('Trocar o responsável pela bolinha', () => {
  it('dado um participante, quando passa a ser o responsável, então sai da lista (como no lápis)', () => {
    // Dado / Quando / Então
    expect(MUDANCAS.responsavel('tarefas', equipe('u-bruno', ['u-ana', 'u-master']), 'u-ana', 'Ana'))
      .toEqual({ gravar: { responsavel_id: 'u-ana', lista: ['u-master'] } });
  });

  it('dado quem já é o responsável, quando é escolhido de novo, então avisa e não grava', () => {
    // Dado / Quando / Então
    expect(MUDANCAS.responsavel('anotacoes', equipe('u-ana', []), 'u-ana', 'Ana')).toEqual({ aviso: 'Ana já é responsável pela anotação.', tipo: 'info' });
  });
});

describe('Os avisos', () => {
  it.each([
    ['por', 'Ana agora está na tarefa.'],
    ['tirar', 'Ana saiu da tarefa.'],
    ['responsavel', 'Responsável pela tarefa: Ana.']
  ] as const)('quando a mudança "%s" é gravada, então o aviso diz "%s"', (tipo, aviso) => {
    // Quando / Então
    expect(AVISO_DA_MUDANCA[tipo]('tarefas', 'Ana')).toBe(aviso);
  });

  it('dada a saída pela bolinha que falhou, quando avisa, então diz como sair de novo pela bolinha, sem falar em Salvar', () => {
    // Quando
    const aviso = saidaPelaBolinhaFalhou('demandas');
    // Então
    expect(aviso).toBe('A equipe foi gravada, mas você continua na demanda. Para sair, use "Sair da demanda" de novo na sua bolinha.');
    expect(aviso).not.toMatch(/Salve/);
  });
});

describe('Desfazer a mudança na equipe', () => {
  it('dada a Ana posta e o Mateus posto depois por outra pessoa, quando desfaz, então só a Ana sai', () => {
    // Dado / Quando / Então
    expect(desfazerMudanca('tarefas', { tipo: 'por', id: 'u-ana', nome: 'Ana' }, equipe('u-bruno', []), equipe('u-bruno', ['u-ana', 'u-master'])))
      .toEqual({ lista: ['u-master'] });
  });

  it('dada a Ana posta e já tirada por outra pessoa, quando desfaz, então não há o que voltar', () => {
    // Dado / Quando / Então
    expect(desfazerMudanca('tarefas', { tipo: 'por', id: 'u-ana', nome: 'Ana' }, equipe('u-bruno', []), equipe('u-bruno', []))).toBeNull();
  });

  it('dada a Ana tirada, quando desfaz, então ela volta para o fim da lista', () => {
    // Dado / Quando / Então
    expect(desfazerMudanca('demandas', { tipo: 'tirar', id: 'u-ana', nome: 'Ana' }, equipe('u-bruno', ['u-ana']), equipe('u-bruno', ['u-master'])))
      .toEqual({ lista: ['u-master', 'u-ana'] });
  });

  it('dada a Ana tirada e a lista cheia depois, quando desfaz, então recusa com o máximo', () => {
    // Dado / Quando / Então
    expect(desfazerMudanca('demandas', { tipo: 'tirar', id: 'u-ana', nome: 'Ana' }, equipe('u-bruno', ['u-ana']), equipe('u-bruno', cheia)))
      .toEqual({ aviso: EQUIPE_DO_MODULO.demandas.cheia });
  });

  it('dada a Ana, participante, que passou a ser a responsável, quando desfaz, então o Bruno volta a responder e a Ana volta à lista', () => {
    // Dado / Quando / Então
    expect(desfazerMudanca('tarefas', { tipo: 'responsavel', id: 'u-ana', nome: 'Ana' }, equipe('u-bruno', ['u-ana']), equipe('u-ana', [])))
      .toEqual({ responsavel_id: 'u-bruno', lista: ['u-ana'] });
  });

  it('dado o responsável trocado de novo por outra pessoa, quando desfaz, então não há o que voltar', () => {
    // Dado / Quando / Então
    expect(desfazerMudanca('tarefas', { tipo: 'responsavel', id: 'u-ana', nome: 'Ana' }, equipe('u-bruno', []), equipe('u-master', []))).toBeNull();
  });
});

describe('Sair do cartão pela bolinha', () => {
  const tirarAna = { tipo: 'tirar' as const, id: 'u-ana', nome: 'Ana' };

  it('dada a Ana, participante que não pode gravar fora da tarefa, quando se tira, então esta gravação ainda a mantém e ela sai depois', () => {
    // Dado / Quando / Então
    expect(planoDaMudanca('tarefas', tirarAna, equipe('u-bruno', ['u-ana', 'u-master']), { eu: 'u-ana', podeSair: false }))
      .toEqual({ gravar: { lista: ['u-ana', 'u-master'] }, sai: true });
  });

  it('dado quem pode gravar fora do cartão (administrador, quem criou), quando se tira, então sai na própria gravação', () => {
    // Dado / Quando / Então
    expect(planoDaMudanca('tarefas', tirarAna, equipe('u-bruno', ['u-ana']), { eu: 'u-ana', podeSair: true })).toEqual({ gravar: { lista: [] }, sai: false });
  });

  it('dada a responsável que passa a demanda para outro, quando não pode gravar fora dela, então entra na lista e sai depois', () => {
    // Dado / Quando / Então
    expect(planoDaMudanca('demandas', { tipo: 'responsavel', id: 'u-bruno', nome: 'Bruno' }, equipe('u-ana', []), { eu: 'u-ana', podeSair: false }))
      .toEqual({ gravar: { responsavel_id: 'u-bruno', lista: ['u-ana'] }, sai: true });
  });

  it('dada uma mudança em outra pessoa, quando grava, então quem muda continua no cartão', () => {
    // Dado / Quando / Então
    expect(planoDaMudanca('processos', { tipo: 'por', id: 'u-bruno', nome: 'Bruno' }, equipe('u-ana', []), { eu: 'u-ana', podeSair: false }))
      .toEqual({ gravar: { lista: ['u-bruno'] }, sai: false });
  });

  it('dada a pessoa que já estava, quando põe, então o plano é só o aviso', () => {
    // Dado / Quando / Então
    expect(planoDaMudanca('tarefas', { tipo: 'por', id: 'u-ana', nome: 'Ana' }, equipe('u-bruno', ['u-ana']), { eu: 'u-master', podeSair: true }))
      .toEqual({ aviso: 'Ana já estava na tarefa.', tipo: 'info' });
  });
});

describe('O que a bolinha de quem está na lista diz a quem muda a equipe', () => {
  it('dada a bolinha de outra pessoa, quando a dica aparece, então diz que o clique a tira, com o nome dela', () => {
    // Então
    expect(tirarPelaBolinha('tarefas', { id: 'u-ana', nome: 'Ana Souza' }, 'u-bruno')).toBe('Tirar Ana Souza');
  });

  it.each(modulos)('dada a própria bolinha em %s, quando a dica aparece, então diz que o clique faz a pessoa sair do item', modulo => {
    // Então
    expect(tirarPelaBolinha(modulo, { id: 'u-ana', nome: 'Ana Souza' }, 'u-ana')).toBe(`${EQUIPE_DO_MODULO[modulo].sair} (Ana Souza)`);
  });
});
