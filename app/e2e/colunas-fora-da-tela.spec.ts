// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Colunas fora da tela (#87): quando o quadro não cabe, a borda mostra que há mais (um degradê, à direita enquanto há o que
// rolar e à esquerda depois de rolar). No banco fictício, o quadro de Tarefas tem "Sem etapa", quatro colunas, "Arquivados"
// e a coluna de criar: cerca de 2.100px, que não cabem numa tela de 1.280px e cabem numa de 3.000px. Quem está logado é o
// Mauro (administrador). O degradê é desenho (não tem papel nem texto): o teste confere os lados acesos na área em volta do
// quadro e a opacidade do degradê que o estilo desenha a partir deles, e também a cor que a pessoa vê na borda e onde fica o
// botão que recebe o foco pelo teclado (fora da faixa do degradê).
import { inflateSync } from 'node:zlib';
import { expect, test, type Locator, type Page } from '@playwright/test';

/** O PNG começa com uma assinatura de 8 bytes; depois vêm os pedaços: tamanho (4 bytes), tipo (4), dados e conferência (4). */
const ASSINATURA_DO_PNG = 8, CABECA_DO_PEDACO = 8, PEDACO_SEM_DADOS = 12;

/** A cor ("r,g,b") de um ponto da tela, como a pessoa vê: o primeiro pixel da captura de um quadradinho nele. */
async function corNoPonto(page: Page, x: number, y: number) {
  const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
  const imagem: Buffer[] = [];
  for (let i = ASSINATURA_DO_PNG; i < png.length;) {
    const tamanho = png.readUInt32BE(i);
    if (png.toString('ascii', i + 4, i + CABECA_DO_PEDACO) === 'IDAT') imagem.push(png.subarray(i + CABECA_DO_PEDACO, i + CABECA_DO_PEDACO + tamanho));
    i += PEDACO_SEM_DADOS + tamanho;
  }
  // Cada linha começa com o byte do filtro; no primeiro pixel da primeira linha, qualquer filtro deixa a cor como está.
  const [, r, g, b] = inflateSync(Buffer.concat(imagem));
  return `${r},${g},${b}`;
}

/** A cor do fundo da página ("r,g,b"). */
const corDoFundo = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor.replace(/[^\d,]/g, ''));

/** A largura do degradê, em pixels, como o estilo define. */
const larguraDoDegrade = (quadro: Locator) =>
  quadro.evaluate(el => parseFloat(getComputedStyle(el.parentElement!, '::after').width));

async function quadroDeTarefas(page: Page) {
  await page.goto('/tarefas/');
  await page.getByRole('button', { name: 'Kanban' }).click();
  const quadro = page.getByRole('region', { name: 'Quadro' });
  await expect(quadro.getByRole('heading', { name: 'Concluída', exact: true })).toBeVisible();
  return quadro;
}

/** O degradê de um lado: aceso (opacidade 1) ou apagado (0). */
const degrade = (quadro: Locator, lado: 'esquerda' | 'direita') =>
  quadro.evaluate((el, pseudo) => getComputedStyle(el.parentElement!, pseudo).opacity, lado === 'esquerda' ? '::before' : '::after');

async function rolarAte(quadro: Locator, onde: 'fim' | 'meio') {
  await quadro.evaluate((el, ate) => { el.scrollLeft = ate === 'fim' ? el.scrollWidth : (el.scrollWidth - el.clientWidth) / 2; }, onde);
}

async function telaDe(page: Page, largura: number) {
  await page.setViewportSize({ width: largura, height: 900 });
}

