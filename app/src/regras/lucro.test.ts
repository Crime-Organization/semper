// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { MovimentoDoLucro } from '../dados/tipos';
import { dividirRecebimento, type Recebimento } from './financeiro';
import { anosDoLucro, avisoDaRetirada, dadosDaRetirada, emAbertoComoResponsavel, errosDaRetirada, lucroDoAno, parteDoSocio, retiradaNova, rotuloDoEmAberto, totalDasLinhas } from './lucro';

const SEM_MOVIMENTO: MovimentoDoLucro = { recebimentos: [], indicacoes: [], retiradas: [] };
const RECEBIMENTO: Recebimento = { valor: 100000, parteNaConta: 100, contaComDas: true, aliquotaDas: 4.5, taxaMaquina: 3000, terceiros: [], socioIndicador: null, responsavelSocio: true };
const entrada = (data: string, pessoa_id = 's1', nome = 'SÓCIA UM') => ({ data, pessoa_id, nome, liquido: 92500, terceiros: [] });
const retirada = (data: string, valor: number, pessoa_id = 's1', nome = 'SÓCIA UM') => ({ id: data, pessoa_id, nome, conta_id: 'c', data, valor, descricao: 'x' });
const SOCIA = { pessoa_id: 's1', nome: 'SÓCIA UM', desde: '2020-01-01', ate: null };

describe('Parte do sócio responsável', () => {
  it('dado o exemplo confirmado, quando recebe, então a parte dele é a da planilha, e os 30% ficam com o escritório', () => {
    // Dado / Quando / Então
    expect(parteDoSocio({ liquido: 92500, terceiros: [] })).toBe(64750);
  });

  it('dado um terceiro de 10%, quando recebe, então o escritório fica com 20%, e o terceiro sai da conta', () => {
    // Dado / Quando / Então
    expect(parteDoSocio({ liquido: 92500, terceiros: [{ valor: 9250 }] })).toBe(64750);
  });

  it('dado que os terceiros levam tudo, quando recebe, então a parte não fica negativa', () => {
    // Dado / Quando / Então
    expect(parteDoSocio({ liquido: 1000, terceiros: [{ valor: 800 }, { valor: 200 }] })).toBe(0);
  });

  it.each([
    ['sem terceiro', []],
    ['com um terceiro de 10%', [{ id: 't', percentual: 10 }]],
    ['com dois terceiros', [{ id: 't', percentual: 10 }, { id: 'u', percentual: 7.5 }]]
  ])('quando é %s, então é o mesmo que ficaria com quem não é sócio', (_caso, terceiros) => {
    // Dado
    const comoSocio = dividirRecebimento({ ...RECEBIMENTO, terceiros });
    const semSerSocio = dividirRecebimento({ ...RECEBIMENTO, terceiros, responsavelSocio: false });
    // Quando / Então
    expect(parteDoSocio(comoSocio)).toBe(semSerSocio.responsavelFica);
  });
});

