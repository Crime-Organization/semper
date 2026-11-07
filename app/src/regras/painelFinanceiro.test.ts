// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { Lancamento, ParcelaDoEscritorio } from '../dados/tipos';
import {
  linhaDoCaixa,
  FILTRO_VAZIO, advogadosDaEquipe, entradasDoMes, totalRecebido, LINHAS_DO_QUADRO, carteiraDeContratos, contaNoResultado, filtrarCarteira, filtrarExtrato, mesDoAno, mesesComLancamento,
  planilhaDoExtrato, resumoDoAno, temFiltroLigado, totaisDaCarteira, totaisDoExtrato
} from './painelFinanceiro';

const HOJE = '2026-11-10';
let n = 0;
const lancamento = (extra: Partial<Lancamento>): Lancamento => ({
  id: 'l' + ++n, conta_id: 'pj', data: '2026-03-10', tipo: 'entrada', categoria: 'recebimento', valor: 1000, descricao: 'Parcela', par_id: null,
  criado_por: 'u', criado_em: '2026-03-10T10:00:00Z', atualizado_em: '2026-03-10T10:00:00Z', origem: null, ...extra
});
const parcela = (extra: Partial<ParcelaDoEscritorio>): ParcelaDoEscritorio => ({
  id: 'p' + ++n, contrato_id: 'k1', numero: 1, vencimento: '2026-10-10', valor: 50000, recebimento_id: null, recebida_em: null, recebido: null,
  contrato_codigo: 'AB12-0001-2026', cliente_nome: 'CLIENTE UM', responsavel_id: 'u1', total_parcelas: null, ...extra
});

describe('O ano no painel', () => {
  it('quando soma o ano, então cada mês tem as entradas, as saídas e o resultado, e o total é a soma dos meses', () => {
    // Dado
    const lista = [lancamento({ data: '2026-01-05', valor: 1000 }), lancamento({ data: '2026-01-20', tipo: 'saida', categoria: 'despesa', valor: 300 }),
      lancamento({ data: '2026-03-01', valor: 500 })];
    // Quando
    const { meses, total } = resumoDoAno(lista, 2026);
    // Então
    expect(meses).toHaveLength(12);
    expect(meses[0]).toMatchObject({ mes: '2026-01', entradas: 1000, saidas: 300, resultado: 700, porCategoria: { recebimento: 1000, despesa: 300 } });
    expect(meses[1]).toMatchObject({ entradas: 0, saidas: 0, resultado: 0 });
    expect(total).toMatchObject({ mes: '2026', entradas: 1500, saidas: 300, resultado: 1200 });
  });

  it('quando há repasse entre contas, ajuste de saldo ou lançamento de outro ano, então eles não entram no resultado', () => {
    // Dado
    const lista = [lancamento({ categoria: 'transferencia', valor: 9000 }), lancamento({ categoria: 'ajuste_a_mais', valor: 700 }),
      lancamento({ data: '2025-12-31', valor: 400 }), lancamento({ valor: 100 })];
    // Quando
    const { total } = resumoDoAno(lista, 2026);
    // Então
    expect(total).toMatchObject({ entradas: 100, saidas: 0 });
    expect(contaNoResultado({ categoria: 'transferencia' })).toBe(false);
    expect(contaNoResultado({ categoria: 'das' })).toBe(true);
  });

  it('quando marca os botões de mês, então só os meses do ano com lançamento ficam marcados', () => {
    // Dado
    const lista = [lancamento({ data: '2026-02-01' }), lancamento({ data: '2026-02-09' }), lancamento({ data: '2025-05-01' })];
    // Quando / Então
    expect([...mesesComLancamento(lista, 2026)]).toEqual(['2026-02']);
    expect(mesDoAno(2026, 11)).toBe('2026-12');
  });

  it('quando o quadro mostra o ano, então cada linha tira o número certo do mês', () => {
    // Dado
    const { total } = resumoDoAno([lancamento({ valor: 1000 }), lancamento({ tipo: 'saida', categoria: 'das', valor: 45 })], 2026);
    // Quando
    const resumo = LINHAS_DO_QUADRO.map(l => l.valor(total));
    // Então
    expect(resumo).toEqual([1000, 45, 955]);
  });
});

