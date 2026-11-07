// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O cartão de todos os módulos abre ao lado ou numa janela no centro da tela, como cada usuário escolher no botão do
// cartão. A escolha fica nas preferências do usuário (no banco fictício, até a aba fechar).
import { expect, test, type Page } from '@playwright/test';

/** Abre o cartão de uma linha da tabela do módulo. */
async function abrirCartao(page: Page, endereco: string, texto: string) {
  await page.goto(endereco);
  await page.getByRole('row').filter({ hasText: texto }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}
/** Onde o cartão está na tela (depois de terminar de abrir). */
async function posicao(page: Page) {
  const c = (await page.getByRole('dialog').boundingBox())!, tela = page.viewportSize()!;
  return { meio: Math.round(c.x + c.width / 2 - tela.width / 2), direita: Math.round(tela.width - c.x - c.width), largura: Math.round(c.width), embaixo: Math.round(tela.height - c.y - c.height) };
}

test.describe('Formato do cartão', () => {
  test('quando a pessoa nunca escolheu, então o cartão abre ao lado, encostado na direita', async ({ page }) => {
    // Quando
    await abrirCartao(page, '/pessoas/', 'JOSÉ DA SILVA TESTE');
    // Então
    await expect.poll(async () => (await posicao(page)).direita).toBe(0);
    await expect(page.getByRole('button', { name: 'Abrir no centro da tela' })).toBeVisible();
  });

  test('quando a pessoa escolhe abrir no centro, então o cartão vai para o meio e os próximos, também de outro módulo, abrem no centro', async ({ page }) => {
    // Dado
    await abrirCartao(page, '/pessoas/', 'JOSÉ DA SILVA TESTE');
    // Quando
    await page.getByRole('button', { name: 'Abrir no centro da tela' }).click();
    // Então
    await expect.poll(async () => (await posicao(page)).meio).toBe(0);
    await page.getByRole('button', { name: 'Fechar' }).click();
    await abrirCartao(page, '/contratos/', 'JOSÉ DA SILVA TESTE');
    await expect(page.getByRole('button', { name: 'Abrir ao lado' })).toBeVisible();
    await expect.poll(async () => (await posicao(page)).meio).toBe(0);
  });

  test('quando o cartão está no centro e a pessoa clica fora dele, então ele fecha', async ({ page }) => {
    // Dado
    await abrirCartao(page, '/pessoas/', 'JOSÉ DA SILVA TESTE');
    await page.getByRole('button', { name: 'Abrir no centro da tela' }).click();
    // Quando
    await page.mouse.click(20, 360);
    // Então
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('quando a pessoa volta para o painel ao lado, então os próximos cartões também abrem ao lado', async ({ page }) => {
    // Dado
    await abrirCartao(page, '/pessoas/', 'JOSÉ DA SILVA TESTE');
    await page.getByRole('button', { name: 'Abrir no centro da tela' }).click();
    // Quando
    await page.getByRole('button', { name: 'Abrir ao lado' }).click();
    // Então
    await abrirCartao(page, '/contratos/', 'JOSÉ DA SILVA TESTE');
    await expect.poll(async () => (await posicao(page)).direita).toBe(0);
  });

  for (const formato of ['ao lado', 'no centro']) {
    // Desde 07/11/2026, no celular o cartão sobe do pé da tela, na largura toda e da altura do conteúdo (antes, a tela toda).
    test(`dado o cartão ${formato}, quando ele abre num celular, então ocupa a largura toda, encostado embaixo, e não há botão de formato`, async ({ page }) => {
      // Dado
      if (formato === 'no centro') {
        await abrirCartao(page, '/pessoas/', 'JOSÉ DA SILVA TESTE');
        await page.getByRole('button', { name: 'Abrir no centro da tela' }).click();
      }
      // Quando
      await page.setViewportSize({ width: 375, height: 812 });
      await abrirCartao(page, '/pessoas/', 'JOSÉ DA SILVA TESTE');
      // Então
      await expect.poll(async () => (await posicao(page)).largura).toBe(375);
      await expect.poll(async () => (await posicao(page)).embaixo).toBe(0);
      await expect(page.getByRole('button', { name: /Abrir (no centro da tela|ao lado)/ })).toBeHidden();
    });
  }
});
