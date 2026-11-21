// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Atalhos de teclado das páginas de módulo (#86): "/" vai à busca, "N" abre o "Novo" do módulo e "?" lista os atalhos.
// Valem em todos os módulos com página de módulo; aqui, Pessoas e Tarefas.
import { expect, test } from '@playwright/test';

test.describe('Atalhos de teclado em Pessoas', () => {
  test('quando a pessoa aperta "/" fora de um campo, então o cursor vai para a busca, e o que ela digita (inclusive N) entra no campo', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/');
    await expect(page.getByRole('heading', { name: 'Pessoas' })).toBeVisible();
    // Quando
    await page.keyboard.press('/');
    await page.keyboard.type('nome');
    // Então
    await expect(page.getByRole('searchbox')).toBeFocused();
    await expect(page.getByRole('searchbox')).toHaveValue('nome');
    await expect(page).toHaveURL(/\/pessoas\/$/);
  });

  test('quando a pessoa aperta "N" fora de um campo, então abre o cadastro de nova pessoa', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/');
    await expect(page.getByRole('link', { name: 'Nova pessoa' })).toHaveAttribute('title', 'Nova pessoa (N)');
    // Quando
    await page.keyboard.press('n');
    // Então
    await expect(page).toHaveURL(/\/pessoas\/nova\/$/);
    await expect(page.getByText('Pessoa física', { exact: true })).toBeVisible();
  });

  test('quando a pessoa aperta "?", então a janela lista os atalhos da página e os de todo o SEMPER, e o Esc a fecha', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/');
    await expect(page.getByRole('heading', { name: 'Pessoas' })).toBeVisible();
    // Quando
    await page.keyboard.press('?');
    // Então
    const lista = page.getByRole('dialog', { name: 'Atalhos do teclado' });
    await expect(lista.getByRole('region', { name: 'Nesta página' })).toContainText('Ir para a busca desta página');
    await expect(lista.getByRole('region', { name: 'Nesta página' })).toContainText('Nova pessoa');
    await expect(lista.getByRole('region', { name: 'Em todo o SEMPER' })).toContainText('Desfazer a última ação');
    // Quando
    await page.keyboard.press('Escape');
    // Então
    await expect(lista).toBeHidden();
  });

  test('dado o cartão de uma pessoa aberto, quando a pessoa aperta "N", então nada novo abre por trás do cartão', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/');
    await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).click();
    const cartao = page.getByRole('dialog');
    await expect(cartao).toBeVisible();
    // Quando
    await page.keyboard.press('n');
    // Então
    await expect(page).toHaveURL(/\/pessoas\/\?id=/);
    await expect(cartao).toBeVisible();
  });

  test('quando a pessoa aperta Ctrl+Z na lista, então continua valendo o desfazer de sempre, e nenhum atalho dispara', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/');
    await expect(page.getByRole('heading', { name: 'Pessoas' })).toBeVisible();
    // Quando
    await page.keyboard.press('Control+z');
    // Então
    await expect(page.getByText('Não há ação para desfazer.')).toBeVisible();
    await expect(page).toHaveURL(/\/pessoas\/$/);
  });
});

test.describe('Atalhos de teclado no Financeiro', () => {
  test('quando a pessoa aperta "N" fora de um campo, então abre a Nova entrada, o mesmo que o botão do cabeçalho; o "?" lista o N', async ({ page }) => {
    // Dado
    await page.goto('/financeiro/');
    await expect(page.getByRole('button', { name: 'Nova entrada' })).toHaveAttribute('title', 'Nova entrada (N)');
    await expect(page.getByRole('group', { name: /^Desempenho de/ })).toBeVisible();
    // Quando
    await page.keyboard.press('?');
    // Então
    const lista = page.getByRole('dialog', { name: 'Atalhos do teclado' });
    await expect(lista.getByRole('region', { name: 'Nesta página' })).toContainText('Nova entrada');
    // Quando
    await page.keyboard.press('Escape');
    await expect(lista).toBeHidden();
    await page.keyboard.press('n');
    // Então
    await expect(page.getByRole('form', { name: 'Nova entrada' })).toBeVisible();
  });
});

test.describe('Desligar os atalhos de uma tecla só', () => {
  test('dados os atalhos desligados em Minha conta, quando a pessoa aperta "N" em Pessoas e "T" no cartão da tarefa, então nada dispara; religados, voltam', async ({ page }) => {
    // Dado
    await page.goto('/minha-conta/');
    const interruptor = page.getByRole('checkbox', { name: /Atalhos de uma tecla só/ });
    await expect(interruptor).toBeChecked();
    await interruptor.uncheck();
    // Quando
    await page.goto('/pessoas/');
    await expect(page.getByRole('link', { name: 'Nova pessoa' })).toHaveAttribute('title', 'Nova pessoa');
    await page.keyboard.press('n');
    await page.keyboard.press('?');
    // Então
    await expect(page).toHaveURL(/\/pessoas\/$/);
    await expect(page.getByRole('dialog', { name: 'Atalhos do teclado' })).toBeHidden();
    // Quando: no cartão da tarefa, o T também não liga o cronômetro
    await page.goto('/tarefas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'Renovar a procuração' }).click();
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('timer')).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Iniciar' })).not.toHaveAttribute('aria-keyshortcuts');
    await page.keyboard.press('t');
    // Então
    await expect(cartao.getByText('pausado')).toBeVisible();
    await expect(cartao.getByText('contando')).toHaveCount(0);
    // Quando: religa
    await page.goto('/minha-conta/');
    await interruptor.check();
    await page.goto('/pessoas/');
    await expect(page.getByRole('link', { name: 'Nova pessoa' })).toHaveAttribute('title', 'Nova pessoa (N)');
    await page.keyboard.press('n');
    // Então
    await expect(page).toHaveURL(/\/pessoas\/nova\/$/);
  });
});

test.describe('Atalhos de teclado em Tarefas', () => {
  test('quando a pessoa aperta "N" fora de um campo, então abre o cadastro de nova tarefa', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/');
    await expect(page.getByRole('link', { name: 'Nova tarefa' })).toHaveAttribute('title', 'Nova tarefa (N)');
    // Quando
    await page.keyboard.press('n');
    // Então
    await expect(page).toHaveURL(/\/tarefas\/nova\/$/);
    await expect(page.getByLabel('Título')).toBeVisible();
  });

  test('quando a pessoa aperta "/" e digita, então o texto vai para a busca de Tarefas, e "?" com o foco nela entra como letra', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/');
    await expect(page.getByRole('heading', { name: 'Tarefas' })).toBeVisible();
    // Quando
    await page.keyboard.press('/');
    await page.keyboard.type('n?');
    // Então
    await expect(page.getByRole('searchbox')).toHaveValue('n?');
    await expect(page.getByRole('dialog', { name: 'Atalhos do teclado' })).toBeHidden();
    await expect(page).toHaveURL(/\/tarefas\/$/);
  });
});
