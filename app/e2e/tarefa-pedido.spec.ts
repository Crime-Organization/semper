// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Tarefas (#313): a diligência com o motivo obrigatório. Quem está logado é o Mauro (administrador).
import { expect, test } from '@playwright/test';

test.describe('Diligência na tarefa (#313)', () => {
  test('quando a pessoa marca a tarefa como diligência sem motivo, então o cadastro pede o motivo; com ele, o cartão mostra o selo e o motivo', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/nova/');
    await page.getByLabel('Título').fill('Protocolar a petição');
    // Quando
    await page.getByText('Esta tarefa é uma diligência').click();
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(page.getByText('Diga o motivo da diligência.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'A tarefa', level: 2 })).toBeVisible();
    // Quando
    await page.getByLabel('Motivo da diligência').fill('Levar a petição ao cartório');
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar tarefa' }).click();
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'Protocolar a petição' })).toBeVisible();
    await expect(cartao.getByText('Diligência', { exact: true })).toBeVisible();
    await expect(cartao.getByText('Levar a petição ao cartório')).toBeVisible();
  });

  test('quando a pessoa desmarca a diligência, então o motivo some e não é pedido', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/nova/');
    await page.getByLabel('Título').fill('Ligar para o cliente');
    await page.getByText('Esta tarefa é uma diligência').click();
    await expect(page.getByLabel('Motivo da diligência')).toBeVisible();
    // Quando
    await page.getByText('Esta tarefa é uma diligência').click();
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(page.getByLabel('Motivo da diligência')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Pessoas', level: 2 })).toBeVisible();
  });
});
