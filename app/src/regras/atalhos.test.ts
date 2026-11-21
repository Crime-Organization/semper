// Atalhos de teclado das páginas de módulo (#86). Padrão Dado / Quando / Então: app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { ATALHOS, atalhoDaTecla, dicaComAtalho, ehLugarDeEscrever, ehTeclaSozinha, listaDeAtalhos, type TeclaApertada } from './atalhos';

const tecla = (key: string, extra: Partial<TeclaApertada> = {}): TeclaApertada => ({ key, ctrlKey: false, altKey: false, metaKey: false, ...extra });
const LIVRE = { escrevendo: false, algoPorCima: false };

describe('Qual atalho a tecla pede', () => {
  it('dada a página sem nada aberto, quando a pessoa aperta "/", "N" ou "?", então pede a busca, o novo e a lista', () => {
    // Quando / Então
    expect(atalhoDaTecla(tecla('/'), LIVRE)).toBe('buscar');
    expect(atalhoDaTecla(tecla('n'), LIVRE)).toBe('novo');
    expect(atalhoDaTecla(tecla('?'), LIVRE)).toBe('atalhos');
  });

  it('dado o Caps Lock ou o Shift, quando a pessoa aperta "N" maiúsculo, então também pede o novo', () => {
    // Quando / Então
    expect(atalhoDaTecla(tecla('N'), LIVRE)).toBe('novo');
  });

  it('dada outra letra, quando a pessoa a aperta, então não é atalho', () => {
    // Quando / Então
    expect(atalhoDaTecla(tecla('a'), LIVRE)).toBeNull();
    expect(atalhoDaTecla(tecla('Enter'), LIVRE)).toBeNull();
  });

  it('dado o foco num lugar de escrever, quando a pessoa digita "/" ou "N", então nenhum atalho dispara (a letra entra no campo)', () => {
    // Dado
    const escrevendo = { escrevendo: true, algoPorCima: false };
    // Quando / Então
    expect(atalhoDaTecla(tecla('/'), escrevendo)).toBeNull();
    expect(atalhoDaTecla(tecla('n'), escrevendo)).toBeNull();
    expect(atalhoDaTecla(tecla('?'), escrevendo)).toBeNull();
  });

  it('dado um cartão, uma janela ou um menu aberto por cima, quando a pessoa aperta "N", então nada é criado por trás dele', () => {
    // Dado
    const porCima = { escrevendo: false, algoPorCima: true };
    // Quando / Então
    expect(atalhoDaTecla(tecla('n'), porCima)).toBeNull();
    expect(atalhoDaTecla(tecla('/'), porCima)).toBeNull();
    expect(atalhoDaTecla(tecla('?'), porCima)).toBeNull();
  });

  it('dado Ctrl, Alt ou Cmd apertado, quando a pessoa aperta a tecla, então fica para o navegador e os atalhos de sempre (Ctrl+Z, Ctrl+K)', () => {
    // Quando / Então
    expect(atalhoDaTecla(tecla('n', { ctrlKey: true }), LIVRE)).toBeNull();
    expect(atalhoDaTecla(tecla('/', { altKey: true }), LIVRE)).toBeNull();
    expect(atalhoDaTecla(tecla('n', { metaKey: true }), LIVRE)).toBeNull();
  });

  it('dada a tecla segurada ou um acento sendo composto, quando ela chega, então não dispara de novo', () => {
    // Quando / Então
    expect(atalhoDaTecla(tecla('n', { repeat: true }), LIVRE)).toBeNull();
    expect(atalhoDaTecla(tecla('n', { isComposing: true }), LIVRE)).toBeNull();
  });

  it('dado o teclado ABNT2 sem a tecla "/ ?", quando a pessoa aperta AltGr+Q ou AltGr+W (que o Windows informa como Ctrl+Alt), então pede a busca e a lista', () => {
    // Dado
    const altGr = { ctrlKey: true, altKey: true, altGr: true };
    // Quando / Então
    expect(atalhoDaTecla(tecla('/', altGr), LIVRE)).toBe('buscar');
    expect(atalhoDaTecla(tecla('?', altGr), LIVRE)).toBe('atalhos');
  });

  it('dado o AltGr junto com o Cmd, quando a pessoa aperta a tecla, então continua sendo um atalho de sempre, não da página', () => {
    // Quando / Então
    expect(atalhoDaTecla(tecla('/', { ctrlKey: true, altKey: true, altGr: true, metaKey: true }), LIVRE)).toBeNull();
  });

  it('dados os atalhos de uma tecla desligados pela pessoa, quando ela aperta "/", "N" ou "?", então nenhum dispara', () => {
    // Dado
    const desligados = { ...LIVRE, desligados: true };
    // Quando / Então
    expect(atalhoDaTecla(tecla('/'), desligados)).toBeNull();
    expect(atalhoDaTecla(tecla('n'), desligados)).toBeNull();
    expect(atalhoDaTecla(tecla('?'), desligados)).toBeNull();
  });
});

