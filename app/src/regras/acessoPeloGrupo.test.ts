// Quem está num grupo da equipe posto no item participa dele (#378), nas regras puras de cada módulo, como no banco
// (supabase/migrations/20261119233811_grupos_da_equipe.sql). Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { Membro } from '../dados/tipos';
import { alteraAAnotacao, veAAnotacao } from './anotacao';
import { participaDoCompromisso, podeMudarCompromisso, soLeNaLista, veOCompromisso } from './compromisso';
import { estaNaDemanda, veADemanda } from './demanda';
import { alteraOProcesso } from './processo';
import { estaNaTarefa, soLeATarefaNaLista, veATarefa } from './tarefa';

const bia = { id: 'u-bia', nome: 'Bia Exemplo', papel: 'usuario' } satisfies Membro;
const ninguem = { criado_por: 'u-ana', responsavel_id: 'u-ana' };
const doGrupo = { ...ninguem, grupos: ['g-a'] };
const semChaves = { equipeVeTudo: false, equipeEditaTudo: false };

describe('Quem está pelo grupo da equipe (#378)', () => {
  it('dada uma demanda com o Núcleo A, quando a Bia está nele, então está na demanda e a vê; fora dele, não', () => {
    // Dado
    const d = { ...doGrupo, colaboradores: [] };
    // Então
    expect(estaNaDemanda(d, bia, ['g-a'])).toBe(true);
    expect(veADemanda(d, bia, [], ['g-a'])).toBe(true);
    expect(estaNaDemanda(d, bia, ['g-b'])).toBe(false);
    expect(estaNaDemanda(d, bia)).toBe(false);
  });

  it('dada uma demanda sem grupo, então estar num grupo não muda nada', () => {
    // Então
    expect(estaNaDemanda({ ...ninguem, colaboradores: [] }, bia, ['g-a'])).toBe(false);
    expect(estaNaDemanda({ ...ninguem, colaboradores: [], grupos: [] }, bia, ['g-a'])).toBe(false);
  });

  it('dada uma tarefa com o grupo, ou ligada a uma demanda com o grupo, então a Bia (do grupo) está nela e a altera na lista', () => {
    // Dado
    const t = { ...doGrupo, participantes: [] }, avulsa = { ...ninguem, participantes: [] };
    const demanda = { ...doGrupo, colaboradores: [] };
    // Então
    expect(estaNaTarefa(t, bia, null, ['g-a'])).toBe(true);
    expect(estaNaTarefa(avulsa, bia, demanda, ['g-a'])).toBe(true);
    expect(veATarefa(avulsa, bia, demanda, [], ['g-a'])).toBe(true);
    expect(soLeATarefaNaLista({ ...avulsa, equipe_da_demanda: demanda }, bia, ['g-a'])).toBe(false);
    expect(estaNaTarefa(avulsa, bia, demanda, ['g-b'])).toBe(false);
  });

  it('dado um processo com o grupo, então a Bia (do grupo) o altera; dado um compromisso do processo do grupo, então participa dele', () => {
    // Dado
    const p = { ...doGrupo, colaboradores: [] };
    const compromisso = { ...ninguem, participantes: [], geral: false };
    // Então
    expect(alteraOProcesso(p, bia, ['g-a'])).toBe(true);
    expect(alteraOProcesso(p, bia)).toBe(false);
    expect(participaDoCompromisso(compromisso, bia, p, ['g-a'])).toBe(true);
    expect(veOCompromisso({ ...compromisso, grupos: ['g-a'] }, bia, null, ['g-a'])).toBe(true);
    expect(veOCompromisso(compromisso, bia, null, ['g-a'])).toBe(false);
  });

  it('dada uma anotação com o grupo, então a Bia (do grupo) a vê e a altera; sem o grupo, não', () => {
    // Dado
    const a = { ...doGrupo, participantes: [] };
    // Então
    expect(alteraAAnotacao(a, bia, semChaves, ['g-a'])).toBe(true);
    expect(veAAnotacao(a, bia, semChaves, false, ['g-a'])).toBe(true);
    expect(veAAnotacao(a, bia, semChaves, false, [])).toBe(false);
  });
});

describe('O compromisso pelo grupo, no cartão e na lista (#378)', () => {
  it('dado um compromisso com o Núcleo A, ou do processo com ele, quando a Bia está no grupo, então ela muda o compromisso', () => {
    // Dado
    const c = { ...doGrupo, participantes: [], processo: null };
    const processo = { id: 'p1', codigo: 'P1', tipo: 'judicial' as const, numero: '1', titulo: null, cliente_nome: '', ...ninguem, colaboradores: [], grupos: ['g-a'] };
    const doProcesso = { ...ninguem, participantes: [], processo };
    // Então
    expect(podeMudarCompromisso(c, 'u-bia', false, ['g-a'])).toBe(true);
    expect(podeMudarCompromisso(doProcesso, 'u-bia', false, ['g-a'])).toBe(true);
    expect(podeMudarCompromisso(c, 'u-bia', false, ['g-b'])).toBe(false);
    expect(podeMudarCompromisso(c, 'u-bia', false)).toBe(false);
  });

  it('dado um compromisso da Agenda geral com o Núcleo A, quando a Bia está no grupo, então a lista não o trata como só para ler', () => {
    // Dado
    const c = { ...doGrupo, participantes: [], geral: true };
    // Então
    expect(soLeNaLista(c, 'u-bia', false, ['g-a'])).toBe(false);
    expect(soLeNaLista(c, 'u-bia', false, [])).toBe(true);
  });
});
