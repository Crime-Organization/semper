// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { expect, test } from '@playwright/test';
import { abrir } from './ajudantes';

test.describe('Equipe e acessos', () => {
  test.beforeEach(async ({ page }) => {
    // Dado: a sessão do banco fictício é do master, que pode liberar acessos
    await page.goto('/inicio/');
    await abrir(page, 'Equipe e acessos');
  });

  test('quando o administrador libera o acesso de uma pessoa cadastrada, então o convite aparece em "Convites pendentes"', async ({ page }) => {
    // Dado
    const pendentes = page.getByRole('region', { name: 'Convites pendentes' });
    await expect(pendentes).toContainText('Nenhum convite pendente.');
    // Quando
    await page.getByRole('textbox', { name: 'Pessoa' }).fill('josé da');
    await page.getByRole('button', { name: /JOSÉ DA SILVA TESTE/ }).click();
    await page.getByLabel('E-mail de acesso').fill('jose@exemplo.com');
    await page.getByRole('button', { name: 'Liberar acesso' }).click();
    // Então
    await expect(page.getByText('Acesso liberado para', { exact: false }).first()).toBeVisible();
    await expect(pendentes.getByRole('row').filter({ hasText: 'jose@exemplo.com' })).toBeVisible();
  });

  test('quando o administrador cancela um convite pendente, então ele sai da lista', async ({ page }) => {
    // Dado
    await page.getByRole('textbox', { name: 'Pessoa' }).fill('josé da');
    await page.getByRole('button', { name: /JOSÉ DA SILVA TESTE/ }).click();
    await page.getByLabel('E-mail de acesso').fill('jose@exemplo.com');
    await page.getByRole('button', { name: 'Liberar acesso' }).click();
    const pendentes = page.getByRole('region', { name: 'Convites pendentes' });
    const convite = pendentes.getByRole('row').filter({ hasText: 'jose@exemplo.com' });
    // Quando
    await convite.getByRole('button', { name: 'Cancelar' }).click();
    await convite.getByRole('button', { name: 'Confirmar' }).click();
    // Então
    await expect(pendentes).toContainText('Nenhum convite pendente.');
  });

  test('quando o administrador muda a função de alguém, então a função nova aparece e fica no registro de ações', async ({ page }) => {
    // Dado
    const funcao = page.getByLabel('Função de Ana Teste Lima');
    await expect(funcao.getByRole('option', { selected: true })).toHaveText('Advogado');
    // Quando
    await funcao.selectOption({ label: 'Estagiário' });
    // Então
    await expect(page.getByText('Função de Ana Teste Lima: Estagiário.')).toBeVisible();
    await expect(funcao.getByRole('option', { selected: true })).toHaveText('Estagiário');
    await expect(page.getByRole('region', { name: 'Registro de ações' })).toContainText('alterou usuário Ana Teste Lima');
  });

  test('quando o e-mail de acesso fica vazio, então avisa e não libera', async ({ page }) => {
    // Dado (escolher a pessoa já preenche o e-mail do cadastro dela; aqui ele é apagado)
    await page.getByRole('textbox', { name: 'Pessoa' }).fill('josé da');
    await page.getByRole('button', { name: /JOSÉ DA SILVA TESTE/ }).click();
    await page.getByLabel('E-mail de acesso').clear();
    // Quando
    await page.getByRole('button', { name: 'Liberar acesso' }).click();
    // Então
    await expect(page.getByText('Informe um e-mail válido.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Convites pendentes' })).toContainText('Nenhum convite pendente.');
  });
});
