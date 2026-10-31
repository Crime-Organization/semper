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

// No banco fictício não há Google: "Conectar conta Google" volta direto como se a autorização tivesse dado certo.
test.describe('Conta Google do escritório', () => {
  test('quando o administrador conecta a conta Google, então volta a Configurações com a conta ligada e um aviso', async ({ page }) => {
    // Dado
    await page.goto('/configuracoes/');
    const google = page.getByRole('region', { name: 'Conta Google' });
    // Quando
    await google.getByRole('button', { name: 'Conectar conta Google' }).click();
    // Então
    await expect(page.getByText('Conta Google ligada.', { exact: false })).toBeVisible();
    await expect(google).toContainText('Ligada: contato@exemplo.com');
    await expect(page).toHaveURL(/\/configuracoes\/$/);
  });

  test('quando o administrador desliga a conta, com a confirmação, então ela deixa de estar ligada e fica no registro de ações', async ({ page }) => {
    // Dado
    await page.goto('/configuracoes/');
    const google = page.getByRole('region', { name: 'Conta Google' });
    await google.getByRole('button', { name: 'Conectar conta Google' }).click();
    await expect(google).toContainText('Ligada: contato@exemplo.com');
    // Quando
    await google.getByRole('button', { name: 'Desligar' }).click();
    await google.getByRole('button', { name: 'Confirmar: desligar' }).click();
    // Então
    await expect(page.getByText('Conta Google desligada.', { exact: false })).toBeVisible();
    await expect(google.getByRole('button', { name: 'Conectar conta Google' })).toBeVisible();
    await page.goto('/equipe/');
    await expect(page.getByRole('region', { name: 'Registro de ações' })).toContainText('excluiu a conta Google do escritório');
  });

  test('quando a volta do Google traz um pedido que não existe (vencido, ou de outra pessoa), então nada é ligado e a página avisa', async ({ page }) => {
    // Quando
    await page.goto('/configuracoes/?google_estado=' + 'f'.repeat(64) + '&google_codigo=qualquer');
    // Então
    await expect(page.getByText('O pedido de ligação venceu.', { exact: false })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Conta Google' }).getByRole('button', { name: 'Conectar conta Google' })).toBeVisible();
    await expect(page).toHaveURL(/\/configuracoes\/$/);
  });

  test('quando a volta do Google traz uma recusa, então a página avisa e limpa o endereço', async ({ page }) => {
    // Quando
    await page.goto('/configuracoes/?google=recusado');
    // Então
    await expect(page.getByText('A autorização no Google foi cancelada. Nada foi ligado.')).toBeVisible();
    await expect(page).toHaveURL(/\/configuracoes\/$/);
  });
});
