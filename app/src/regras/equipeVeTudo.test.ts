// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { advogadoNaAdaptacao, equipeEditaTudo, equipeVeTudo, soLeOCartao } from './equipeVeTudo';
import { alteraOProcesso } from './processo';
import { soLeATarefaNaLista } from './tarefa';

describe('Toda a equipe vê os cartões (#271)', () => {
  it.each([
    [{ modulos: { equipe_ve_tudo: true } }, true],
    [{ modulos: { equipe_ve_tudo: false } }, false],
    [{ modulos: {} }, false],
    [null, false]
  ])('dado o escritório %j, quando se confere a chave, então é %s', (escritorio, esperado) => {
    // Então
    expect(equipeVeTudo(escritorio)).toBe(esperado);
  });

  it.each([
    [true, false, true],
    [true, true, false],
    [false, false, false],
    [false, true, false]
  ])('dada a chave %s e estar no cartão %s, quando se confere, então só ler é %s', (ligada, estaNele, esperado) => {
    // Então
    expect(soLeOCartao({ escritorio: { modulos: { equipe_ve_tudo: ligada } }, perfil: 'eu' }, () => estaNele)).toBe(esperado);
  });

  it.each([
    [true, 'advogado', true],
    [true, 'estagiario', false],
    [true, 'administrativo', false],
    [false, 'advogado', false]
  ])('dada a chave %s e a função %s, quando se confere a fase de adaptação, então vale %s', (ligada, funcao, esperado) => {
    // Então
    expect(advogadoNaAdaptacao({ escritorio: { modulos: { equipe_ve_tudo: ligada } }, perfil: { funcao } })).toBe(esperado);
  });

  it('dada a fase de adaptação, quando alguém não está no cartão, então não fica só lendo', () => {
    // Dado
    const ctx = { escritorio: { modulos: { equipe_ve_tudo: true, equipe_edita_tudo: true } }, perfil: 'eu' };
    // Então
    expect(equipeEditaTudo(ctx.escritorio)).toBe(true);
    expect(soLeOCartao(ctx, () => false)).toBe(false);
  });

  const processo = { criado_por: 'u-criou', responsavel_id: 'u-resp', colaboradores: ['u-colab'] };
  it.each([
    ['u-criou', 'usuario', true],
    ['u-resp', 'usuario', true],
    ['u-colab', 'usuario', true],
    ['u-admin', 'admin', true],
    ['u-master', 'master', true],
    ['u-fora', 'usuario', false]
  ])('dado o processo, quando %s (%s) tenta alterar, então poder é %s', (id, papel, esperado) => {
    // Então
    expect(alteraOProcesso(processo, { id, papel })).toBe(esperado);
  });

  const tarefa = { criado_por: 'u-criou', responsavel_id: 'u-resp', participantes: [], demanda_codigo: null };
  it('dada uma tarefa sem demanda e alguém de fora dela, quando a lista confere, então essa pessoa só lê', () => {
    // Então
    expect(soLeATarefaNaLista(tarefa, { id: 'u-fora', papel: 'usuario' })).toBe(true);
    expect(soLeATarefaNaLista(tarefa, { id: 'u-resp', papel: 'usuario' })).toBe(false);
    expect(soLeATarefaNaLista(tarefa, { id: 'u-fora', papel: 'admin' })).toBe(false);
  });

  it('dada uma tarefa ligada a uma demanda, quando a lista confere, então deixa a palavra final para o banco', () => {
    // Então
    expect(soLeATarefaNaLista({ ...tarefa, demanda_codigo: 'D1' }, { id: 'u-fora', papel: 'usuario' })).toBe(false);
  });
});
