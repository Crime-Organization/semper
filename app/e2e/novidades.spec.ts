// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Novidades (#353): o botão do menu lateral abre a lista do que mudou em cada versão, com um ponto até a pessoa abrir.
// No banco fictício não há número de versão (só a publicação o embute), então as novidades de app/novidades/proxima/
// aparecem primeiro, como "Próxima versão"; depois de cada publicação elas passam para a pasta da versão.
import { expect, test, type Page } from '@playwright/test';

const botao = (page: Page) => page.getByRole('navigation', { name: 'Conta' }).getByRole('button', { name: /^Novidades/ });
const COM_PONTO = 'Novidades: há novidades que você ainda não viu';

test.describe('Novidades', () => {
  test('quando a pessoa abre pelo botão do menu, então vê as versões da mais nova para a mais antiga, com data, título e onde achar; Esc fecha e o foco volta ao botão', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    await expect(botao(page)).toHaveAccessibleName(COM_PONTO);
    // Quando
    await botao(page).click();
    // Então: cada versão é um título, e os números vêm do maior para o menor (a próxima, sem número, só pode vir primeiro)
    const janela = page.getByRole('dialog', { name: 'Novidades' });
    const cabecas = await janela.getByRole('heading', { level: 3 }).allTextContents();
    expect(cabecas.length).toBeGreaterThan(1);
    const numeros = cabecas.map(c => /^v\d+\.\d+\.\d+/.exec(c)?.[0] ?? 'próxima');
    expect(numeros.indexOf('próxima')).toBeLessThanOrEqual(0);
    const comNumero = numeros.filter(n => n !== 'próxima');
    expect(comNumero).toEqual([...comNumero].sort((a, b) => b.localeCompare(a, 'pt-BR', { numeric: true })));
    const v1291 = janela.getByRole('listitem', { name: /^v1\.29\.1/ });
    await expect(v1291.getByRole('heading', { level: 3 })).toContainText('17 de novembro de 2026');
    await expect(v1291.getByRole('heading', { level: 4 })).toHaveText('Quem está no contrato vê as demandas dele');
    await expect(v1291).toContainText('Em Demandas e Tarefas, e nas seções do cartão do contrato.');
    // Quando: Esc
    await page.keyboard.press('Escape');
    // Então
    await expect(janela).toBeHidden();
    await expect(botao(page)).toBeFocused();
  });

  test('quando a pessoa abre as novidades, então o ponto some, e não volta ao recarregar a página', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    await expect(botao(page)).toHaveAccessibleName(COM_PONTO);
    // Quando
    await botao(page).click();
    await page.getByRole('dialog', { name: 'Novidades' }).getByRole('button', { name: 'Fechar' }).click();
    // Então
    await expect(botao(page)).toHaveAccessibleName('Novidades');
    await page.reload();
    await expect(botao(page)).toHaveAccessibleName('Novidades');
  });

  test('dado o celular (o menu lateral é uma gaveta fechada), quando a pessoa entra, então o ponto aparece no botão da barra do topo; abrindo por ali, ele some do topo e do menu', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/inicio/');
    const doTopo = page.getByRole('banner').getByRole('button', { name: /^Novidades/ });
    // Então: o sinal está à vista, sem abrir o menu
    await expect(doTopo).toBeVisible();
    await expect(doTopo).toHaveAccessibleName(COM_PONTO);
    // Quando
    await doTopo.click();
    const janela = page.getByRole('dialog', { name: 'Novidades' });
    await expect(janela.getByRole('heading', { level: 3 }).first()).toBeVisible();
    await expect(janela.getByRole('button', { name: 'Fechar' })).toBeInViewport();
    await janela.getByRole('button', { name: 'Fechar' }).click();
    // Então
    await expect(doTopo).toHaveAccessibleName('Novidades');
    await page.getByRole('button', { name: 'Abrir menu' }).click();
    await expect(botao(page)).toHaveAccessibleName('Novidades');
  });
});
