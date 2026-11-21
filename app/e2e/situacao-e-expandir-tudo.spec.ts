// O "Expandir tudo" fora das seções (#389): nos cartões com a Situação (processo, demanda, tarefa, compromisso, contrato e pessoa,
// nesta a "Etapa do atendimento"), o botão que abre e fecha as seções fica numa linha acima delas, à direita, com o meio no eixo das
// setas das seções e do X (#381). Desde a #351, a Situação foi para o topo do cartão, num menu compacto, e o botão ficou na linha dos
// botões rápidos (Datas, Checklist…), no meio da altura deles; na tarefa, o menu e o Concluir, no topo, cabem sem se cruzar, e os
// botões rápidos e o "Expandir tudo" também. Na anotação, o botão continua acima da primeira seção (veja documentos.spec.ts).
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Na semente do banco fictício, quem está logado é o Mauro (master).
import { expect, test, type Locator, type Page } from '@playwright/test';

type Caixa = { x: number; y: number; width: number; height: number };
/** A diferença aceita entre dois meios (o arredondamento do desenho). */
const TOLERANCIA = 1;
/** Uma janela de computador mais estreita que a do celular, em que o Concluir da tarefa desce para a linha de baixo. */
const JANELA_ESTREITA = 600;
/** Se duas caixas se cruzam (encostar não conta). */
const cruzam = (a: Caixa, b: Caixa) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const meioX = (c: Caixa) => c.x + c.width / 2;
const meioY = (c: Caixa) => c.y + c.height / 2;

/** Os seis cartões com a Situação: onde abrir e a linha da semente. */
const CARTOES = [
  { cartao: 'tarefa', endereco: '/tarefas/', linha: 'Emitir a GRU' },
  { cartao: 'demanda', endereco: '/demandas/', linha: 'Registro de marca' },
  { cartao: 'processo', endereco: '/processos/judicial/', linha: 'JOSÉ DA SILVA TESTE' },
  { cartao: 'compromisso', endereco: '/agenda/', linha: 'Reunião de equipe' },
  { cartao: 'contrato', endereco: '/contratos/', linha: 'MARIA APARECIDA EXEMPLO' },
  { cartao: 'pessoa', endereco: '/pessoas/', linha: 'MARIA APARECIDA EXEMPLO' }
];

/** Abre o cartão pela tabela do módulo, pela linha que tem `linha`. */
async function abrirCartao(page: Page, endereco: string, linha: string) {
  await page.goto(endereco);
  await page.getByRole('button', { name: 'Tabela', exact: true }).click();
  await page.getByRole('row').filter({ hasText: linha }).first().getByText(linha).first().click();
  const cartao = page.getByRole('dialog').filter({ has: page.getByRole('heading', { level: 2 }) });
  await expect(cartao.getByRole('heading', { level: 2 })).toBeVisible();
  return cartao;
}
/** Espera as transições da janela terminarem (ela entra deslizando). */
async function esperarParar(cartao: Locator) {
  await cartao.evaluate(e => Promise.all(e.getAnimations({ subtree: true }).map(a => a.finished)));
}
/** Muda o formato do cartão, se ele ainda não está nesse formato, e espera a janela parar de se mexer. */
async function formato(cartao: Locator, qual: 'Abrir no centro da tela' | 'Abrir ao lado') {
  const botao = cartao.getByRole('button', { name: qual });
  if (await botao.count()) await botao.click();
  await esperarParar(cartao);
}
const caixa = async (alvo: Locator) => (await alvo.boundingBox())!;
/** O menu da Situação (na pessoa, o da "Etapa do atendimento"). */
const menuDaSituacao = (cartao: Locator) => cartao.getByRole('combobox', { name: /^(Situação d[aeo] |Etapa do atendimento$)/ });
/** O "Expandir tudo" do corpo do cartão (no centro, o da coluna vem depois). */
const expandirDoCorpo = (cartao: Locator) => cartao.getByRole('button', { name: 'Expandir tudo' }).first();
/** A linha dos botões rápidos (#351). */
const linhaDeAtalhos = (cartao: Locator) => cartao.getByRole('group', { name: 'Acrescentar ao cartão' });
/** Os meios das setas das seções que recolhem (o último ícone de cada título com o botão que abre e fecha a seção). */
async function meiosDasSetas(cartao: Locator) {
  const titulos = cartao.getByRole('heading', { level: 3 }).filter({ has: cartao.page().locator('button[aria-expanded][aria-controls]') });
  await expect(titulos.first()).toBeVisible();
  return Promise.all((await titulos.all()).map(async t => meioX(await caixa(t.locator('svg').last()))));
}

/**
 * Confere que o "Expandir tudo" fica na linha dos botões rápidos, à direita deles, sem cruzá-los, no meio da altura do primeiro, e
 * abaixo da Situação, que ficou no topo. Devolve a caixa do botão.
 */
async function naLinhaDosAtalhos(cartao: Locator) {
  const linha = linhaDeAtalhos(cartao);
  const [primeiro, botao, menu] = [await caixa(linha.getByRole('button').or(linha.getByRole('link')).first()), await caixa(expandirDoCorpo(cartao)),
    await caixa(menuDaSituacao(cartao))];
  expect(Math.abs(meioY(primeiro) - meioY(botao))).toBeLessThanOrEqual(TOLERANCIA);
  expect(cruzam(await caixa(linha), botao)).toBe(false);
  expect(botao.y).toBeGreaterThanOrEqual(menu.y + menu.height);
  return botao;
}

