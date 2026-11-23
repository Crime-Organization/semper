// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A ajuda de cada tela de módulo (#85): o botão "?" ao lado do título abre uma janela com a explicação curta da tela em cima e
// os atalhos de teclado embaixo; a tecla "?" abre a mesma janela; Esc e o clique fora a fecham. Os textos ficam em regras/ajuda.ts.
import { expect, test } from '@playwright/test';
import { AJUDA } from '../src/regras/ajuda';

test.describe('Ajuda da tela', () => {
  test('dada a tela de Pessoas, quando a pessoa clica no "?" do cabeçalho, então lê a explicação da tela e, embaixo, os atalhos; o Esc fecha', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/');
    await expect(page.getByRole('heading', { name: 'Pessoas' })).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Ajuda desta tela' }).click();
    // Então
    const ajuda = page.getByRole('dialog', { name: 'Ajuda: Pessoas' });
    for (const paragrafo of AJUDA.pessoas) await expect(ajuda.getByText(paragrafo)).toBeVisible();
    const atalhos = ajuda.getByRole('region', { name: 'Atalhos do teclado' });
    await expect(atalhos.getByRole('region', { name: 'Nesta página' })).toContainText('Nova pessoa');
    await expect(atalhos.getByRole('region', { name: 'Em todo o SEMPER' })).toContainText('Buscar em todo o SEMPER');
    // Quando
    await page.keyboard.press('Escape');
    // Então
    await expect(ajuda).toBeHidden();
    await expect(page).toHaveURL(/\/pessoas\/$/);
  });

  test('dada a ajuda aberta pela tecla "?", quando a pessoa clica fora da janela, então ela fecha', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/');
    await expect(page.getByRole('heading', { name: 'Pessoas' })).toBeVisible();
    await page.keyboard.press('?');
    const ajuda = page.getByRole('dialog', { name: 'Ajuda: Pessoas' });
    await expect(ajuda.getByText(AJUDA.pessoas[0])).toBeVisible();
    // Quando: o clique cai no canto da tela, fora da janela
    await page.mouse.click(5, 5);
    // Então
    await expect(ajuda).toBeHidden();
  });

  test('dada outra tela de módulo, quando a pessoa clica no "?", então a explicação é a dela', async ({ page }) => {
    // Dado
    await page.goto('/contratos/');
    await expect(page.getByRole('heading', { name: 'Contratos' })).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Ajuda desta tela' }).click();
    // Então
    const ajuda = page.getByRole('dialog', { name: 'Ajuda: Contratos' });
    await expect(ajuda.getByText(AJUDA.contratos[0])).toBeVisible();
    await expect(ajuda.getByText(AJUDA.pessoas[0])).toHaveCount(0);
    await expect(ajuda.getByRole('region', { name: 'Nesta página' })).toContainText('Novo contrato');
  });

  test('dado o celular, quando a tela de Pessoas abre, então o "?" cabe ao lado do título, sem a página rolar para o lado', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 375, height: 812 });
    // Quando
    await page.goto('/pessoas/');
    // Então
    const botao = page.getByRole('button', { name: 'Ajuda desta tela' });
    await expect(botao).toBeVisible();
    const titulo = await page.getByRole('heading', { name: 'Pessoas' }).boundingBox();
    const doBotao = await botao.boundingBox();
    expect(doBotao && titulo && Math.abs((doBotao.y + doBotao.height / 2) - (titulo.y + titulo.height / 2))).toBeLessThan(titulo?.height ?? 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
