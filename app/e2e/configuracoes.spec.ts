// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { expect, test } from '@playwright/test';
import { abrir } from './ajudantes';

test.describe('Configurações do escritório', () => {
  test('quando o administrador muda o nome do escritório e salva, então o nome novo aparece na barra lateral', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    await abrir(page, 'Configurações');
    const nome = page.getByLabel('Nome do escritório');
    await expect(nome).toHaveValue('Escritório Exemplo (teste)');
    // Quando
    await nome.fill('Advocacia Montes Claros');
    await page.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(page.getByText('Dados do escritório salvos.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Advocacia Montes Claros: início' })).toBeVisible();
  });

  test('quando o administrador desfaz a mudança, então o nome antigo volta', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    await abrir(page, 'Configurações');
    await page.getByLabel('Nome do escritório').fill('Advocacia Montes Claros');
    await page.getByRole('button', { name: 'Salvar' }).click();
    // Quando
    await page.getByRole('button', { name: 'Desfazer' }).click();
    // Então
    await expect(page.getByRole('link', { name: 'Escritório Exemplo (teste): início' })).toBeVisible();
  });
});
