// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Minha conta e perfil profissional. No banco fictício, quem está logado é o Mateus (master); Ana é administradora.
import { expect, test } from '@playwright/test';

test.describe('Minha conta', () => {
  test('quando a pessoa clica em "Minha conta" no menu, então abre a página própria, com o acesso e o perfil profissional', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    // Quando
    await page.getByRole('navigation', { name: 'Conta' }).getByRole('link', { name: 'Minha conta' }).click();
    // Então
    await expect(page).toHaveURL(/\/minha-conta\/$/);
    await expect(page.getByRole('heading', { name: 'Minha conta', level: 1 })).toBeVisible();
    await expect(page.getByLabel('Usuário para menções', { exact: false })).toHaveValue('mateus.goncalves');
    await expect(page.getByRole('button', { name: 'Ativar verificação em duas etapas' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Perfil profissional' })).toBeVisible();
  });

  test('quando a pessoa preenche e salva o perfil, então ele volta igual ao reabrir a página', async ({ page }) => {
    // Dado
    await page.goto('/minha-conta/');
    // Quando
    await page.getByLabel('Cargo no escritório', { exact: false }).fill('Sócio');
    await page.getByRole('button', { name: 'Adicionar inscrição' }).click();
    await page.getByRole('textbox', { name: 'Número (inscrição 1)' }).fill('123.456');
    await page.getByRole('combobox', { name: 'UF (inscrição 1)' }).selectOption('MG');
    await page.getByRole('button', { name: 'Adicionar área' }).click();
    await page.getByRole('textbox', { name: 'Áreas de atuação (área 1)' }).fill('Propriedade intelectual');
    await page.getByLabel('Currículo Lattes', { exact: false }).fill('http://lattes.cnpq.br/1234567890');
    await page.getByRole('button', { name: 'Salvar perfil' }).click();
    await expect(page.getByText('Perfil profissional salvo.')).toBeVisible();
    await page.reload();
    // Então
    await expect(page.getByLabel('Cargo no escritório', { exact: false })).toHaveValue('Sócio');
    await expect(page.getByRole('textbox', { name: 'Número (inscrição 1)' })).toHaveValue('123.456');
    await expect(page.getByRole('combobox', { name: 'UF (inscrição 1)' })).toHaveValue('MG');
    await expect(page.getByRole('textbox', { name: 'Áreas de atuação (área 1)' })).toHaveValue('Propriedade intelectual');
    await expect(page.getByText('Salvo pela última vez em', { exact: false })).toBeVisible();
  });

  test('quando um link do perfil não começa com https://, então o campo mostra o erro e nada é salvo', async ({ page }) => {
    // Dado
    await page.goto('/minha-conta/');
    // Quando
    await page.getByLabel('LinkedIn').fill('linkedin.com/in/mateus');
    await page.getByRole('button', { name: 'Salvar perfil' }).click();
    // Então
    await expect(page.getByLabel('LinkedIn')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('LinkedIn')).toHaveAccessibleDescription('Cole o link completo, começando com https://.');
    await page.reload();
    await expect(page.getByLabel('LinkedIn')).toHaveValue('');
  });
});

test.describe('Perfil de alguém da equipe', () => {
  test('quando o administrador abre o perfil de alguém em Equipe, corrige e põe no site, então fica salvo e no registro de ações', async ({ page }) => {
    // Dado
    await page.goto('/equipe/');
    // Quando
    await page.getByRole('link', { name: 'Perfil profissional de Ana Teste Lima' }).click();
    await expect(page.getByRole('heading', { name: 'Ana Teste Lima', level: 1 })).toBeVisible();
    await page.getByLabel('Cargo no escritório', { exact: false }).fill('Advogada associada');
    await page.getByRole('checkbox', { name: 'Aparecer no site' }).check();
    await page.getByLabel('Ordem na página da equipe').fill('2');
    await page.getByRole('button', { name: 'Salvar perfil' }).click();
    await expect(page.getByText('Perfil profissional salvo.')).toBeVisible();
    await page.reload();
    // Então
    await expect(page.getByLabel('Cargo no escritório', { exact: false })).toHaveValue('Advogada associada');
    await expect(page.getByRole('checkbox', { name: 'Aparecer no site' })).toBeChecked();
    await expect(page.getByLabel('Ordem na página da equipe')).toHaveValue('2');
    await page.getByRole('link', { name: 'Equipe e acessos' }).first().click();
    await expect(page.getByText('o perfil profissional de Ana Teste Lima', { exact: false })).toBeVisible();
  });
});
