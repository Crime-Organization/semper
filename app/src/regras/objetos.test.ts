// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { ObjetoDoEscritorio } from '../dados/tipos';
import { TAMANHO_CONTRATO } from '../dados/limites';
import {
  alcanceDaJuncao, avisoDaTroca, avisoDoObjetoEmUso, chaveParecida, contratosDoObjeto, erroDoNomeDoObjeto, OBJETO_LONGO, OBJETO_REPETIDO, OBJETO_RESERVADO,
  OBJETO_SEM_NOME, objetosNaBusca, parecidos, quemFica, semUso, textoDosContratos
} from './objetos';

const objeto = (id: string, descricao: string, campos: Partial<ObjetoDoEscritorio> = {}): ObjetoDoEscritorio =>
  ({ id, descricao, contratos_ativos: 0, contratos_arquivados: 0, demandas: 0, ...campos });
const LISTA = [
  objeto('o1', 'Registro de marca', { contratos_ativos: 3, contratos_arquivados: 1, demandas: 4 }),
  objeto('o2', 'Registro da marca.', { contratos_ativos: 1, demandas: 1 }),
  objeto('o3', 'Oposição'),
  objeto('o4', 'Registros de marcas', { contratos_arquivados: 2 })
];

describe('O nome corrigido de um objeto', () => {
  it.each([
    ['vazio', '   ', OBJETO_SEM_NOME],
    ['longo demais', 'x'.repeat(TAMANHO_CONTRATO.objeto + 1), OBJETO_LONGO],
    ['"A definir"', ' a definir ', OBJETO_RESERVADO],
    ['igual a outro da lista, com outra caixa e acento', 'oposicao', OBJETO_REPETIDO]
  ])('quando o nome é %s, então é recusado', (_caso, nome, erro) => {
    // Dado / Quando / Então
    expect(erroDoNomeDoObjeto(nome, LISTA, 'o1')).toBe(erro);
  });

  it('dado o próprio objeto, quando só a caixa muda, então pode salvar', () => {
    // Dado / Quando / Então
    expect(erroDoNomeDoObjeto('registro de Marca', LISTA, 'o1')).toBeNull();
    expect(erroDoNomeDoObjeto('Registro de marca no INPI', LISTA, 'o1')).toBeNull();
  });
});

describe('O uso de um objeto', () => {
  it('dado um objeto em contratos ativos e arquivados, quando a tabela mostra, então soma os dois e diz quantos estão arquivados', () => {
    // Dado / Quando / Então
    expect(contratosDoObjeto(LISTA[0])).toBe(4);
    expect(textoDosContratos(LISTA[0])).toBe('3 + 1 arquivado');
    expect(textoDosContratos(LISTA[3])).toBe('0 + 2 arquivados');
    expect(textoDosContratos(LISTA[1])).toBe('1');
  });

  it('dado um objeto só em contratos arquivados, quando se pergunta se está sem uso, então não está (o arquivado também guarda o objeto)', () => {
    // Dado / Quando / Então
    expect(semUso(LISTA[3])).toBe(false);
    expect(semUso(LISTA[2])).toBe(true);
  });

  it('quando se tenta apagar um objeto em uso, então o aviso diz em quantos contratos ele está, no singular e no plural', () => {
    // Dado / Quando / Então
    expect(avisoDoObjetoEmUso(1)).toBe('Este objeto está em 1 contrato. Troque-o por outro antes de apagar: marque os dois e use Juntar.');
    expect(avisoDoObjetoEmUso(3)).toBe('Este objeto está em 3 contratos. Troque-o por outro antes de apagar: marque os dois e use Juntar.');
  });
});

describe('A busca e os parecidos', () => {
  it('quando se busca sem acento, então acha o objeto; sem termo, vêm todos', () => {
    // Dado / Quando / Então
    expect(objetosNaBusca(LISTA, 'oposicao').map(o => o.id)).toEqual(['o3']);
    expect(objetosNaBusca(LISTA, '  ')).toHaveLength(LISTA.length);
  });

  it('dados nomes com pontuação, palavra de ligação e plural diferentes, quando a lista é conferida, então eles são parecidos entre si', () => {
    // Dado / Quando
    const r = parecidos(LISTA);
    // Então
    expect(chaveParecida('Registro da marca.')).toBe(chaveParecida('registros de marcas'));
    expect(r.get('o1')).toEqual(['Registro da marca.', 'Registros de marcas']);
    expect(r.has('o3')).toBe(false);
  });
});

describe('Juntar objetos', () => {
  it('dados os marcados, quando se escolhe quem fica, então é o mais usado', () => {
    // Dado / Quando / Então
    expect(quemFica([LISTA[1], LISTA[0], LISTA[3]])?.id).toBe('o1');
    expect(quemFica([])).toBeNull();
  });

  it('quando a junção vai ser confirmada, então diz o que sai e quanto muda, e que não dá para desfazer', () => {
    // Dado / Quando / Então
    expect(alcanceDaJuncao([LISTA[0], LISTA[1]], 'o1')).toBe('Sai 1 objeto, usado em 1 contrato e 1 demanda. Ele passa a ter o nome do que fica. Não dá para desfazer.');
    expect(alcanceDaJuncao([LISTA[0], LISTA[1], LISTA[3]], 'o1'))
      .toBe('Saem 2 objetos, usados em 3 contratos e 1 demanda. Eles passam a ter o nome do que fica. Não dá para desfazer.');
  });
});

describe('O aviso depois da troca', () => {
  it('quando um objeto é corrigido, então o aviso diz em quantos contratos e demandas mudou', () => {
    // Dado / Quando / Então
    expect(avisoDaTroca('corrigir', 'Parecer', { contratos: 1, demandas: 0, modelos: 0, contratos_com_duas_demandas: 0 }))
      .toBe('Objeto corrigido: "Parecer". Mudou em 1 contrato e 0 demandas.');
  });

  it('quando objetos são juntados, então o aviso diz também o modelo de lista e os contratos com duas demandas', () => {
    // Dado / Quando / Então
    expect(avisoDaTroca('juntar', 'Registro de marca', { contratos: 2, demandas: 3, modelos: 1, contratos_com_duas_demandas: 2 }))
      .toBe('Objetos juntados em "Registro de marca". Mudou em 2 contratos e 3 demandas. O modelo de lista mudou junto. 2 contratos ficaram com duas demandas do mesmo objeto: confira.');
  });
});
