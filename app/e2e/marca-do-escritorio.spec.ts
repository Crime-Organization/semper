// A marca de cada escritório nas telas (#323): a logomarca das Configurações aparece na barra lateral, no lugar da letra, e o nome
// do escritório vai para a aba do navegador. Sem logomarca, fica a letra, como antes.
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. No banco fictício, o escritório se chama "Escritório Exemplo
// (teste)" e começa sem logomarca.
import { expect, test, type Page } from '@playwright/test';
import { abrir } from './ajudantes';

/** Uma logomarca de exemplo (um retângulo verde com uma barra branca), desenhada na hora: nada de marca de verdade. */
const LOGOMARCA = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><rect width="200" height="80" fill="#377D22"/>'
  + '<rect x="20" y="30" width="160" height="20" fill="#FFFFFF"/></svg>');
// A linha do escritório no alto do menu lateral (o grupo com o nome dele). Desde a #435 ela não é mais um link: o Início é a casinha
// na ponta dela, só com o ícone.
const MARCA_NA_LATERAL = 'Escritório Exemplo (teste)';
const marcaNaLateral = (page: Page) => page.getByRole('complementary', { name: 'Menu' }).getByRole('group', { name: MARCA_NA_LATERAL });

test.describe('Marca do escritório nas telas', () => {
  test('dado um escritório, quando o usuário entra numa página, então a aba do navegador mostra a página, o nome do escritório e o SEMPER', async ({ page }) => {
    // Quando
    await page.goto('/pessoas/');
    // Então
    await expect(page).toHaveTitle('Pessoas · Escritório Exemplo (teste) · SEMPER');
  });

  test('dado um escritório sem logomarca, quando o usuário entra, então a barra lateral mostra a letra e o nome do escritório', async ({ page }) => {
    // Quando
    await page.goto('/inicio/');
    // Então
    const marca = marcaNaLateral(page);
    await expect(marca).toHaveText(/^EEscritório Exemplo \(teste\)SEMPER$/);
    await expect(marca.getByRole('img')).toHaveCount(0);
  });

  test('dado um escritório com logomarca, quando o administrador a salva nas Configurações, então ela aparece na barra lateral, ao lado do nome', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    await abrir(page, 'Configurações');
    const escolha = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Escolher imagem' }).click();
    await (await escolha).setFiles({ name: 'logomarca.svg', mimeType: 'image/svg+xml', buffer: LOGOMARCA });
    // Quando
    await page.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(page.getByText('Dados do escritório salvos.')).toBeVisible();
    const marca = marcaNaLateral(page);
    await expect(marca.getByRole('img', { name: 'Logomarca de Escritório Exemplo (teste)' })).toBeVisible();
    await expect(marca).toHaveText(/^Escritório Exemplo \(teste\)SEMPER$/);
  });

  test('dado um usuário que sai, quando a entrada abre, então a aba volta a não ter o nome do escritório', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    await expect(page).toHaveTitle(/Escritório Exemplo \(teste\)/);
    // Quando
    await page.getByRole('button', { name: 'Sair' }).click();
    // Então
    await expect(page).toHaveURL(/\/entrar\//);
    await expect(page).not.toHaveTitle(/Escritório Exemplo/);
  });
});
