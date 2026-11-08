// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { codigoDeBancoValido, contaDeDestino, nomeDoBanco, receitasDoRecebimento, textosDoRecebimento, tipoDoRecebimento } from './recebimento';

const CONTEXTO = {
  codigo: 'MA24-AG39-108/26', clientes: ['Agencia Digital LEF Ltda'], objetos: ['Defesa processual/contestação'],
  responsavel: 'Mateus Freitas Gonçalves', participantes: ['Olenka Caroline de Freitas Cardoso'], parcela: '2/2'
};
const RECEBIMENTO = {
  data: '2026-09-28', valor: 119375, parte_na_conta: 20, na_conta: 23875, responsavel_fica: 40000, escritorio_final: 23875,
  terceiros: [{ id: 'p-ind', nome: 'Indicador', percentual: 20, papel: 'indicador' as const, valor: 23875 }, { id: 'p-par', nome: 'Olenka', percentual: 10, papel: 'participante' as const, valor: 9000 }],
  socio_indicador: null
};

describe('O texto de cada um, para mandar com o comprovante', () => {
  it('dado um recebimento com indicador e participante, quando gera os textos, então vêm no formato da planilha', () => {
    // Quando
    const textos = textosDoRecebimento(RECEBIMENTO, CONTEXTO);
    // Então
    expect(textos.map(t => t.quem)).toEqual(['escritorio', 'indicador', 'participante']);
    expect(textos[0].texto).toBe('20% - ENTRADA - MA24-AG39-108/26 - AGENCIA DIGITAL LEF LTDA - DEFESA PROCESSUAL/CONTESTAÇÃO - MATEUS FREITAS GONÇALVES/OLENKA CAROLINE DE FREITAS CARDOSO - 2/2 - R$ 238,75 - 28/09/2026');
    expect(textos[1].texto).toMatch(/^20% - SAÍDA - .* - R\$\s238,75 - 28\/09\/2026$/);
    expect(textos[2].texto).toMatch(/^10% - SAÍDA - .* - R\$\s90,00 - 28\/09\/2026$/);
  });

  it('dado um sócio que indicou, quando gera os textos, então ele aparece com os 10%', () => {
    // Quando
    const textos = textosDoRecebimento({ ...RECEBIMENTO, terceiros: [], socio_indicador: { id: 's1', nome: 'Sócio', valor: 11937 } }, CONTEXTO);
    // Então
    expect(textos[1]).toMatchObject({ quem: 'socio_indicador', percentual: 10, valor: 11937 });
  });
});

describe('As receitas de um recebimento', () => {
  it('dado um recebimento, quando soma, então separa a bruta, a líquida do responsável e os repasses', () => {
    // Então
    expect(receitasDoRecebimento(RECEBIMENTO)).toEqual({ bruta: 119375, liquidaDoResponsavel: 40000, escritorio: 23875, indicadores: 23875, participantes: 9000 });
  });

  it('dado um recebimento de antes, sem o tipo, quando lê o tipo, então vale o do contrato', () => {
    // Então
    expect(tipoDoRecebimento({ categoria: null }, 'pro_labore')).toBe('pro_labore');
    expect(tipoDoRecebimento({ categoria: 'quota_litis' }, 'pro_labore')).toBe('quota_litis');
  });
});

describe('Os bancos', () => {
  it.each([['077', 'Banco Inter', true], ['999', '999', true], ['77', '', false]])('dado o código %s, quando mostra, então aparece "%s"', (codigo, nome, valido) => {
    // Então
    expect(nomeDoBanco(codigo)).toContain(nome);
    expect(codigoDeBancoValido(codigo)).toBe(valido);
  });
});

describe('Conta de destino do contrato (#269)', () => {
  const ativas = [{ id: 'pj' }, { id: 'pf' }];
  it.each([
    ['uma conta ativa', 'pf', { contaId: 'pf', arquivada: false }],
    ['uma conta que foi arquivada', 'antiga', { contaId: '', arquivada: true }],
    ['nenhuma conta', null, { contaId: '', arquivada: false }]
  ] as const)('dado o contrato com %s, quando abre a nova entrada, então a conta escolhida é a certa', (_caso, destino, esperado) => {
    // Quando
    const conta = contaDeDestino(destino, ativas);
    // Então
    expect(conta).toEqual(esperado);
  });

  it('dado as contas ainda carregando, quando confere o destino, então não acusa conta arquivada', () => {
    // Então
    expect(contaDeDestino('pf', [])).toEqual({ contaId: '', arquivada: false });
  });
});
