// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { datasDoPainel, enderecoDaFase, enderecoDoProcesso, erroDosDiasParado, fasesDoTipo, gruposDePrazos, processoParaTarefa, rotuloNoPainel, SEM_FASE } from './painelProcessos';

const HOJE = '2026-11-10';
const PROCESSO = { id: 'p1', codigo: 'ABC', tipo: 'judicial' as const, numero: '1', titulo: null, cliente_nome: 'A', responsavel_id: 'u1', colaboradores: [], clientes: ['c1', 'c2'] };
const prazo = (id: string, final: string) => ({ id, descricao: id, final, tarefa_id: null, processo: PROCESSO });

describe('Datas do painel', () => {
  it('quando calcula a partir de hoje, então os prazos vão até 7 dias, e audiências e perícias até 15', () => {
    // Então
    expect(datasDoPainel(HOJE)).toEqual({ ate_prazos: '2026-11-17', ate_marcados: '2026-11-25' });
  });

  it('quando atravessa o fim do ano, então a data continua certa', () => {
    // Então
    expect(datasDoPainel('2026-12-28')).toEqual({ ate_prazos: '2027-01-04', ate_marcados: '2027-01-12' });
  });
});

describe('Grupos de prazos', () => {
  it('quando há prazos de todo tipo, então vêm vencidos, de hoje e próximos, nessa ordem', () => {
    // Quando
    const g = gruposDePrazos([prazo('p', '2026-11-12'), prazo('v', '2026-11-01'), prazo('h', HOJE)], HOJE);
    // Então
    expect(g.map(x => [x.titulo, x.destaque, x.prazos.map(z => z.id)])).toEqual([['Vencidos', true, ['v']], ['Vencem hoje', true, ['h']], ['Próximos 7 dias', false, ['p']]]);
  });

  it('quando não há prazo de um grupo, então ele não aparece', () => {
    // Então
    expect(gruposDePrazos([prazo('p', '2026-11-12')], HOJE).map(x => x.titulo)).toEqual(['Próximos 7 dias']);
    expect(gruposDePrazos([], HOJE)).toEqual([]);
  });

  it('quando mostra o prazo, então diz quantos dias faltam ou passaram', () => {
    // Então
    expect(rotuloNoPainel({ final: '2026-11-08' }, HOJE)).toBe('Vencido há 2 dias');
    expect(rotuloNoPainel({ final: HOJE }, HOJE)).toBe('Vence hoje');
    expect(rotuloNoPainel({ final: '2026-11-13' }, HOJE)).toBe('Faltam 3 dias');
  });
});

describe('Processos em cada fase', () => {
  const COLUNAS = [{ id: 'c1', nome: 'Distribuído' }, { id: 'c2', nome: 'Sentença' }, { id: 'c3', nome: 'Vazia' }];
  const FASES = [
    { tipo: 'judicial' as const, etapa_id: 'c2', n: 3 }, { tipo: 'judicial' as const, etapa_id: 'c1', n: 2 },
    { tipo: 'judicial' as const, etapa_id: null, n: 1 }, { tipo: 'administrativo' as const, etapa_id: 'x', n: 9 }
  ];

  it('quando conta, então segue a ordem do quadro, sem as colunas vazias nem as do outro tipo, e os de fora do quadro no fim', () => {
    // Então
    expect(fasesDoTipo(FASES, 'judicial', COLUNAS, 'Sem situação')).toEqual([
      { chave: 'c1', nome: 'Distribuído', n: 2 }, { chave: 'c2', nome: 'Sentença', n: 3 }, { chave: SEM_FASE, nome: 'Sem situação', n: 1 }
    ]);
  });

  it('quando clica num número, então o endereço abre o quadro do tipo filtrado, levando "Meus" junto', () => {
    // Então
    expect(enderecoDaFase('judicial', 'c1', null)).toBe('/processos/judicial/?etapa=c1');
    expect(enderecoDaFase('administrativo', SEM_FASE, 'u1')).toBe('/processos/administrativo/?etapa=sem&pessoa=u1');
  });
});

describe('Processo no painel', () => {
  it('quando abre o cartão, então vai para o quadro do tipo dele', () => {
    // Então
    expect(enderecoDoProcesso({ id: 'p1', tipo: 'administrativo' })).toBe('/processos/administrativo/?id=p1');
  });

  it('quando cria a tarefa, então os clientes vão como a regra da tarefa recebe', () => {
    // Então
    expect(processoParaTarefa(PROCESSO).clientes).toEqual([{ id: 'c1' }, { id: 'c2' }]);
  });
});

describe('Dias sem andamento', () => {
  it.each([['1'], ['60'], ['3650']])('quando são %s dias, então vale', texto => {
    // Então
    expect(erroDosDiasParado(texto)).toBeNull();
  });

  it.each([['0'], ['3651'], ['1,5'], ['1.5'], ['abc'], ['-1']])('quando é "%s", então avisa', texto => {
    // Então
    expect(erroDosDiasParado(texto)).toBe('Use um número de 1 a 3650.');
  });
});
