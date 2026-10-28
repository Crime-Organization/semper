// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { expect, test, type Page } from '@playwright/test';

/** Abre o cartão de JOSÉ DA SILVA TESTE (da semente do banco fictício) e o formulário de vínculo. */
async function abrirVinculoDeJose(page: Page) {
  await page.goto('/pessoas/');
  await page.getByRole('button', { name: 'Tabela' }).click();
  await page.getByRole('searchbox').fill('josé da silva');
  await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).getByText('JOSÉ DA SILVA TESTE').click();
  const vinculos = page.getByRole('button', { name: /^Vínculos/ });
  if (await vinculos.getAttribute('aria-expanded') !== 'true') await vinculos.click();
  await page.getByRole('button', { name: 'Vincular pessoa' }).click();
}

test.describe('Vínculos entre pessoas', () => {
  test('quando o administrador cria um tipo de vínculo novo, então ele já vem escolhido no formulário', async ({ page }) => {
    // Dado
    await abrirVinculoDeJose(page);
    // Quando
    await page.getByRole('combobox', { name: 'Vínculo' }).selectOption({ label: '+ Novo tipo de vínculo…' });
    const janela = page.getByRole('dialog', { name: 'Novo tipo de vínculo' });
    await janela.getByLabel('Como aparece na pessoa aberta').fill('Curador de');
    await janela.getByLabel(/Como aparece na outra pessoa/).fill('Curatelado por');
    await janela.getByRole('button', { name: 'Criar tipo' }).click();
    // Então
    await expect(page.getByText('Tipo de vínculo "Curador de" criado para o escritório.')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Vínculo' }).locator('option:checked')).toHaveText('Curador de');
  });

  test('quando o administrador cria um tipo sem preencher o nome, então a janela avisa e nada é criado', async ({ page }) => {
    // Dado
    await abrirVinculoDeJose(page);
    // Quando
    await page.getByRole('combobox', { name: 'Vínculo' }).selectOption({ label: '+ Novo tipo de vínculo…' });
    await page.getByRole('dialog', { name: 'Novo tipo de vínculo' }).getByRole('button', { name: 'Criar tipo' }).click();
    // Então
    await expect(page.getByText('Informe como o vínculo aparece na pessoa aberta.')).toBeVisible();
  });
});