describe('Lucro do ano', () => {
  it('dado recebimentos em dois meses e um pagamento, quando olha o ano, então acumula por mês e o em aberto é o resto', () => {
    // Dado
    const m = { ...SEM_MOVIMENTO, recebimentos: [entrada('2026-02-10'), entrada('2026-02-20'), entrada('2026-10-01')], retiradas: [retirada('2026-11-05', 100000)] };
    // Quando
    const [linha] = lucroDoAno(m, [SOCIA], 2026).responsavel;
    // Então
    expect(linha.meses[1]).toBe(129500);
    expect(linha.meses[9]).toBe(64750);
    expect(linha.pago).toBe(100000);
    expect(linha.anterior).toBe(0);
    expect(linha.emAberto).toBe(94250);
  });

  it('dado o que ficou em aberto no ano anterior, quando olha o ano seguinte, então vem como anterior e soma no em aberto', () => {
    // Dado
    const m = { ...SEM_MOVIMENTO, recebimentos: [entrada('2025-12-31'), entrada('2026-01-01')], retiradas: [retirada('2025-12-31', 4750)] };
    // Quando
    const [linha] = lucroDoAno(m, [SOCIA], 2026).responsavel;
    // Então
    expect(linha.anterior).toBe(60000);
    expect(linha.meses[0]).toBe(64750);
    expect(linha.emAberto).toBe(124750);
  });

  it('dado movimento em ano depois do escolhido, quando olha o ano, então ele não conta', () => {
    // Dado
    const m = { ...SEM_MOVIMENTO, recebimentos: [entrada('2027-01-01')], retiradas: [retirada('2027-01-02', 100)] };
    // Quando
    const [linha] = lucroDoAno(m, [SOCIA], 2026).responsavel;
    // Então
    expect(linha.emAberto).toBe(0);
    expect(linha.pago).toBe(0);
  });

  it('dado um sócio que indicou e foi responsável, quando olha o ano, então as duas contas nunca se misturam', () => {
    // Dado
    const m = {
      ...SEM_MOVIMENTO, recebimentos: [entrada('2026-03-10')], retiradas: [retirada('2026-03-20', 64750)],
      indicacoes: [{ data: '2026-03-10', pessoa_id: 's1', nome: 'SÓCIA UM', valor: 10000, pago_em: null }, { data: '2026-04-10', pessoa_id: 's1', nome: 'SÓCIA UM', valor: 5000, pago_em: '2026-05-01' }]
    };
    // Quando
    const { responsavel: [r], indicador: [i] } = lucroDoAno(m, [SOCIA], 2026);
    // Então: pagar o lucro não abate a indicação, nem o contrário
    expect(r).toMatchObject({ pago: 64750, emAberto: 0 });
    expect(i).toMatchObject({ pago: 5000, emAberto: 10000 });
    expect(i.meses[2]).toBe(10000);
  });

  it('dado quem saiu da lista e ainda tem valores, quando olha o ano, então continua aparecendo; quem saiu antes e não tem nada, não', () => {
    // Dado
    const m = { ...SEM_MOVIMENTO, recebimentos: [entrada('2025-03-10', 's2', 'SÓCIO DOIS')] };
    const socios = [SOCIA, { pessoa_id: 's2', nome: 'SÓCIO DOIS', desde: '2020-01-01', ate: '2025-06-30' }, { pessoa_id: 's3', nome: 'SÓCIO TRÊS', desde: '2020-01-01', ate: '2024-06-30' }];
    // Quando
    const nomes = lucroDoAno(m, socios, 2026).responsavel.map(l => l.nome);
    // Então
    expect(nomes).toEqual(['SÓCIA UM', 'SÓCIO DOIS']);
  });

  it('dado que retirou mais do que acumulou, quando olha o ano, então o em aberto fica negativo', () => {
    // Dado
    const m = { ...SEM_MOVIMENTO, retiradas: [retirada('2026-01-05', 1000)] };
    // Quando / Então
    expect(lucroDoAno(m, [SOCIA], 2026).responsavel[0].emAberto).toBe(-1000);
  });

  it('dado duas linhas, quando soma, então cada coluna tem o total', () => {
    // Dado
    const m = { ...SEM_MOVIMENTO, recebimentos: [entrada('2026-01-05'), entrada('2026-01-05', 's2', 'SÓCIO DOIS')], retiradas: [retirada('2026-02-01', 1000)] };
    // Quando
    const total = totalDasLinhas(lucroDoAno(m, [], 2026).responsavel);
    // Então
    expect(total.meses[0]).toBe(129500);
    expect(total).toMatchObject({ anterior: 0, pago: 1000, emAberto: 128500 });
  });
});