test.describe('Colunas fora da tela', () => {
  test('dado um quadro com colunas fora da tela, quando a página abre, então a borda direita mostra que há mais, e a esquerda não', async ({ page }) => {
    // Dado
    await telaDe(page, 1280);
    // Quando
    const quadro = await quadroDeTarefas(page);
    // Então
    await expect.poll(() => degrade(quadro, 'direita')).toBe('1');
    await expect.poll(() => degrade(quadro, 'esquerda')).toBe('0');
  });

  test('dado o quadro rolado até o meio, quando a pessoa olha as bordas, então as duas mostram que há mais', async ({ page }) => {
    // Dado
    await telaDe(page, 1280);
    const quadro = await quadroDeTarefas(page);
    // Quando
    await rolarAte(quadro, 'meio');
    // Então
    await expect.poll(() => degrade(quadro, 'esquerda')).toBe('1');
    await expect.poll(() => degrade(quadro, 'direita')).toBe('1');
  });

  test('dado o quadro rolado até o meio, com o vão ou a coluna de criar na borda, quando a pessoa olha a borda, então vê nela uma cor diferente do fundo', async ({ page }) => {
    // Dado
    await telaDe(page, 1280);
    const quadro = await quadroDeTarefas(page);
    await rolarAte(quadro, 'meio');
    await expect.poll(() => degrade(quadro, 'direita')).toBe('1');
    await expect.poll(() => degrade(quadro, 'esquerda')).toBe('1');
    // Quando
    const caixa = (await quadro.boundingBox())!, meio = Math.round(caixa.y + caixa.height / 2);
    // Então: os dois lados acesos têm uma marca própria, que não depende do que está por baixo
    const fundo = await corDoFundo(page);
    expect(await corNoPonto(page, Math.floor(caixa.x + caixa.width) - 1, meio)).not.toBe(fundo);
    expect(await corNoPonto(page, Math.ceil(caixa.x), meio)).not.toBe(fundo);
  });

  test('dada uma coluna cortada na borda direita, quando a pessoa chega ao "⋯" dela pelo Tab, então o botão fica fora do degradê', async ({ page }) => {
    // Dado: a coluna "Aguardando retorno", mais à direita, com metade do "⋯" para fora da borda direita
    await telaDe(page, 1280);
    const quadro = await quadroDeTarefas(page);
    const botao = quadro.getByRole('button', { name: 'Opções da coluna Aguardando retorno' });
    await botao.evaluate((b: HTMLElement) => {
      const q = b.closest<HTMLElement>('[role="region"]')!;
      q.scrollTo({ left: q.scrollLeft + b.getBoundingClientRect().right - q.getBoundingClientRect().right - b.offsetWidth / 2, behavior: 'instant' });
      // O foco vai para o que vem antes do botão na ordem do Tab, sem rolar.
      const focaveis = [...q.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex="0"]')];
      focaveis[focaveis.indexOf(b) - 1].focus({ preventScroll: true });
    });
    await expect.poll(() => degrade(quadro, 'direita')).toBe('1');
    // Quando
    await page.keyboard.press('Tab');
    // Então
    await expect(botao).toBeFocused();
    const largura = await larguraDoDegrade(quadro);
    await expect.poll(async () => {
      const q = (await quadro.boundingBox())!, b = (await botao.boundingBox())!;
      return q.x + q.width - (b.x + b.width);
    }).toBeGreaterThanOrEqual(largura - 1);
  });

  test('dado o quadro rolado até o fim, quando a última coluna aparece, então o indicador da direita some e o da esquerda fica', async ({ page }) => {
    // Dado
    await telaDe(page, 1280);
    const quadro = await quadroDeTarefas(page);
    // Quando
    await rolarAte(quadro, 'fim');
    // Então
    await expect(quadro.getByRole('button', { name: 'Criar coluna' })).toBeInViewport();
    await expect.poll(() => degrade(quadro, 'direita')).toBe('0');
    await expect.poll(() => degrade(quadro, 'esquerda')).toBe('1');
  });

  test('dado um quadro que cabe inteiro na tela, quando a página abre, então nenhum indicador aparece', async ({ page }) => {
    // Dado
    await telaDe(page, 3000);
    // Quando
    const quadro = await quadroDeTarefas(page);
    // Então
    await expect.poll(() => degrade(quadro, 'direita')).toBe('0');
    await expect.poll(() => degrade(quadro, 'esquerda')).toBe('0');
  });

  test('dado um quadro que cabia, quando a janela fica estreita, então a borda direita passa a mostrar que há mais', async ({ page }) => {
    // Dado
    await telaDe(page, 3000);
    const quadro = await quadroDeTarefas(page);
    await expect.poll(() => degrade(quadro, 'direita')).toBe('0');
    // Quando
    await telaDe(page, 1280);
    // Então
    await expect.poll(() => degrade(quadro, 'direita')).toBe('1');
  });
});
