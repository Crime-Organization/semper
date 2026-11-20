// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Um eixo só nos cartões (#381): o meio do botão "Expandir tudo" fica no meio das setas das seções logo abaixo dele, e, onde ele fica
// logo abaixo dos botões da janela (a coluna da direita, no centro; ao lado; na janela estreita), também no meio do X. Vale com a barra
// de rolagem que ocupa espaço (Windows; o Chrome dos testes guarda o lugar dela), com a barra por cima do conteúdo (celular, Mac) e
// com o zoom do navegador, que muda a largura da barra em px da página (aqui, uma barra mais larga e o "resize" que o zoom dispara).
// Na semente do banco fictício, JOSÉ DA SILVA TESTE é uma pessoa e "Emitir a GRU" é uma tarefa.
import { expect, test, type Locator, type Page } from '@playwright/test';

const PESSOA = 'JOSÉ DA SILVA TESTE';
const TAREFA = 'Emitir a GRU';
/** A diferença aceita entre dois meios (o arredondamento do desenho). */
const TOLERANCIA = 1;
/** A largura de uma barra de rolagem com o zoom do navegador em 50% (a de 15px do Windows, em px da página). */
const BARRA_COM_ZOOM_PEQUENO = 30;

/** Abre o cartão de uma pessoa pela tabela. */
async function abrirPessoa(page: Page) {
  await page.goto('/pessoas/');
  await page.getByRole('row').filter({ hasText: PESSOA }).click();
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByRole('heading', { name: PESSOA, level: 2 })).toBeVisible();
  return cartao;
}
/** Abre o cartão de uma tarefa pela tabela. */
async function abrirTarefa(page: Page) {
  await page.goto('/tarefas/');
  await page.getByRole('button', { name: 'Tabela' }).click();
  await page.getByRole('row').filter({ hasText: TAREFA }).click();
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByRole('heading', { name: TAREFA, level: 2 })).toBeVisible();
  return cartao;
}
/** Muda o formato do cartão, se ele ainda não está nesse formato, e espera a janela parar de se mexer. */
async function formato(cartao: Locator, qual: 'Abrir no centro da tela' | 'Abrir ao lado') {
  const botao = cartao.getByRole('button', { name: qual });
  if (await botao.count()) await botao.click();
  await esperarParar(cartao);
}
/** Espera as transições da janela terminarem (ela entra deslizando). */
async function esperarParar(cartao: Locator) {
  await cartao.evaluate(e => Promise.all(e.getAnimations({ subtree: true }).map(a => a.finished)));
}
/** O meio, na horizontal, de um elemento. */
async function meio(alvo: Locator) {
  const caixa = (await alvo.boundingBox())!;
  return caixa.x + caixa.width / 2;
}
/**
 * Os meios das setas das seções que recolhem: os títulos com o botão que abre e fecha a seção (aria-expanded, com aria-controls
 * apontando o conteúdo dela; o "+" das etiquetas abre uma janela, e não tem aria-controls). A seta é o último ícone do título.
 */
async function meiosDasSetas(cartao: Locator) {
  const titulos = cartao.getByRole('heading', { level: 3 }).filter({ has: cartao.page().locator('button[aria-expanded][aria-controls]') });
  await expect(titulos.first()).toBeVisible();
  const meios: number[] = [];
  for (const titulo of await titulos.all()) meios.push(await meio(titulo.locator('svg').last()));
  return meios;
}
/** O meio da seta de uma seção, pelo título. */
const meioDaSeta = (cartao: Locator, secao: RegExp) => meio(cartao.getByRole('heading', { level: 3, name: secao }).locator('svg').last());
/** Os meios dos botões "Expandir tudo" do cartão (no centro, o do corpo vem antes do da coluna). */
async function meiosDosExpandir(cartao: Locator) {
  const botoes = await cartao.getByRole('button', { name: 'Expandir tudo' }).all();
  return Promise.all(botoes.map(meio));
}
/** Toda seta fica no eixo de um dos "Expandir tudo" (o do grupo dela). */
function setasNosEixos(setas: number[], eixos: number[]) {
  for (const seta of setas) expect(Math.min(...eixos.map(e => Math.abs(e - seta)))).toBeLessThanOrEqual(TOLERANCIA);
}
/** Simula o zoom pequeno: a barra de rolagem fica mais larga em px da página, e a janela muda de tamanho (o "resize" do zoom). */
async function barraMaisLarga(page: Page) {
  await page.addStyleTag({ content: `::-webkit-scrollbar { width: ${BARRA_COM_ZOOM_PEQUENO}px; height: ${BARRA_COM_ZOOM_PEQUENO}px }` });
  const tamanho = page.viewportSize()!;
  await page.setViewportSize({ ...tamanho, width: tamanho.width - 1 });
  await page.setViewportSize(tamanho);
}

