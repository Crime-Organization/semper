// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { TAMANHO_COMPROMISSO, TAMANHO_TAREFA } from '../dados/limites';
import { compromissoVazio, validarCompromisso } from './compromisso';
import { descricaoAoGravar, edicaoNoLugarPorSalvar, erroNoLugar, semOsCamposDoLugar, tituloOpcionalAoGravar } from './edicaoNoLugar';
import { processoVazio, validarProcesso } from './processo';
import { TAREFA_VAZIA, validarTarefa } from './tarefa';

describe('Edição por salvar no próprio lugar do cartão (#346)', () => {
  const gravado = { titulo: 'Emitir a GRU', descricao: 'Pagar até sexta.' };

  it.each([
    ['nada aberto', {}, false],
    ['o título aberto sem mudança', { titulo: 'Emitir a GRU' }, false],
    ['o título aberto só com espaços a mais nas pontas', { titulo: '  Emitir a GRU ' }, false],
    ['o título mudado', { titulo: 'Emitir a guia' }, true],
    ['a descrição aberta sem mudança', { descricao: 'Pagar até sexta.' }, false],
    ['a descrição mudada', { descricao: 'Pagar até sexta. Avisar o cliente.' }, true],
    ['os dois fechados (null)', { titulo: null, descricao: null }, false],
    ['o prazo mudado e não salvo (#361)', { prazo: '{"prazo":"20/12/2030"}' }, true],
    ['a data e o horário do compromisso mudados e não salvos (#361)', { quando: '{"data":"25/11/2030"}' }, true],
    ['o prazo e a data fechados ou sem mudança (null)', { prazo: null, quando: null }, false]
  ])('dado %s, quando o cartão confere, então diz se há o que perder', (_caso, rascunhos, esperado) => {
    // Quando / Então
    expect(edicaoNoLugarPorSalvar(gravado, rascunhos)).toBe(esperado);
  });

  it('dado um item sem título nem descrição gravados (null), quando a pessoa abre e não escreve nada, então não há o que perder', () => {
    // Dado
    const semNada = { titulo: null, descricao: null };
    // Quando / Então
    expect(edicaoNoLugarPorSalvar(semNada, { titulo: '', descricao: '' })).toBe(false);
    expect(edicaoNoLugarPorSalvar(semNada, { titulo: 'Instrução' })).toBe(true);
  });
});

describe('Conferir no próprio lugar com as regras do cadastro (#346)', () => {
  it.each([
    ['o título da tarefa em branco', '  ', 'Dê um título à tarefa.'],
    ['o título da tarefa longo demais', 'x'.repeat(TAMANHO_TAREFA.titulo + 1), `O título pode ter até ${TAMANHO_TAREFA.titulo} caracteres.`],
    ['o título da tarefa certo', 'Emitir a guia', '']
  ])('dado %s, quando o cartão confere, então dá o mesmo erro do cadastro', (_caso, valor, erro) => {
    // Quando / Então
    expect(erroNoLugar(validarTarefa, TAREFA_VAZIA, 'titulo', valor)).toBe(erro);
  });

  it('dada a descrição da tarefa longa demais, quando o cartão confere, então dá o erro do tamanho, e não o dos outros campos vazios', () => {
    // Quando
    const erro = erroNoLugar(validarTarefa, TAREFA_VAZIA, 'descricao', 'x'.repeat(TAMANHO_TAREFA.descricao + 1));
    // Então
    expect(erro).toBe(`A descrição pode ter até ${TAMANHO_TAREFA.descricao} caracteres.`);
    expect(erroNoLugar(validarTarefa, TAREFA_VAZIA, 'descricao', '')).toBe('');
  });

  it('dado um compromisso, quando o título fica em branco, então só a reunião reclama: a audiência pode ficar sem título', () => {
    // Quando / Então
    expect(erroNoLugar(validarCompromisso, compromissoVazio('reuniao'), 'titulo', '')).toBe('Dê um título ao compromisso.');
    expect(erroNoLugar(validarCompromisso, compromissoVazio('audiencia'), 'titulo', '')).toBe('');
    expect(erroNoLugar(validarCompromisso, compromissoVazio('audiencia'), 'titulo', 'x'.repeat(TAMANHO_COMPROMISSO.titulo + 1)))
      .toBe(`O título pode ter até ${TAMANHO_COMPROMISSO.titulo} caracteres.`);
  });

  it('dado um processo, quando o nome do cartão fica em branco, então está certo (o cartão volta a mostrar os clientes)', () => {
    // Quando / Então
    expect(erroNoLugar(validarProcesso, processoVazio('judicial'), 'titulo', '')).toBe('');
  });
});

describe('O que se grava no próprio lugar e pelo lápis (#346)', () => {
  it('dada a descrição ou o título opcional só com espaços, quando vão para o banco, então viram nada; com texto, vão sem os espaços das pontas', () => {
    // Quando / Então
    expect(descricaoAoGravar('   ')).toBeNull();
    expect(descricaoAoGravar(' Pagar até sexta. \n')).toBe('Pagar até sexta.');
    expect(tituloOpcionalAoGravar('  ')).toBeNull();
    expect(tituloOpcionalAoGravar(' Oposição ')).toBe('Oposição');
  });

  it('dados os campos do lápis de um item já existente, quando ele grava, então o título e a descrição ficam de fora e o resto vai igual', () => {
    // Dado
    const dados = { titulo: 'Antigo', descricao: null, prazo: '2030-11-10', participantes: ['u-ana'] };
    // Quando
    const gravar = semOsCamposDoLugar(dados);
    // Então
    expect(gravar).toEqual({ prazo: '2030-11-10', participantes: ['u-ana'] });
    expect(dados).toHaveProperty('titulo', 'Antigo');
  });
});
