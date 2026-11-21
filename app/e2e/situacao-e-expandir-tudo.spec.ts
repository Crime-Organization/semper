// O "Expandir tudo" da esquerda e a Situação (#394, #397; antes, #389 e #351). Nos cartões com a Situação (processo, demanda,
// tarefa, compromisso, contrato e pessoa, nesta a "Etapa do atendimento"), a Situação tem uma linha própria logo abaixo da linha de
// cima, e o botão que abre e fecha as seções da esquerda fica sozinho, à direita, logo abaixo da descrição (e dos botões rápidos) e
// acima da primeira seção, com o meio no eixo das setas das seções e do X (#381). Ele não fica mais na linha dos botões rápidos nem
// ao lado da Situação. Na tarefa, o menu e o ✓ Concluir cabem sem se cruzar, também numa janela estreita e no celular.
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Na semente do banco fictício, quem está logado é o Mauro (master).
import { expect, test, type Locator, type Page } from '@playwright/test';

type Caixa = { x: number; y: number; width: number; height: number };
/** A diferença aceita entre dois meios (o arredondamento do desenho). */
const TOLERANCIA = 1;
/** Uma janela de computador mais estreita que a do celular, em que a linha da Situação tem pouco espaço. */
const JANELA_ESTREITA = 600;
/** Se duas caixas se cruzam (encostar não conta). */
const cruzam = (a: Caixa, b: Caixa) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const meioX = (c: Caixa) => c.x + c.width / 2;
const embaixo = (c: Caixa) => c.y + c.height;

/** Os seis cartões com a Situação: onde abrir, a linha da semente e a primeira seção da esquerda. */
const CARTOES = [
  { cartao: 'tarefa', endereco: '/tarefas/', linha: 'Emitir a GRU', primeira: /^Checklists/ },
  { cartao: 'demanda', endereco: '/demandas/', linha: 'Registro de marca', primeira: /^Checklists/ },
  { cartao: 'processo', endereco: '/processos/judicial/', linha: 'JOSÉ DA SILVA TESTE', primeira: /^Prazos/ },
  { cartao: 'compromisso', endereco: '/agenda/', linha: 'Reunião de equipe', primeira: /^Dados do compromisso/ },
  { cartao: 'contrato', endereco: '/contratos/', linha: 'MARIA APARECIDA EXEMPLO', primeira: /^Checklists/ },
  { cartao: 'pessoa', endereco: '/pessoas/', linha: 'MARIA APARECIDA EXEMPLO', primeira: /^Qualificação/ }
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
/** O "Expandir tudo" da esquerda (sem a coluna, o do alto do cartão), pelo nome, que diz o alcance dele. */
async function expandirDaEsquerda(cartao: Locator) {
  return cartao.getByRole('button', { name: /^(Expandir|Recolher) tudo (da coluna da esquerda|do alto do cartão)$/ });
}
/** A linha dos botões rápidos (#351). */
const linhaDeAtalhos = (cartao: Locator) => cartao.getByRole('group', { name: 'Acrescentar ao cartão' });
/** O botão que abre e fecha a seção (o título dela). */
const secao = (cartao: Locator, nome: RegExp) => cartao.getByRole('button', { name: nome }).and(cartao.locator('[aria-controls]'));
/** Os meios das setas das seções que recolhem (o último ícone de cada título com o botão que abre e fecha a seção). */
async function meiosDasSetas(cartao: Locator) {
  const titulos = cartao.getByRole('heading', { level: 3 }).filter({ has: cartao.page().locator('button[aria-expanded][aria-controls]') });
  await expect(titulos.first()).toBeVisible();
  return Promise.all((await titulos.all()).map(async t => meioX(await caixa(t.locator('svg').last()))));
}

/**
 * Confere que o "Expandir tudo" da esquerda fica sozinho: abaixo da Situação, do título e dos botões rápidos, e acima da primeira
 * seção. Devolve a caixa do botão.
 */
async function sozinhoAcimaDaPrimeira(cartao: Locator, primeira: RegExp) {
  const botao = await caixa(await expandirDaEsquerda(cartao));
  const [menu, titulo, atalhos, secaoPrimeira] = [await caixa(menuDaSituacao(cartao)), await caixa(cartao.getByRole('heading', { level: 2 })),
    await caixa(linhaDeAtalhos(cartao)), await caixa(secao(cartao, primeira))];
  expect(botao.y).toBeGreaterThanOrEqual(embaixo(menu));
  expect(botao.y).toBeGreaterThanOrEqual(embaixo(titulo));
  expect(botao.y).toBeGreaterThanOrEqual(embaixo(atalhos));
  expect(embaixo(botao)).toBeLessThanOrEqual(secaoPrimeira.y + TOLERANCIA);
  return botao;
}

test.describe('O "Expandir tudo" da esquerda sozinho, acima da primeira seção, ao lado (#394)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const { cartao: nome, endereco, linha, primeira } of CARTOES) {
    test(`dado o cartão de ${nome} ao lado, quando abre, então o "Expandir tudo" fica sozinho acima da primeira seção, no eixo do X e das setas das seções, fora da linha da Situação e dos botões rápidos`, async ({ page }) => {
      // Dado / Quando
      const cartao = await abrirCartao(page, endereco, linha);
      await formato(cartao, 'Abrir ao lado');
      // Então
      const botao = await sozinhoAcimaDaPrimeira(cartao, primeira);
      await expect(linhaDeAtalhos(cartao).getByRole('button', { name: /^(Expandir|Recolher) tudo/ })).toHaveCount(0);
      const x = meioX(await caixa(cartao.getByRole('button', { name: 'Fechar' })));
      expect(Math.abs(meioX(botao) - x)).toBeLessThanOrEqual(TOLERANCIA);
      for (const seta of await meiosDasSetas(cartao)) expect(Math.abs(seta - x)).toBeLessThanOrEqual(TOLERANCIA);
    });
  }

  test('dado o cartão de um processo no centro, quando abre, então o "Expandir tudo" da esquerda fica acima de Prazos, no eixo das setas do corpo, e o da coluna fica na linha dos botões da janela', async ({ page }) => {
    // Dado / Quando
    const cartao = await abrirCartao(page, '/processos/judicial/', 'JOSÉ DA SILVA TESTE');
    await formato(cartao, 'Abrir no centro da tela');
    // Então
    const botao = await sozinhoAcimaDaPrimeira(cartao, /^Prazos/);
    await expect(cartao.getByRole('button', { name: /^Expandir tudo (da|do) / })).toHaveCount(2);
    const [daColuna, fechar] = [await caixa(cartao.getByRole('button', { name: 'Expandir tudo da coluna da direita' })), await caixa(cartao.getByRole('button', { name: 'Fechar' }))];
    expect(Math.abs((daColuna.y + daColuna.height / 2) - (fechar.y + fechar.height / 2))).toBeLessThanOrEqual(TOLERANCIA);
    const prazos = meioX(await caixa(cartao.getByRole('heading', { level: 3, name: /^Prazos/ }).locator('svg').last()));
    expect(Math.abs(meioX(botao) - prazos)).toBeLessThanOrEqual(TOLERANCIA);
  });

  test('dado o botão acima da primeira seção, quando a pessoa clica nele, então as seções da esquerda abrem e ele passa a "Recolher tudo", no mesmo lugar', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/demandas/', 'Registro de marca');
    await formato(cartao, 'Abrir ao lado');
    const antes = await caixa(await expandirDaEsquerda(cartao));
    // Quando
    await (await expandirDaEsquerda(cartao)).click();
    // Então
    const recolher = await expandirDaEsquerda(cartao);
    await expect(recolher).toHaveAccessibleName('Recolher tudo do alto do cartão');
    await expect(recolher).toHaveAttribute('aria-expanded', 'true');
    await expect(secao(cartao, /^Checklists/)).toHaveAttribute('aria-expanded', 'true');
    const depois = await caixa(recolher);
    expect(Math.abs(depois.x - antes.x)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(depois.y - antes.y)).toBeLessThanOrEqual(TOLERANCIA);
  });
});

