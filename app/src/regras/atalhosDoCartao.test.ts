// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { atalhosNaOrdem, ORDEM_DOS_ATALHOS, ROTULO_DO_ATALHO } from './atalhosDoCartao';

describe('Os botões rápidos do cartão (#351)', () => {
  it('dados os tipos de atalho, então cada um tem um nome curto e um lugar na linha', () => {
    // Então
    expect(Object.keys(ROTULO_DO_ATALHO).sort()).toEqual([...ORDEM_DOS_ATALHOS].sort());
    for (const t of ORDEM_DOS_ATALHOS) expect(ROTULO_DO_ATALHO[t]).toMatch(/^\S+$/);
  });

  it('dado um cartão que oferece os atalhos fora de ordem, quando a linha os põe na tela, então ficam na ordem de sempre', () => {
    // Quando
    const linha = atalhosNaOrdem(['anotacao', 'datas', 'checklist']);
    // Então
    expect(linha).toEqual(['datas', 'checklist', 'anotacao']);
  });

  it('dado o mesmo tipo oferecido duas vezes (o prazo e a seção de prazos), quando a linha os põe na tela, então há um botão só', () => {
    // Quando
    const linha = atalhosNaOrdem(['datas', 'ligacao', 'datas']);
    // Então
    expect(linha).toEqual(['datas', 'ligacao']);
  });

  it('dado um cartão sem atalhos (arquivado ou só para ler), quando a linha os põe na tela, então ela fica vazia', () => {
    // Então
    expect(atalhosNaOrdem([])).toEqual([]);
  });
});