describe('Anos e em aberto até hoje', () => {
  it('dado movimento de anos antes, quando lista, então vai de hoje até o primeiro, do mais novo ao mais antigo', () => {
    // Dado / Quando / Então
    expect(anosDoLucro({ ...SEM_MOVIMENTO, recebimentos: [entrada('2024-05-01')] }, '2026-11-03', 2026)).toEqual([2026, 2025, 2024]);
    expect(anosDoLucro(SEM_MOVIMENTO, '2026-11-03', 2026)).toEqual([2026]);
  });

  it('dado um ano escolhido que ficou sem movimento, quando lista, então ele continua na lista', () => {
    // Dado / Quando / Então
    expect(anosDoLucro(SEM_MOVIMENTO, '2026-11-03', 2024)).toEqual([2026, 2025, 2024]);
  });

  it('dado um ano que já passou, quando mostra a coluna, então diz que é o em aberto do fim dele', () => {
    // Dado / Quando / Então
    expect(rotuloDoEmAberto(2025, '2026-11-03')).toBe('Em aberto no fim de 2025');
    expect(rotuloDoEmAberto(2026, '2026-11-03')).toBe('Em aberto');
  });

  it('dado dois sócios, quando calcula, então o em aberto é só o de cada um, de todos os anos', () => {
    // Dado
    const m = { ...SEM_MOVIMENTO, recebimentos: [entrada('2025-01-01'), entrada('2026-01-01'), entrada('2026-01-01', 's2', 'SÓCIO DOIS')], retiradas: [retirada('2026-02-01', 29500)] };
    // Quando / Então
    expect(emAbertoComoResponsavel(m, 's1')).toBe(100000);
    expect(emAbertoComoResponsavel(m, 's2')).toBe(64750);
  });
});

describe('Pagar o lucro', () => {
  const CONTA = { saldo_inicial_em: '2026-01-01' };

  it('dado o em aberto, quando abre o formulário, então o valor já vem preenchido; sem nada em aberto, vem vazio', () => {
    // Dado / Quando / Então
    expect(retiradaNova('s1', 'c', '2026-11-03', 64750).valor).toBe('647,50');
    expect(retiradaNova('s1', 'c', '2026-11-03', 0).valor).toBe('');
    expect(retiradaNova('s1', 'c', '2026-11-03', -100).valor).toBe('');
  });

  it.each([
    ['sem sócio', { pessoaId: '' }, 'pessoaId', 'Escolha o sócio.'],
    ['sem conta', { contaId: '' }, 'contaId', 'Escolha a conta.'],
    ['data inválida', { data: '2026-02-31' }, 'data', 'Informe uma data válida.'],
    ['antes do início da conta', { data: '2025-12-31' }, 'data', 'A conta começa depois dessa data.'],
    ['sem valor', { valor: '' }, 'valor', 'Informe o valor.'],
    ['descrição longa', { descricao: 'x'.repeat(301) }, 'descricao', 'Use até 300 caracteres.']
  ])('quando há %s, então avisa no campo', (_caso, mudanca, campo, mensagem) => {
    // Dado
    const f = { ...retiradaNova('s1', 'c', '2026-11-03', 64750), ...mudanca };
    // Quando / Então
    expect(errosDaRetirada(f, CONTA)).toEqual({ [campo]: mensagem });
  });

  it('dado um valor maior que o em aberto, quando digita, então avisa, sem impedir', () => {
    // Dado
    const f = { ...retiradaNova('s1', 'c', '2026-11-03', 64750), valor: '6.475,00' };
    // Quando / Então
    expect(avisoDaRetirada(f, 64750)?.replace(/\s/g, ' ')).toBe('Isso passa do que está em aberto (R$ 647,50). Confira o valor: o sócio ficará com saldo negativo.');
    expect(errosDaRetirada(f, CONTA)).toEqual({});
    expect(avisoDaRetirada({ ...f, valor: '647,50' }, 64750)).toBeNull();
    expect(avisoDaRetirada({ ...f, valor: '' }, 64750)).toBeNull();
  });

  it('dado o formulário certo, quando grava, então vai em centavos e sem espaços', () => {
    // Dado
    const f = { ...retiradaNova('s1', 'c', '2026-11-03', 64750), descricao: '  Outubro ' };
    // Quando / Então
    expect(errosDaRetirada(f, CONTA)).toEqual({});
    expect(dadosDaRetirada(f)).toEqual({ pessoa: 's1', conta: 'c', data: '2026-11-03', valor: 64750, descricao: 'Outubro' });
  });
});