/** Na tarefa, o menu e o ✓ Concluir não se cruzam, nem o "Expandir tudo" e os botões rápidos. */
async function tarefaSemCruzar(cartao: Locator) {
  const concluir = cartao.getByRole('button', { name: 'Concluir', exact: true });
  await expect(concluir).toBeVisible();
  const [menu, acao, botao] = [await caixa(menuDaSituacao(cartao)), await caixa(concluir), await sozinhoAcimaDaPrimeira(cartao, /^Checklists/)];
  expect(cruzam(menu, acao)).toBe(false);
  for (const atalho of await linhaDeAtalhos(cartao).getByRole('button').all()) expect(cruzam(await caixa(atalho), botao)).toBe(false);
}

test.describe('A tarefa com o ✓ Concluir na linha da Situação', () => {
  test('dada a tarefa ao lado, quando abre, então o menu e o ✓, e os botões rápidos e o "Expandir tudo", cabem sem se cruzar', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 1440, height: 900 });
    // Quando
    const cartao = await abrirCartao(page, '/tarefas/', 'Emitir a GRU');
    await formato(cartao, 'Abrir ao lado');
    // Então
    await tarefaSemCruzar(cartao);
  });

  test('dada a tarefa numa janela estreita, quando abre, então nada se cruza e o "Expandir tudo" continua acima da primeira seção', async ({ page }) => {
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

  test('dada a tarefa no celular, quando abre, então o menu, o ✓, os botões rápidos e o "Expandir tudo" não se cruzam, e a página não rola de lado', async ({ page }) => {
    // Dado / Quando
    const cartao = await abrirCartao(page, '/tarefas/', 'Emitir a GRU');
    await esperarParar(cartao);
    // Então
    await tarefaSemCruzar(cartao);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  });
});
