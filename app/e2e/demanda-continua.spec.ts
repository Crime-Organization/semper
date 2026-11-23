// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A demanda contínua (#313): a tarefa sem demanda entra na contínua do grupo da equipe (ou na Geral, de quem não está em grupo
// nenhum). Quem está logado é o Mauro (administrador), sem grupo na semente do banco fictício.
import { expect, test } from '@playwright/test';
import { abrirSecao, menuDoCartao } from './ajudantes';

test.describe('Tarefa avulsa na demanda contínua (#313)', () => {
  test('quando a pessoa sem grupo cadastra uma tarefa sem demanda, então a Geral já vem marcada e a tarefa entra na contínua Geral', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/nova/');
    await page.getByLabel('Título').fill('Organizar a pasta do cliente');
    // Então
    const grupo = page.getByRole('group', { name: /Grupo da tarefa avulsa/ });
    await expect(grupo.getByRole('radio', { name: 'Geral' })).toBeChecked();
    // Quando
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar tarefa' }).click();
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'Organizar a pasta do cliente' })).toBeVisible();
    await abrirSecao(cartao, 'Demanda');
    await expect(cartao.getByText('Contínua: Geral').first()).toBeVisible();
  });

  test('quando a pessoa escolhe uma demanda, então a pergunta do grupo some', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/nova/');
    await page.getByLabel('Título').fill('Juntar as certidões');
    await expect(page.getByRole('group', { name: /Grupo da tarefa avulsa/ })).toBeVisible();
    // Quando
    await page.getByRole('combobox', { name: 'Demanda' }).fill('Notificar');
    await page.getByRole('option', { name: /Notificar o devedor/ }).click();
    // Então
    await expect(page.getByRole('group', { name: /Grupo da tarefa avulsa/ })).toHaveCount(0);
  });

  test('dada a contínua, quando a pessoa abre o cartão dela, então vê o selo e a explicação, e não há Arquivar', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/nova/');
    await page.getByLabel('Título').fill('Pagar a guia');
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar tarefa' }).click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Pagar a guia' })).toBeVisible();
    // Quando
    await page.goto('/demandas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'Contínua: Geral' }).click();
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'Contínua: Geral', level: 2 })).toBeVisible();
    await expect(cartao.getByText('Contínua', { exact: true }).first()).toBeVisible();
    await expect(cartao.getByText(/Esta é a demanda contínua/)).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Editar' })).toHaveCount(0);
    const menu = menuDoCartao(cartao);
    if (await menu.count()) await menu.click();
    await expect(page.getByRole('menuitem', { name: 'Arquivar' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Arquivar', exact: true })).toHaveCount(0);
  });
});
