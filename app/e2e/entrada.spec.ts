// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { expect, test } from '@playwright/test';
import { sair } from './ajudantes';

test.describe('Entrar e sair', () => {
  test('quando alguém sem sessão vai da página inicial para "Entrar" e entra, então chega ao Início', async ({ page }) => {
    // Dado
    await sair(page);
    await page.goto('/');
    // Quando
    await page.getByRole('link', { name: 'Entrar' }).first().click();
    await page.getByLabel('E-mail').fill('mateus@exemplo.com');
    await page.getByLabel('Senha').fill('senha-de-teste');
    await page.getByRole('button', { name: 'Entrar' }).click();
    // Então
    await expect(page).toHaveURL(/\/inicio\/?$/);
  });

  test('quando alguém entra sem informar a senha, então a tela pede o e-mail e a senha', async ({ page }) => {
    // Dado
    await sair(page);
    // Quando
    await page.getByLabel('E-mail').fill('mateus@exemplo.com');
    await page.getByRole('button', { name: 'Entrar' }).click();
    // Então
    await expect(page.getByText('Informe o e-mail e a senha.')).toBeVisible();
    await expect(page).toHaveURL(/\/entrar\/?$/);
  });

  test('quando alguém que saiu abre Pessoas direto, então é levado à tela de entrada', async ({ page }) => {
    // Dado
    await sair(page);
    // Quando
    await page.goto('/pessoas/');
    // Então
    await expect(page).toHaveURL(/\/entrar/);
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });

  test('quando a pessoa sai pelo menu, então abrir o Início de novo pede para entrar', async ({ page }) => {
    // Dado
    await sair(page);
    // Quando
    await page.goto('/inicio/');
    // Então
    await expect(page).toHaveURL(/\/entrar/);
  });
});
