// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Um eixo só nos cartões (#381): o meio do botão "Expandir tudo" fica no meio das setas das seções logo abaixo dele, e, onde ele fica
// logo abaixo dos botões da janela (ao lado; na janela estreita), também no meio do X. Desde a #397, o "Expandir tudo" da coluna da
// direita, no centro, fica na linha dos botões da janela, à esquerda do abrir ao lado e do X, e as setas da coluna continuam no eixo
// do X; ao lado e na janela estreita, o das seções de baixo fica acima de Comentários, também no eixo do X. O ✓ da Situação e, no
// centro largo, o ⋯ da linha de cima ficam no eixo das setas do corpo (no do X, onde ele é o mesmo). Vale com a barra
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
/** O que o anel do foco do teclado ocupa além do botão: o contorno de 2px e o afastamento de 2px (:focus-visible). */
const ANEL_DO_FOCO = 4;
/** Uma janela de computador mais estreita que a do celular (640px, em que o cartão sobe do pé da tela), com a barra que ocupa espaço. */
const JANELA_DE_COMPUTADOR_ESTREITA = 600;

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
/**
 * Espera as transições da janela terminarem (ela entra deslizando). Uma transição cancelada também parou: o fundo de um botão que
 * passa sob o ponteiro parado enquanto a janela desliza (o hover que começa e acaba) é cancelado, e não termina.
 */