describe('O extrato', () => {
  const lista = [
    lancamento({ data: '2026-03-02', descricao: 'Aluguel da sala', tipo: 'saida', categoria: 'despesa', valor: 200000 }),
    lancamento({ data: '2026-03-20', descricao: 'Parcela 2', valor: 50000 }),
    lancamento({ data: '2026-04-01', descricao: 'Repasse', categoria: 'transferencia', conta_id: 'pf', valor: 10000 })
  ];

  it('quando filtra por mês, então vêm só os do mês, do mais novo para o mais antigo', () => {
    // Quando
    const r = filtrarExtrato(lista, { ...FILTRO_VAZIO, mes: '2026-03' });
    // Então
    expect(r.map(l => l.descricao)).toEqual(['Parcela 2', 'Aluguel da sala']);
  });

  it('quando busca sem acento, filtra por tipo e por conta, então cada filtro se soma aos outros', () => {
    // Quando / Então
    expect(filtrarExtrato(lista, { ...FILTRO_VAZIO, busca: 'ALUGUÉL' })).toHaveLength(1);
    expect(filtrarExtrato(lista, { ...FILTRO_VAZIO, busca: 'despesa' })).toHaveLength(1);
    expect(filtrarExtrato(lista, { ...FILTRO_VAZIO, tipo: 'entrada', conta: 'pj' }).map(l => l.descricao)).toEqual(['Parcela 2']);
    expect(filtrarExtrato(lista, { ...FILTRO_VAZIO, categoria: 'despesa' })).toHaveLength(1);
  });

  it('quando soma o que está na tela, então o repasse entre contas não conta como entrada', () => {
    // Quando
    const t = totaisDoExtrato(lista);
    // Então
    expect(t).toEqual({ entradas: 50000, saidas: 200000, resultado: -150000, quantos: 3 });
  });

  it('quando algum filtro além do mês está ligado, então aparece o "Limpar"', () => {
    // Quando / Então
    expect(temFiltroLigado({ ...FILTRO_VAZIO, mes: '2026-03' })).toBe(false);
    expect(temFiltroLigado({ ...FILTRO_VAZIO, busca: '  ' })).toBe(false);
    expect(temFiltroLigado({ ...FILTRO_VAZIO, conta: 'pj' })).toBe(true);
  });

  it('quando gera a planilha, então sai com ponto e vírgula, vírgula nos centavos e aspas onde o texto tem ponto e vírgula', () => {
    // Dado
    const l = [lancamento({ data: '2026-03-02', descricao: 'Luz; água', tipo: 'saida', categoria: 'despesa', valor: 123456 })];
    // Quando
    const texto = planilhaDoExtrato(l, [{ id: 'pj', nome: 'PJ' }]);
    // Então
    expect(texto.startsWith('﻿Data;Conta;Descrição;Categoria;Tipo;Valor')).toBe(true);
    expect(texto.split('\r\n')[1]).toBe('02/03/2026;PJ;"Luz; água";Despesa;Saída;1.234,56');
  });
});

describe('A carteira de contratos', () => {
  it('quando junta as parcelas, então cada contrato tem o total, o recebido, o que falta, o atraso e a próxima a receber', () => {
    // Dado
    const lista = [
      parcela({ numero: 1, vencimento: '2026-09-10', recebimento_id: 'r1', recebida_em: '2026-09-10', recebido: 48000 }),
      parcela({ numero: 2, vencimento: '2026-10-10' }),
      parcela({ numero: 3, vencimento: '2026-11-10' })
    ];
    // Quando
    const [c] = carteiraDeContratos(lista, HOJE);
    // Então
    expect(c).toMatchObject({ codigo: 'AB12-0001-2026', parcelas: 3, recebidas: 1, total: 148000, recebido: 48000, falta: 100000, atrasado: 50000, situacao: 'atrasado' });
    expect(c.proxima?.numero).toBe(2);
  });

  it('quando a parcela veio do histórico já paga, então conta como recebida, e o contrato sem nada a receber está quitado', () => {
    // Dado
    const lista = [parcela({ contrato_id: 'k2', recebida_em: '2025-01-10', recebido: 30000 })];
    // Quando
    const [c] = carteiraDeContratos(lista, HOJE);
    // Então
    expect(c).toMatchObject({ recebido: 30000, falta: 0, situacao: 'quitado', proxima: null });
  });

  it('quando ordena, então os com atraso vêm primeiro, depois os em dia pela próxima parcela, e os quitados no fim', () => {
    // Dado
    const lista = [
      parcela({ contrato_id: 'quitado', recebimento_id: 'r', recebida_em: '2026-01-01' }),
      parcela({ contrato_id: 'em-dia-tarde', vencimento: '2026-12-20' }),
      parcela({ contrato_id: 'em-dia-cedo', vencimento: '2026-11-15' }),
      parcela({ contrato_id: 'atrasado', vencimento: '2026-01-15' })
    ];
    // Quando
    const ordem = carteiraDeContratos(lista, HOJE).map(c => c.contratoId);
    // Então
    expect(ordem).toEqual(['atrasado', 'em-dia-cedo', 'em-dia-tarde', 'quitado']);
  });

  it('quando filtra e soma, então busca no código e no cliente, e os totais são os da lista filtrada', () => {
    // Dado
    const carteira = carteiraDeContratos([parcela({ contrato_id: 'a', cliente_nome: 'JOSÉ' }), parcela({ contrato_id: 'b', cliente_nome: 'MARIA', vencimento: '2026-12-01' })], HOJE);
    // Quando
    const so = filtrarCarteira(carteira, { situacao: '', busca: 'jose' });
    // Então
    expect(so.map(c => c.cliente)).toEqual(['JOSÉ']);
    expect(filtrarCarteira(carteira, { situacao: 'em_dia', busca: '' }).map(c => c.cliente)).toEqual(['MARIA']);
    expect(totaisDaCarteira(carteira)).toEqual({ total: 100000, recebido: 0, falta: 100000, atrasado: 50000 });
  });
});

