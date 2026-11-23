// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Tarefas (#313): a aprovação interna antes de concluir. O Mauro (administrador) pede a tarefa ao Bruno (estagiário, não aprova);
// concluída pelo Bruno, ela espera na coluna de aprovação até o Mauro aprovar ou devolver com um comentário.
import { expect, test, type Page } from '@playwright/test';
import { entrarComo } from './ajudantes';

const cartaoAberto = (page: Page) => page.getByRole('dialog').filter({ has: page.getByRole('heading', { level: 2 }) });
const situacao = (page: Page) => cartaoAberto(page).getByRole('combobox', { name: 'Situação da tarefa' }).getByRole('option', { selected: true });

/** O Mauro cadastra a tarefa para o Bruno: a caixa "Precisa de aprovação" vem marcada sozinha. Devolve o endereço do cartão. */
async function pedirAoBruno(page: Page, titulo: string) {
  await page.goto('/tarefas/nova/');
  await page.getByLabel('Título').fill(titulo);
  await page.getByRole('button', { name: 'Próxima' }).click();
  const caixa = page.getByRole('checkbox', { name: 'Precisa de aprovação' });
  await expect(caixa).not.toBeChecked();
  await page.getByLabel(/Responsável/).selectOption({ label: 'Bruno Exemplo Souza' });
  await expect(caixa).toBeChecked();
  await page.getByRole('button', { name: 'Salvar tarefa' }).click();
  await expect(cartaoAberto(page).getByRole('heading', { name: titulo })).toBeVisible();
  await expect(cartaoAberto(page).getByText('Pedida por')).toContainText('que aprova a conclusão');
  return new URL(page.url()).pathname + new URL(page.url()).search;
}

/** O Bruno abre o cartão e conclui: a tarefa vai para a aprovação. */
async function brunoConclui(page: Page, endereco: string) {
  await entrarComo(page, 'u-bruno');
  await page.goto(endereco);
  await cartaoAberto(page).getByRole('button', { name: 'Concluir', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Tarefa enviada para a aprovação de quem a pediu.' })).toBeVisible();
  await expect(situacao(page)).toHaveText(/AGUARDANDO: ANÁLISE DO SOLICITANTE/i);
  await expect(cartaoAberto(page).getByText('Esta tarefa espera a aprovação de Mauro Teixeira Duarte.')).toBeVisible();
  await expect(cartaoAberto(page).getByRole('button', { name: 'Aprovar' })).toHaveCount(0);
}

test.describe('Aprovação interna da tarefa (#313)', () => {
  test('quando o Bruno conclui a tarefa que o Mauro pediu, então ela espera a aprovação; o Mauro devolve com um comentário e ela volta para "Fazendo"', async ({ page }) => {
    // Dado
    const endereco = await pedirAoBruno(page, 'Minutar a contestação');
    // Quando / Então
    await brunoConclui(page, endereco);
    // Quando
    await entrarComo(page, 'u-master');
    await page.goto(endereco);
    await expect(cartaoAberto(page).getByText('Esta tarefa espera a sua aprovação.')).toBeVisible();
    await cartaoAberto(page).getByRole('button', { name: 'Devolver' }).click();
    await page.getByRole('textbox', { name: 'O que precisa ser ajustado?' }).fill('Falta o pedido de tutela.');
    await page.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(page.getByRole('status').filter({ hasText: 'Tarefa devolvida, com o seu comentário.' })).toBeVisible();
    await expect(situacao(page)).toHaveText(/FAZENDO/i);
    await expect(cartaoAberto(page).getByText('Tarefa devolvida: Falta o pedido de tutela.')).toBeVisible();
    await expect(cartaoAberto(page).getByText('Esta tarefa espera a sua aprovação.')).toHaveCount(0);
  });

  test('quando o Mauro aprova a tarefa que o Bruno concluiu, então ela vai para as concluídas', async ({ page }) => {
    // Dado
    const endereco = await pedirAoBruno(page, 'Revisar o contrato social');
    await brunoConclui(page, endereco);
    // Quando
    await entrarComo(page, 'u-master');
    await page.goto(endereco);
    await cartaoAberto(page).getByRole('button', { name: 'Aprovar' }).click();
    // Então
    await expect(page.getByRole('status').filter({ hasText: 'Tarefa aprovada e concluída.' })).toBeVisible();
    await expect(situacao(page)).toHaveText(/CONCLUÍDA/i);
    await expect(cartaoAberto(page).getByRole('button', { name: 'Reabrir', exact: true })).toBeVisible();
  });
});
