// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { expect, test } from '@playwright/test';
import { sair } from './ajudantes';

test.describe('Entrar e sair', () => {
  test('quando a sessão acaba em outro lugar e a pessoa volta para a aba, então vai para a entrada com um aviso e, ao entrar de novo, volta para onde estava', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/');
    await expect(page.getByRole('heading', { name: 'Pessoas' })).toBeVisible();
    await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { encerrarSessao(): void } }).SEMPER_FALSO.encerrarSessao());
    // Quando
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    // Então
    await expect(page.getByText('Sua sessão foi encerrada. Entre de novo para continuar.')).toBeVisible();
    await expect(page).toHaveURL(/\/entrar\/\?encerrada/);
    // Quando
    await page.getByLabel('E-mail').fill('mateus@exemplo.com');
    await page.getByLabel('Senha').fill('senha-de-teste');
    await page.getByRole('button', { name: 'Entrar' }).click();
    // Então
    await expect(page).toHaveURL(/\/pessoas\/?$/);
  });

  test('quando a sessão acaba em outro lugar e a pessoa recarrega a página, então o aviso é o de sessão encerrada, não o de conta desativada', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/');
    await expect(page.getByRole('heading', { name: 'Pessoas' })).toBeVisible();
    await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { encerrarSessao(): void } }).SEMPER_FALSO.encerrarSessao());
    // Quando
    await page.reload();
    // Então
    await expect(page.getByText('Sua sessão foi encerrada. Entre de novo para continuar.')).toBeVisible();
  });

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