describe('As entradas do mês', () => {
  const lista = [
    parcela({ numero: 1, responsavel_id: 'ana', recebimento_id: 'r1', recebida_em: '2026-03-05', recebido: 48000 }),
    parcela({ numero: 2, responsavel_id: 'bia', recebimento_id: 'r2', recebida_em: '2026-03-20' }),
    parcela({ numero: 3, responsavel_id: 'ana', recebimento_id: 'r3', recebida_em: '2026-04-01' }),
    parcela({ numero: 4, responsavel_id: 'ana', vencimento: '2026-03-10' })
  ];

  it('quando lista o mês, então vêm só as recebidas nele, da mais nova para a mais antiga, e o total soma o que entrou', () => {
    // Quando
    const r = entradasDoMes(lista, '2026-03');
    // Então
    expect(r.map(p => p.numero)).toEqual([2, 1]);
    expect(totalRecebido(r)).toBe(98000);
  });

  it('quando o master filtra por um usuário, então vêm só as entradas dos contratos dele', () => {
    // Quando / Então
    expect(entradasDoMes(lista, '2026-03', 'ana').map(p => p.numero)).toEqual([1]);
    expect(entradasDoMes(lista, '2026-03', 'carla')).toEqual([]);
  });

  it('quando a carteira é filtrada por responsável, então só ficam os contratos dele', () => {
    // Dado
    const carteira = carteiraDeContratos([parcela({ contrato_id: 'a', responsavel_id: 'ana' }), parcela({ contrato_id: 'b', responsavel_id: 'bia' })], HOJE);
    // Quando / Então
    expect(filtrarCarteira(carteira, { situacao: '', busca: '', responsavel: 'bia' }).map(c => c.contratoId)).toEqual(['b']);
  });
});

// Os indicadores (só o que já entrou) estão em graficosFinanceiros.test.ts.
describe('De quem ver os números', () => {
  it('quando lista quem escolher, então vêm só os advogados, em ordem de nome', () => {
    // Quando
    const r = advogadosDaEquipe([{ id: '1', nome: 'Zeca', funcao: 'advogado' }, { id: '2', nome: 'Ana', funcao: 'administrativo' }, { id: '3', nome: 'Bia', funcao: 'advogado' }]);
    // Então
    expect(r.map(m => m.nome)).toEqual(['Bia', 'Zeca']);
  });
});

describe('Como a linha do caixa aparece', () => {
  it('dado um lançamento que veio da planilha, quando aparece, então mostra o cliente, o serviço com a parcela e a categoria dela', () => {
    // Dado
    const l = lancamento({ tipo: 'saida', categoria: 'despesa', descricao: 'NOEL GAS LTDA - AGUA - 1/1 - BANCO INTER [Planilha 2026, aba Out, linha 196]',
      planilha: [['CLIENTE', 'NOEL GAS LTDA'], ['SERVIÇO/PRODUTOS', 'AGUA'], ['CATEGORIA', 'MANUTENÇAO DO ESCRITÓRIO'], ['REFERENCIA/PARCELA', '1/1']] });
    // Então
    expect(linhaDoCaixa(l)).toEqual({ quem: 'NOEL GAS LTDA', oQue: 'AGUA · 1/1', categoria: 'MANUTENÇAO DO ESCRITÓRIO' });
  });

  it('dado um lançamento feito no SEMPER, quando aparece, então mostra a descrição e a categoria do sistema', () => {
    // Então
    expect(linhaDoCaixa(lancamento({ categoria: 'outra_entrada', descricao: 'Aporte' }))).toEqual({ quem: 'Aporte', oQue: '', categoria: 'Outra entrada' });
  });
});
