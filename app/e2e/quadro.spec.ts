// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { expect, test } from '@playwright/test';

test.describe('Quadro de pessoas', () => {
  test('quando a pessoa arrasta um cartão para outra coluna, então ele continua lá depois de recarregar', async ({ page }) => {
    // Dado: na semente do banco fictício, JOSÉ DA SILVA TESTE está na coluna "Lead"
    await page.goto('/pessoas/');
    await page.getByRole('button', { name: 'Kanban' }).click();
    const lead = page.getByRole('list', { name: 'Lead', exact: true });
    const entrarEmContato = page.getByRole('list', { name: 'Entrar em contato', exact: true });
    const jose = lead.getByRole('listitem').filter({ hasText: 'JOSÉ DA SILVA TESTE' });
    await expect(jose).toBeVisible();
    // Quando (a coluna de destino precisa estar visível: arrastar para uma coluna fora da tela não rola o quadro)
    await jose.dragTo(entrarEmContato);
    // Então
    await expect(entrarEmContato.getByRole('listitem').filter({ hasText: 'JOSÉ DA SILVA TESTE' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('list', { name: 'Entrar em contato', exact: true }).getByRole('listitem').filter({ hasText: 'JOSÉ DA SILVA TESTE' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Lead', exact: true }).getByRole('listitem').filter({ hasText: 'JOSÉ DA SILVA TESTE' })).toHaveCount(0);
  });
});