describe('Tecla sozinha (sem Ctrl, Alt ou Cmd)', () => {
  it('dada a tecla T do cronômetro, quando vem sozinha, com AltGr, com Ctrl, segurada ou num acento, então só vale sozinha ou com AltGr', () => {
    // Quando / Então
    expect(ehTeclaSozinha(tecla('t'))).toBe(true);
    expect(ehTeclaSozinha(tecla('t', { ctrlKey: true, altKey: true, altGr: true }))).toBe(true);
    expect(ehTeclaSozinha(tecla('t', { ctrlKey: true }))).toBe(false);
    expect(ehTeclaSozinha(tecla('t', { altKey: true }))).toBe(false);
    expect(ehTeclaSozinha(tecla('t', { repeat: true }))).toBe(false);
    expect(ehTeclaSozinha(tecla('t', { isComposing: true }))).toBe(false);
  });
});

describe('Onde a tecla é uma letra digitada', () => {
  it('dado o foco num campo de texto, de busca, numa área de texto, numa lista de escolha ou num editor, então é lugar de escrever', () => {
    // Quando / Então
    expect(ehLugarDeEscrever({ etiqueta: 'INPUT' })).toBe(true);
    expect(ehLugarDeEscrever({ etiqueta: 'input', tipo: 'search' })).toBe(true);
    expect(ehLugarDeEscrever({ etiqueta: 'TEXTAREA' })).toBe(true);
    expect(ehLugarDeEscrever({ etiqueta: 'SELECT' })).toBe(true);
    expect(ehLugarDeEscrever({ etiqueta: 'DIV', editavel: true })).toBe(true);
  });

  it('dado o foco numa caixa de marcar, num botão ou fora de qualquer campo, então os atalhos valem', () => {
    // Quando / Então
    expect(ehLugarDeEscrever({ etiqueta: 'INPUT', tipo: 'checkbox' })).toBe(false);
    expect(ehLugarDeEscrever({ etiqueta: 'BUTTON' })).toBe(false);
    expect(ehLugarDeEscrever({ etiqueta: 'BODY' })).toBe(false);
  });
});

describe('A dica e a lista dos atalhos', () => {
  it('dado o botão "Nova pessoa", quando ganha a dica, então ela mostra o atalho', () => {
    // Quando / Então
    expect(dicaComAtalho('Nova pessoa', 'novo')).toBe('Nova pessoa (N)');
    expect(dicaComAtalho('Buscar', 'buscar')).toBe('Buscar (/)');
  });

  it('dada uma página com busca e "Novo", quando a lista abre, então mostra os três atalhos da página e os de todo o SEMPER', () => {
    // Quando
    const [pagina, geral] = listaDeAtalhos({ temBusca: true, novo: 'Nova pessoa', mac: false });
    // Então
    expect(pagina.linhas).toEqual([
      { teclas: [ATALHOS.buscar.nome], oQueFaz: 'Ir para a busca desta página' },
      { teclas: ['N'], oQueFaz: 'Nova pessoa' },
      { teclas: ['?'], oQueFaz: 'Mostrar esta lista de atalhos' }
    ]);
    expect(geral.linhas.map(l => l.teclas)).toEqual([['Ctrl', 'K'], ['Ctrl', 'Z'], ['Esc']]);
  });

  it('dada uma página sem busca e sem "Novo", quando a lista abre, então não promete "/" nem "N"', () => {
    // Quando
    const [pagina] = listaDeAtalhos({ temBusca: false, novo: null, mac: false });
    // Então
    expect(pagina.linhas.map(l => l.teclas[0])).toEqual(['?']);
  });

  it('dado um Mac, quando a lista abre, então os atalhos de sempre usam ⌘ no lugar de Ctrl', () => {
    // Quando
    const [, geral] = listaDeAtalhos({ temBusca: true, novo: null, mac: true });
    // Então
    expect(geral.linhas[0].teclas).toEqual(['⌘', 'K']);
  });
});
