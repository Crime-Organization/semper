// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { afterEach, describe, expect, it } from 'vitest';
import { focarPrimeiroCampo } from './foco';

/** Uma etapa com uma bolinha, o Nome e o CNPJ, e um campo fora dela (o da busca do menu). */
function montar() {
  document.body.innerHTML = `
    <input id="fora" aria-label="Buscar" />
    <section class="etapa ativa">
      <input type="radio" aria-label="Tipo" />
      <input id="nome" aria-label="Nome" />
      <input id="cnpj" aria-label="CNPJ" />
    </section>`;
  const $ = (id: string) => document.getElementById(id) as HTMLInputElement;
  return { etapa: document.querySelector('.etapa.ativa'), nome: $('nome'), cnpj: $('cnpj'), fora: $('fora') };
}

afterEach(() => { document.body.innerHTML = ''; });

describe('O cursor ao abrir uma etapa do cadastro (#405)', () => {
  it('dada a etapa recém-aberta e a pessoa em nenhum campo, quando chega a hora do foco, então o cursor vai ao primeiro campo, pulando a bolinha', () => {
    // Dado
    const { etapa, nome } = montar();
    // Quando
    focarPrimeiroCampo(etapa);
    // Então
    expect(document.activeElement).toBe(nome);
  });

  it('dada a pessoa já no CNPJ, quando chega a hora do foco, então o cursor fica no CNPJ e o que ela digita não vai para o Nome', () => {
    // Dado
    const { etapa, cnpj } = montar();
    cnpj.focus();
    // Quando
    focarPrimeiroCampo(etapa);
    // Então
    expect(document.activeElement).toBe(cnpj);
  });

  it('dado o cursor num campo fora da etapa, quando chega a hora do foco, então ele vai ao primeiro campo da etapa, como antes', () => {
    // Dado
    const { etapa, nome, fora } = montar();
    fora.focus();
    // Quando
    focarPrimeiroCampo(etapa);
    // Então
    expect(document.activeElement).toBe(nome);
  });

  it('dada nenhuma etapa aberta, quando chega a hora do foco, então nada acontece', () => {
    // Dado
    const { fora } = montar();
    fora.focus();
    // Quando
    focarPrimeiroCampo(null);
    // Então
    expect(document.activeElement).toBe(fora);
  });
});