/** Confere o cartão no centro: o "Expandir tudo" da coluna no eixo do X e das setas dela; o do corpo, no das setas do corpo. */
async function conferirNoCentro(cartao: Locator) {
  const x = await meio(cartao.getByRole('button', { name: 'Fechar' }));
  const eixos = await meiosDosExpandir(cartao);
  expect(eixos).toHaveLength(2);
  // O da coluna, logo abaixo do X, no mesmo eixo
  expect(Math.abs(eixos[1] - x)).toBeLessThanOrEqual(TOLERANCIA);
  // As setas da coluna, logo abaixo, também
  expect(Math.abs(await meioDaSeta(cartao, /^Comentários/) - x)).toBeLessThanOrEqual(TOLERANCIA);
  expect(Math.abs(await meioDaSeta(cartao, /^Histórico de alterações/) - x)).toBeLessThanOrEqual(TOLERANCIA);
  // E toda seta, no corpo e na coluna, no eixo do "Expandir tudo" do grupo dela
  setasNosEixos(await meiosDasSetas(cartao), eixos);
}
/** Confere o cartão sem a coluna (ao lado, na janela estreita): o X, o "Expandir tudo" e todas as setas num eixo só. */
async function conferirNumEixoSo(cartao: Locator) {
  const x = await meio(cartao.getByRole('button', { name: 'Fechar' }));
  const eixos = await meiosDosExpandir(cartao);
  expect(eixos).toHaveLength(1);
  expect(Math.abs(eixos[0] - x)).toBeLessThanOrEqual(TOLERANCIA);
  setasNosEixos(await meiosDasSetas(cartao), [x]);
}

test.describe('O eixo do "Expandir tudo" com a barra de rolagem que ocupa espaço', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('dado o cartão de uma pessoa no centro, quando abre, então o X, o "Expandir tudo" da coluna e as setas dela ficam no mesmo eixo, e o do corpo no eixo das setas do corpo', async ({ page }) => {
    // Dado / Quando
    const cartao = await abrirPessoa(page);
    await formato(cartao, 'Abrir no centro da tela');
    // Então
    await conferirNoCentro(cartao);
  });

  test('dado o cartão de uma tarefa ao lado, quando abre, então o X, o "Expandir tudo" e as setas das seções ficam no mesmo eixo', async ({ page }) => {
    // Dado / Quando
    const cartao = await abrirTarefa(page);
    await formato(cartao, 'Abrir ao lado');
    // Então
    await conferirNumEixoSo(cartao);
  });

  test('dado o cartão de uma tarefa no centro, numa janela estreita, quando abre, então o X, o "Expandir tudo" e as setas ficam no mesmo eixo', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 800, height: 900 });
    // Quando
    const cartao = await abrirTarefa(page);
    await formato(cartao, 'Abrir no centro da tela');
    // Então
    await conferirNumEixoSo(cartao);
  });

  test('dado o cartão no centro com o zoom pequeno (a barra mais larga), quando a janela muda de tamanho, então o eixo continua certo', async ({ page }) => {
    // Dado
    const cartao = await abrirPessoa(page);
    await formato(cartao, 'Abrir no centro da tela');
    // Quando
    await barraMaisLarga(page);
    await esperarParar(cartao);
    // Então
    await conferirNoCentro(cartao);
    // E na janela estreita também
    await page.setViewportSize({ width: 800, height: 900 });
    await esperarParar(cartao);
    await conferirNumEixoSo(cartao);
  });

  test('dada a coluna da direita ainda sem rolar, quando a pessoa abre todas as seções e ela passa a rolar, então nada pula para o lado', async ({ page }) => {
    // Dado: uma janela baixa, para a coluna passar da altura dela com tudo aberto
    await page.setViewportSize({ width: 1440, height: 600 });
    const cartao = await abrirPessoa(page);
    await formato(cartao, 'Abrir no centro da tela');
    const expandir = cartao.getByRole('button', { name: 'Expandir tudo' }).last();
    const antes = await meio(expandir);
    const comentarios = await meioDaSeta(cartao, /^Comentários/);
    // Quando
    await expandir.click();
    // Então: a coluna rola
    const recolher = cartao.getByRole('button', { name: 'Recolher tudo' }).last();
    expect(await recolher.evaluate(botao => {
      let quem = botao.parentElement;
      while (quem && getComputedStyle(quem).overflowY !== 'auto') quem = quem.parentElement;
      return !!quem && quem.scrollHeight > quem.clientHeight;
    })).toBe(true);
    // E o botão e as setas continuam onde estavam
    expect(Math.abs(await meio(recolher) - antes)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(await meioDaSeta(cartao, /^Comentários/) - comentarios)).toBeLessThanOrEqual(TOLERANCIA);
  });
});

test.describe('O eixo do "Expandir tudo" com a barra por cima do conteúdo (sem ocupar espaço)', () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: true, hasTouch: true });

  test('dado o cartão de uma pessoa no centro, quando abre, então o X, o "Expandir tudo" da coluna e as setas ficam no mesmo eixo', async ({ page }) => {
    // Dado / Quando
    const cartao = await abrirPessoa(page);
    await formato(cartao, 'Abrir no centro da tela');
    // Então
    await conferirNoCentro(cartao);
  });
});

test.describe('O eixo do "Expandir tudo" num celular', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('dado o cartão de uma tarefa no celular, quando abre, então o "Expandir tudo" fica no eixo das setas das seções, e a página não rola de lado', async ({ page }) => {
    // Dado / Quando
    const cartao = await abrirTarefa(page);
    await esperarParar(cartao);
    // Então
    const eixos = await meiosDosExpandir(cartao);
    expect(eixos).toHaveLength(1);
    setasNosEixos(await meiosDasSetas(cartao), eixos);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});
