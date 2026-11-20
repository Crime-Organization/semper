// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Colunas fora da tela (#87): quando o quadro não cabe, a borda mostra que há mais (um degradê, à direita enquanto há o que
// rolar e à esquerda depois de rolar). No banco fictício, o quadro de Tarefas tem "Sem etapa", quatro colunas, "Arquivados"
// e a coluna de criar: cerca de 2.100px, que não cabem numa tela de 1.280px e cabem numa de 3.000px. Quem está logado é o
// Mauro (administrador). O degradê é desenho (não tem papel nem texto): o teste confere os lados acesos na área em volta do
// quadro e a opacidade do degradê que o estilo desenha a partir deles.
import { expect, test, type Locator, type Page } from '@playwright/test';

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
