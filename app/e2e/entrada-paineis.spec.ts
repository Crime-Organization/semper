// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Os painéis da tela de entrada: cada um com o título, a aba e o formulário certos.
import { expect, test, type Page } from '@playwright/test';
import { sair } from './ajudantes';

const titulo = (page: Page, texto: string) => expect(page.getByRole('heading', { level: 2, name: texto })).toBeVisible();
const abaSelecionada = (page: Page, nome: string) => expect(page.getByRole('tab', { name: nome })).toHaveAttribute('aria-selected', 'true');

test.describe('Painéis da tela de entrada', () => {
  test.beforeEach(async ({ page }) => { await sair(page); });

  test('quando a pessoa clica em "Esqueci minha senha" e envia o e-mail, então vê o painel de recuperar e a confirmação', async ({ page }) => {
    // Quando
    await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
    await titulo(page, 'Recuperar senha');
    await page.getByLabel('E-mail da conta').fill('mateus@exemplo.com');
    await page.getByRole('button', { name: 'Enviar link' }).click();
    // Então
    await abaSelecionada(page, 'Equipe');
    await expect(page.getByText('Se houver uma conta com esse e-mail, o link para criar uma nova senha chegará em instantes.')).toBeVisible();
  });

  test('quando a pessoa vai para "Sou cliente" e pede acesso, então passa pelos painéis do cliente', async ({ page }) => {
    // Quando
    await page.getByRole('tab', { name: 'Sou cliente' }).click();
    await titulo(page, 'Área do cliente');
    await page.getByRole('button', { name: 'Ainda não tenho acesso' }).click();
    await titulo(page, 'Solicitar acesso');
    await page.getByRole('button', { name: 'Solicitar acesso' }).click();
    // Então
    await abaSelecionada(page, 'Sou cliente');
    await expect(page.getByText('O portal do cliente ainda está em preparação.', { exact: false })).toBeVisible();
  });

  test('quando a pessoa abre o primeiro acesso e repete a senha errado, então o painel avisa', async ({ page }) => {
    // Dado
    await page.goto('/entrar/?primeiro-acesso');
    await titulo(page, 'Primeiro acesso');
    // Quando
    await page.getByLabel('E-mail do convite').fill('novo@exemplo.com');
    await page.getByLabel('Crie uma senha').fill('senha-forte-1');
    await page.getByLabel('Repita a senha').fill('senha-forte-2');
    await page.getByRole('button', { name: 'Criar meu acesso' }).click();
    // Então
    await expect(page.getByText('As duas senhas não são iguais.')).toBeVisible();
    await page.getByRole('button', { name: 'Voltar para entrar' }).click();
    await titulo(page, 'Entrar');
  });

  test('quando a pessoa troca de painel, então os campos do novo painel começam vazios', async ({ page }) => {
    // Dado
    await page.getByLabel('E-mail').fill('mateus@exemplo.com');
    // Quando
    await page.getByRole('tab', { name: 'Sou cliente' }).click();
    // Então
    await titulo(page, 'Área do cliente');
    await expect(page.getByLabel('E-mail')).toHaveValue('');
  });

  test('quando a pessoa chega pelo link de nova senha, então vê o painel de nova senha, sem as abas', async ({ page }) => {
    // Quando
    await page.goto('/entrar/?nova-senha');
    // Então
    await titulo(page, 'Nova senha');
    await expect(page.getByRole('tablist')).toHaveCount(0);
    await expect(page.getByLabel('Repita a nova senha')).toBeVisible();
  });
});

test.describe('Verificação em duas etapas', () => {
  test('quando a conta tem a verificação ativa, então a entrada pede o código e só entra com ele', async ({ page }) => {
    // Dado: a verificação ativada em Minha conta (no banco fictício, o código é sempre 123456)
    await page.goto('/minha-conta/');
    await page.getByRole('button', { name: 'Ativar verificação em duas etapas' }).click();
    await page.getByLabel('Código do aplicativo').fill('123456');
    await page.getByRole('button', { name: 'Ativar', exact: true }).click();
    await expect(page.getByText('Verificação em duas etapas ativada.', { exact: false })).toBeVisible();
    await sair(page);
    // Quando
    await page.getByLabel('E-mail').fill('mateus@exemplo.com');
    await page.getByLabel('Senha').fill('senha-de-teste');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await titulo(page, 'Código de verificação');
    await page.getByLabel('Código de 6 números').fill('000000');
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByText('Código incorreto ou vencido.', { exact: false })).toBeVisible();
    await page.getByLabel('Código de 6 números').fill('123456');
    await page.getByRole('button', { name: 'Confirmar' }).click();
    // Então
    await expect(page).toHaveURL(/\/inicio\/?$/);
  });

  test('quando a pessoa está no painel do código e escolhe outra conta, então volta para entrar', async ({ page }) => {
    // Dado
    await page.goto('/minha-conta/');
    await page.getByRole('button', { name: 'Ativar verificação em duas etapas' }).click();
    await page.getByLabel('Código do aplicativo').fill('123456');
    await page.getByRole('button', { name: 'Ativar', exact: true }).click();
    await expect(page.getByText('Verificação em duas etapas ativada.', { exact: false })).toBeVisible();
    await sair(page);
    await page.getByLabel('E-mail').fill('mateus@exemplo.com');
    await page.getByLabel('Senha').fill('senha-de-teste');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await titulo(page, 'Código de verificação');
    // Quando
    await page.getByRole('button', { name: 'Entrar com outra conta' }).click();
    // Então
    await titulo(page, 'Entrar');
  });
});
