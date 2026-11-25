// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O papel do cliente escrito pela equipe no processo (#443): a limpeza e a comparação dos nomes, o texto que vira papel, os valores
// do select, as opções do grupo "Do escritório", o que vai para a lista do escritório e o que o banco faz ao gravar (o fictício usa
// as mesmas regras).
import { describe, expect, it } from 'vitest';
import {
  chaveDoPapel, ESCREVER_O_PAPEL, ESCREVER_PAPEL, escreverOPapelDe, escritosAoGravar, limparPapelEscrito, nomesParaALista, opcoesDoPapel, papelDoTexto,
  papelDoValor, papelNaLista, valorDoPapel, valorSugeridoDoCliente
} from './papelEscrito';

describe('Limpar e comparar os nomes', () => {
  it('dado um nome com espaços nas pontas e repetidos, quando limpa, então sobra um espaço entre as palavras', () => {
    expect(limparPapelEscrito('  Inventariante   do\tespólio ')).toBe('Inventariante do espólio');
  });

  it('dados dois nomes que só mudam nas maiúsculas, nos acentos e nos espaços, quando compara, então são o mesmo papel', () => {
    expect(chaveDoPapel(' INVENTARIANTE  do Espolio')).toBe(chaveDoPapel('inventariante do espólio'));
    expect(chaveDoPapel('Herdeiro')).not.toBe(chaveDoPapel('Herdeira'));
  });

  it('dada a lista do escritório, quando procura um nome com outra grafia, então acha o da lista; sem ele, nada', () => {
    expect(papelNaLista(['Curador', 'Inventariante'], ' inventariante ')).toBe('Inventariante');
    expect(papelNaLista(['Curador'], 'Inventariante')).toBeNull();
  });
});

describe('O texto escrito vira um papel', () => {
  const lista = ['Inventariante'];

  it('dado um texto vazio (ou só espaços), quando escreve, então não há papel', () => {
    expect(papelDoTexto('   ', lista)).toBeNull();
  });

  it('dado o nome de um papel da lista fixa, quando escreve, então fica com o papel fixo, sem nome escrito', () => {
    expect(papelDoTexto(' réu ', lista)).toEqual({ papel: 'reu' });
    expect(papelDoTexto('testemunha', lista)).toEqual({ papel: 'testemunha' });
  });

  it('dado o nome de um papel de propriedade intelectual, quando escreve, então fica com o papel fixo, e não com um nome escrito', () => {
    expect(papelDoTexto('inventor', lista)).toEqual({ papel: 'inventor' });
    expect(papelDoTexto('AUTOR DA CRIACAO', lista)).toEqual({ papel: 'autor_da_criacao' });
  });

  it('dado um nome que já está na lista do escritório, quando escreve com outra grafia, então usa o da lista, sem repetir', () => {
    expect(papelDoTexto(' INVENTARIANTE', lista)).toEqual({ papel: 'outro', escrito: 'Inventariante', escritoAgora: true });
  });

  it('dado um nome novo, quando escreve, então é o papel outro com o nome limpo, escrito agora', () => {
    expect(papelDoTexto('  Curador   especial ', lista)).toEqual({ papel: 'outro', escrito: 'Curador especial', escritoAgora: true });
  });
});

describe('A janela de escrever', () => {
  it('dado um processo com mais de um cliente, quando abre, então o título diz de quem é o papel; com um só, não', () => {
    expect(escreverOPapelDe('CLIENTE UM')).toBe('Escrever o nome do papel de CLIENTE UM');
    expect(escreverOPapelDe(null)).toBe(ESCREVER_O_PAPEL);
  });
});

describe('O valor das opções do select', () => {
  it('dado um papel fixo ou um escrito, quando vira valor e volta, então é o mesmo papel', () => {
    expect(papelDoValor(valorDoPapel('reu'))).toEqual({ papel: 'reu' });
    expect(papelDoValor(valorDoPapel('outro', 'Inventariante'))).toEqual({ papel: 'outro', escrito: 'Inventariante' });
    expect(papelDoValor(valorDoPapel('outro'))).toEqual({ papel: 'outro' });
  });

  it('dada a opção vazia ou a de escrever, quando lê o valor, então não há papel', () => {
    expect(valorDoPapel(undefined)).toBe('');
    expect(papelDoValor('')).toBeNull();
    expect(papelDoValor(ESCREVER_PAPEL)).toBeNull();
  });

  it('dado um nome escrito num papel que não é outro, quando vira valor, então fica o papel fixo', () => {
    expect(valorDoPapel('autor', 'Inventariante')).toBe('autor');
  });
});

describe('O grupo "Do escritório" do select', () => {
  it('dada a lista e os nomes do formulário, quando monta as opções, então cada nome aparece uma vez, em ordem alfabética', () => {
    const opcoes = opcoesDoPapel(['Inventariante', 'Curador'], ['inventariante', 'Herdeiro', undefined, null]);
    expect(opcoes.map(o => o.nome)).toEqual(['Curador', 'Herdeiro', 'Inventariante']);
    expect(opcoes.map(o => papelDoValor(o.valor))).toContainEqual({ papel: 'outro', escrito: 'Herdeiro' });
  });

  it('dado um papel que saiu da lista, quando o processo ainda o usa, então ele continua entre as opções', () => {
    expect(opcoesDoPapel([], ['Inventariante']).map(o => o.nome)).toEqual(['Inventariante']);
  });
});

describe('O que vai para a lista do escritório', () => {
  it('dados os nomes escritos agora, quando o processo é gravado, então vão os que ele ainda usa, cada um uma vez', () => {
    // Dado: escreveu Curador e depois trocou por Inventariante; escreveu Herdeiro duas vezes
    const agora = ['Curador', 'Inventariante', 'Herdeiro', 'herdeiro'];
    // Quando / Então
    expect(nomesParaALista(agora, { a: 'Inventariante', b: 'Herdeiro' })).toEqual(['Inventariante', 'Herdeiro']);
  });

  it('dado um nome copiado de outro processo ou devolvido, quando ninguém o escreveu agora, então nada vai para a lista', () => {
    expect(nomesParaALista([], { a: 'Inventariante' })).toEqual([]);
  });
});

describe('Ao gravar o processo (como o gatilho do banco)', () => {
  it('dados nomes escritos, quando grava, então só o cliente com o papel outro guarda o nome, limpo', () => {
    const r = escritosAoGravar({ a: '  Inventariante   do  espólio ', b: 'Herdeiro', c: 'Curador', d: '   ' }, { a: 'outro', b: 'autor', d: 'outro' }, ['a', 'b', 'd']);
    expect(r).toEqual({ a: 'Inventariante do espólio' });
  });

  it('dado um processo com clientes, quando a pergunta do papel abre, então já traz o papel do primeiro (com o nome escrito)', () => {
    expect(valorSugeridoDoCliente({ a: 'outro' }, { a: 'Inventariante' })).toBe(valorDoPapel('outro', 'Inventariante'));
    expect(valorSugeridoDoCliente({ a: 'reu' }, {})).toBe('reu');
    expect(valorSugeridoDoCliente(undefined, undefined)).toBe('autor');
  });
});