test.describe('O "Expandir tudo" na linha dos botões rápidos, ao lado', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const { cartao: nome, endereco, linha } of CARTOES) {
    test(`dado o cartão de ${nome} ao lado, quando abre, então o "Expandir tudo" fica na linha dos botões rápidos, à direita, no eixo do X e das setas das seções`, async ({ page }) => {
      // Dado / Quando
      const cartao = await abrirCartao(page, endereco, linha);
      await formato(cartao, 'Abrir ao lado');
      // Então
      const botao = await naLinhaDosAtalhos(cartao);
      await expect(cartao.getByRole('button', { name: /^(Expandir|Recolher) tudo$/ })).toHaveCount(1);
      const x = meioX(await caixa(cartao.getByRole('button', { name: 'Fechar' })));
      expect(Math.abs(meioX(botao) - x)).toBeLessThanOrEqual(TOLERANCIA);
      for (const seta of await meiosDasSetas(cartao)) expect(Math.abs(seta - x)).toBeLessThanOrEqual(TOLERANCIA);
    });
  }

  test('dado o cartão de um processo no centro, quando abre, então o "Expandir tudo" do corpo fica na linha dos botões rápidos, no eixo das setas do corpo, e o da coluna continua no alto dela', async ({ page }) => {
    // Dado / Quando
    const cartao = await abrirCartao(page, '/processos/judicial/', 'JOSÉ DA SILVA TESTE');
    await formato(cartao, 'Abrir no centro da tela');
    // Então
    const botao = await naLinhaDosAtalhos(cartao);
    const botoes = cartao.getByRole('button', { name: 'Expandir tudo' });
    await expect(botoes).toHaveCount(2);
    const [corpo, coluna] = [meioX(botao), meioX(await caixa(botoes.nth(1)))];
    for (const seta of await meiosDasSetas(cartao)) expect(Math.min(Math.abs(seta - corpo), Math.abs(seta - coluna))).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(meioX(await caixa(cartao.getByRole('heading', { level: 3, name: /^Prazos/ }).locator('svg').last())) - corpo)).toBeLessThanOrEqual(TOLERANCIA);
  });

  test('dado o botão na linha dos botões rápidos, quando a pessoa clica nele, então as seções abrem e ele passa a "Recolher tudo", no mesmo lugar', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/demandas/', 'Registro de marca');
    await formato(cartao, 'Abrir ao lado');
    const antes = await caixa(expandirDoCorpo(cartao));
    // Quando
    await expandirDoCorpo(cartao).click();
    // Então
    const recolher = cartao.getByRole('button', { name: 'Recolher tudo' });
    await expect(recolher).toHaveAttribute('aria-expanded', 'true');
    await expect(cartao.getByRole('button', { name: /^Checklists/ })).toHaveAttribute('aria-expanded', 'true');
    const depois = await caixa(recolher);
    expect(Math.abs(depois.x - antes.x)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(depois.y - antes.y)).toBeLessThanOrEqual(TOLERANCIA);
  });
});

/** Na tarefa, o menu e o Concluir (no topo) não se cruzam, nem os botões rápidos e o "Expandir tudo", que fica na linha deles. */
async function tarefaSemCruzar(cartao: Locator) {
  const concluir = cartao.getByRole('button', { name: 'Concluir', exact: true });
  await expect(concluir).toBeVisible();
  const [menu, acao, botao] = [await caixa(menuDaSituacao(cartao)), await caixa(concluir), await naLinhaDosAtalhos(cartao)];
  expect(cruzam(menu, acao)).toBe(false);
  for (const atalho of await linhaDeAtalhos(cartao).getByRole('button').all()) expect(cruzam(await caixa(atalho), botao)).toBe(false);
}

test.describe('A tarefa com o Concluir ao lado da Situação, no topo', () => {
  test('dada a tarefa ao lado, quando abre, então o menu e o Concluir, e os botões rápidos e o "Expandir tudo", cabem sem se cruzar', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 1440, height: 900 });
    // Quando
    const cartao = await abrirCartao(page, '/tarefas/', 'Emitir a GRU');
    await formato(cartao, 'Abrir ao lado');
    // Então
    await tarefaSemCruzar(cartao);
  });

  test('dada a tarefa numa janela estreita, quando abre, então nada se cruza e o "Expandir tudo" continua na linha dos botões rápidos', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: JANELA_ESTREITA, height: 800 });
    // Quando
    const cartao = await abrirCartao(page, '/tarefas/', 'Emitir a GRU');
    await esperarParar(cartao);
    // Então
    await tarefaSemCruzar(cartao);
  });
});

test.describe('A tarefa no celular', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('dada a tarefa no celular, quando abre, então o menu, o Concluir, os botões rápidos e o "Expandir tudo" não se cruzam, e a página não rola de lado', async ({ page }) => {
    // Dado / Quando
    const cartao = await abrirCartao(page, '/tarefas/', 'Emitir a GRU');
    await esperarParar(cartao);
    // Então
    await tarefaSemCruzar(cartao);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  });
});