async function esperarParar(cartao: Locator) {
  await cartao.evaluate(e => Promise.all(e.getAnimations({ subtree: true }).map(a => a.finished.catch(() => undefined))));
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
/** Os botões da janela (o abrir ao lado / no centro e o X). */
const botoesDaJanela = (cartao: Locator) => cartao.getByRole('group', { name: 'Botões da janela' });
/** O "Expandir tudo" do corpo do cartão e o da coluna (sem a coluna, o das seções do pé): o nome diz o alcance de cada um. */
const expandirDoCorpo = (cartao: Locator) => cartao.getByRole('button', { name: /^Expandir tudo (da coluna da esquerda|do alto do cartão)$/ });
const expandirDaColuna = (cartao: Locator) => cartao.getByRole('button', { name: /^Expandir tudo (da coluna da direita|do pé do cartão)$/ });
/** Os meios dos botões "Expandir tudo" que ficam acima das suas seções: o do corpo e, sem a coluna, o das seções de baixo. */
async function meiosDosExpandir(cartao: Locator, comColuna = false) {
  return Promise.all((comColuna ? [expandirDoCorpo(cartao)] : [expandirDoCorpo(cartao), expandirDaColuna(cartao)]).map(meio));
}
/** O ✓ da Situação da tarefa (e da demanda), quando o cartão tem. */
const concluirDaSituacao = (cartao: Locator) => cartao.getByRole('button', { name: 'Concluir', exact: true });
/** Toda seta fica no eixo de um dos "Expandir tudo" (o do grupo dela). */
function setasNosEixos(setas: number[], eixos: number[]) {
  for (const seta of setas) expect(Math.min(...eixos.map(e => Math.abs(e - seta)))).toBeLessThanOrEqual(TOLERANCIA);
}
/**
 * Confere que cada "Expandir tudo" cabe em quem o rola, com o anel do foco do teclado: entre a borda dele e a borda visível de quem
 * rola (antes da barra), sobra pelo menos ANEL_DO_FOCO, e quem rola não rola de lado (o alvo do toque, um pouco maior que o botão,
 * não passa da borda). O Chrome dos testes esconde a barra, mas guarda o lugar dela: a borda visível é a do que cabe (clientWidth).
 */
async function cabeEmQuemRola(cartao: Locator) {
  for (const botao of [expandirDoCorpo(cartao), expandirDaColuna(cartao)]) {
    const { sobra, deLado } = await botao.evaluate(b => {
      let quem = b.parentElement;
      while (quem && !/auto|scroll/.test(getComputedStyle(quem).overflowY)) quem = quem.parentElement;
      const area = quem!.getBoundingClientRect();
      return { sobra: area.left + quem!.clientLeft + quem!.clientWidth - b.getBoundingClientRect().right, deLado: quem!.scrollWidth > quem!.clientWidth };
    });
    expect(sobra).toBeGreaterThanOrEqual(ANEL_DO_FOCO);
    expect(deLado).toBe(false);
  }
}
/** Simula o zoom pequeno: a barra de rolagem fica mais larga em px da página, e a janela muda de tamanho (o "resize" do zoom). */
async function barraMaisLarga(page: Page) {
  await page.addStyleTag({ content: `::-webkit-scrollbar { width: ${BARRA_COM_ZOOM_PEQUENO}px; height: ${BARRA_COM_ZOOM_PEQUENO}px }` });
  const tamanho = page.viewportSize()!;
  await page.setViewportSize({ ...tamanho, width: tamanho.width - 1 });
  await page.setViewportSize(tamanho);
}

/**
 * Confere o cartão no centro: o "Expandir tudo" da coluna na linha dos botões da janela, à esquerda do abrir ao lado, na altura do
 * X; as setas da coluna no eixo do X; o do corpo, no eixo das setas do corpo, com o ⋯ da linha de cima e o ✓ da Situação.
 */
async function conferirNoCentro(cartao: Locator) {
  const fechar = cartao.getByRole('button', { name: 'Fechar' });
  const x = await meio(fechar);
  const daColuna = expandirDaColuna(cartao);
  const [k, f, formato] = [(await daColuna.boundingBox())!, (await fechar.boundingBox())!, (await botoesDaJanela(cartao).getByRole('button', { name: 'Abrir ao lado' }).boundingBox())!];
  expect(Math.abs((k.y + k.height / 2) - (f.y + f.height / 2))).toBeLessThanOrEqual(TOLERANCIA);
  expect(k.x + k.width).toBeLessThanOrEqual(formato.x);
  const eixos = await meiosDosExpandir(cartao, true);
  expect(eixos).toHaveLength(1);
  // O ⋯ da linha de cima e o ✓ da Situação, no eixo do "Expandir tudo" do corpo
  expect(Math.abs(await meio(cartao.getByRole('button', { name: /^Mais ações/ })) - eixos[0])).toBeLessThanOrEqual(TOLERANCIA);
  if (await concluirDaSituacao(cartao).count()) expect(Math.abs(await meio(concluirDaSituacao(cartao)) - eixos[0])).toBeLessThanOrEqual(TOLERANCIA);
  // As setas da coluna, no eixo do X
  expect(Math.abs(await meioDaSeta(cartao, /^Comentários/) - x)).toBeLessThanOrEqual(TOLERANCIA);
  expect(Math.abs(await meioDaSeta(cartao, /^Histórico de alterações/) - x)).toBeLessThanOrEqual(TOLERANCIA);
  // E toda seta, no corpo (no eixo do "Expandir tudo" dele) ou na coluna (no do X)
  setasNosEixos(await meiosDasSetas(cartao), [...eixos, x]);
  await cabeEmQuemRola(cartao);
}
/**
 * Confere o cartão sem a coluna (ao lado, na janela estreita): o X, os dois "Expandir tudo" (o do corpo e o das seções de baixo,
 * #397), o ✓ da Situação e todas as setas num eixo só.
 */
async function conferirNumEixoSo(cartao: Locator) {
  const x = await meio(cartao.getByRole('button', { name: 'Fechar' }));
  const eixos = await meiosDosExpandir(cartao);
  expect(eixos).toHaveLength(2);
  for (const eixo of eixos) expect(Math.abs(eixo - x)).toBeLessThanOrEqual(TOLERANCIA);
  if (await concluirDaSituacao(cartao).count()) expect(Math.abs(await meio(concluirDaSituacao(cartao)) - x)).toBeLessThanOrEqual(TOLERANCIA);
  setasNosEixos(await meiosDasSetas(cartao), [x]);
  await cabeEmQuemRola(cartao);
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

  test('dado o cartão de uma tarefa ao lado, numa janela de computador mais estreita que a do celular, quando abre, então o X, o "Expandir tudo" e as setas ficam no mesmo eixo', async ({ page }) => {
    // Dado: o formato escolhido numa janela larga
    const cartao = await abrirTarefa(page);
    await formato(cartao, 'Abrir ao lado');
    // Quando: a janela fica mais estreita que a medida em que o cartão sobe do pé da tela
    await page.setViewportSize({ width: JANELA_DE_COMPUTADOR_ESTREITA, height: 800 });
    await esperarParar(cartao);
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

  test('dada a coluna da direita ainda sem rolar, quando a pessoa abre todas as seções e ela passa a rolar, então nada pula para o lado, e o "Recolher tudo" fica na linha do X ao rolar', async ({ page }) => {
    // Dado: uma janela baixa, para a coluna passar da altura dela com tudo aberto
    await page.setViewportSize({ width: 1440, height: 600 });
    const cartao = await abrirPessoa(page);
    await formato(cartao, 'Abrir no centro da tela');
    const expandir = expandirDaColuna(cartao);
    const antes = await meio(expandir);
    const comentarios = await meioDaSeta(cartao, /^Comentários/);
    // Quando
    await expandir.click();
    // Então: a coluna rola
    const recolher = cartao.getByRole('button', { name: 'Recolher tudo da coluna da direita' });
    expect(await cartao.getByRole('button', { name: /^Comentários/ }).evaluate(secao => {
      let quem = secao.parentElement;
      while (quem && getComputedStyle(quem).overflowY !== 'auto') quem = quem.parentElement;
      return !!quem && quem.scrollHeight > quem.clientHeight;
    })).toBe(true);
    // E o botão e as setas continuam onde estavam
    expect(Math.abs(await meio(recolher) - antes)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(await meioDaSeta(cartao, /^Comentários/) - comentarios)).toBeLessThanOrEqual(TOLERANCIA);
    // Quando: a coluna rola até o fim
    await cartao.getByRole('button', { name: /^Histórico de alterações/ }).scrollIntoViewIfNeeded();
    await recolher.evaluate(b => { let quem = b.parentElement; while (quem && getComputedStyle(quem).overflowY !== 'auto') quem = quem.parentElement; quem!.scrollTop = quem!.scrollHeight; });
    // Então: o botão continua na linha do X, preso no alto, como ele
    const [k, f] = [(await recolher.boundingBox())!, (await cartao.getByRole('button', { name: 'Fechar' }).boundingBox())!];
    expect(Math.abs((k.y + k.height / 2) - (f.y + f.height / 2))).toBeLessThanOrEqual(TOLERANCIA);
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

  test('dado o cartão de uma tarefa no celular, quando abre, então o X, o "Expandir tudo" e as setas das seções ficam no mesmo eixo, e a página não rola de lado', async ({ page }) => {
    // Dado / Quando
    const cartao = await abrirTarefa(page);
    await esperarParar(cartao);
    // Então
    await conferirNumEixoSo(cartao);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});
