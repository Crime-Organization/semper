// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { coisasDoMenu, NOME_NO_MENU, nomeDoVer, ORDEM_DOS_ATALHOS } from './atalhosDoCartao';

describe('O menu "Acrescentar ao cartão" (#399)', () => {
  it('dados os tipos de coisa do cartão, então cada um tem um nome no menu e um lugar na ordem', () => {
    // Então
    expect(Object.keys(NOME_NO_MENU).sort()).toEqual([...ORDEM_DOS_ATALHOS].sort());
    for (const t of ORDEM_DOS_ATALHOS) expect(NOME_NO_MENU[t]).toMatch(/^\S+$/);
  });

  it('dado um cartão que oferece as coisas fora de ordem, quando o menu as mostra, então ficam na ordem de sempre', () => {
    // Quando
    const linhas = coisasDoMenu([{ tipo: 'anotacao', quantidade: 0 }, { tipo: 'datas' }, { tipo: 'checklist', quantidade: 2 }]);
    // Então
    expect(linhas.map(l => l.tipo)).toEqual(['datas', 'checklist', 'anotacao']);
  });

  it('dado o mesmo tipo oferecido duas vezes (o prazo e a seção de prazos), quando o menu as mostra, então há uma linha só, a da seção, com a contagem', () => {
    // Quando
    const linhas = coisasDoMenu([{ tipo: 'datas', quantidade: undefined }, { tipo: 'ligacao', quantidade: 1 }, { tipo: 'datas', quantidade: 3 }]);
    // Então
    expect(linhas).toEqual([{ tipo: 'datas', quantidade: 3 }, { tipo: 'ligacao', quantidade: 1 }]);
  });

  it('dado um cartão sem nada a oferecer, quando o menu as mostra, então ele fica vazio', () => {
    // Então
    expect(coisasDoMenu([])).toEqual([]);
  });

  it('dada uma linha com e sem contagem, quando o leitor de tela a lê, então ouve o que ela faz e quantas há', () => {
    // Então
    expect(nomeDoVer({ tipo: 'checklist', quantidade: 2 })).toBe('Ver checklists (2)');
    expect(nomeDoVer({ tipo: 'anotacao', quantidade: 0 })).toBe('Ver anotações (0)');
    expect(nomeDoVer({ tipo: 'datas' })).toBe('Ver datas');
  });
});
