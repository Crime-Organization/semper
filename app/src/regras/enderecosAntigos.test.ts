// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { enderecoNovoDaAnotacaoNova } from './anotacao';
import { ENDERECOS_ANTIGOS, enderecoNovo } from './enderecosAntigos';

describe('Os endereços antigos', () => {
  it.each([
    ['/parcelas/', '/financeiro/direitos/'],
    ['/parcelas', '/financeiro/direitos/'],
    ['/financeiro/receitas/', '/financeiro/direitos/'],
    ['/financeiro/despesas/', '/financeiro/obrigacoes/'],
    ['/processos/extrajudicial/', '/processos/administrativo/'],
    ['/processos/investigacao/', '/processos/administrativo/']
  ])('dado o endereço antigo %s, quando alguém o abre, então vai para %s', (antigo, novo) => {
    // Quando / Então
    expect(enderecoNovo(antigo)).toBe(novo);
  });

  it('dada a anotação nova pelo endereço antigo, quando alguém o abre, então vai a Documentos com o que vinha na busca', () => {
    // Dado
    const busca = '?nova=1&pasta=pa1';
    // Quando / Então
    expect(enderecoNovo('/documentos/nova/', busca)).toBe(enderecoNovoDaAnotacaoNova(busca));
    expect(enderecoNovo('/documentos/nova/', busca)).toMatch(/^\/documentos\//);
  });

  it.each(['/processos/extrajudicial/', '/processos/investigacao/'])(
    'dado o cartão de um processo aberto pelo endereço antigo %s (#406), quando alguém o abre, então vai aos administrativos com o mesmo cartão', antigo => {
      // Quando / Então
      expect(enderecoNovo(antigo, '?id=p1')).toBe('/processos/administrativo/?id=p1');
    });

  it('dado um endereço que existe hoje, quando alguém o abre, então não há desvio', () => {
    // Quando / Então
    for (const atual of ['/processos/administrativo/', '/processos/judicial/', '/financeiro/', '/financeiro/contas/', '/meus-valores/', '/conferencia/', '/lucros/', '/inicio/']) expect(enderecoNovo(atual)).toBeNull();
  });

  it('dada a tabela, quando se olha cada destino, então nenhum leva a outro endereço antigo (não há volta em círculo)', () => {
    // Quando
    const destinos = Object.values(ENDERECOS_ANTIGOS).map(destino => destino('').split('?')[0]);
    // Então
    for (const destino of destinos) expect(enderecoNovo(destino)).toBeNull();
  });
});
