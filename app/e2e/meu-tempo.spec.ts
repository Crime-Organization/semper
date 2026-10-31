// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Meu tempo trabalhado. Na semente do banco fictício, de ontem: Mateus tem 1 h 20 min em "Emitir a GRU"; Bruno tem
// 40 min em "Emitir a GRU" e 50 min em "Organizar a pasta", menos um ajuste de 10 min feito hoje. Quem está logado é o
// Mateus (administrador).
import { expect, test, type Page } from '@playwright/test';

/** Uma data de N dias atrás (ou adiante), no formato do campo de data. */
function dia(deslocamento: number) {
  const d = new Date();
  d.setDate(d.getDate() + deslocamento);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Escolhe um intervalo de datas (a semente é de ontem, e "esta semana" nem sempre inclui ontem). */
async function ultimosDias(page: Page) {
  await page.getByLabel('Período').selectOption({ label: 'Escolher as datas' });
  await page.getByLabel('Primeiro dia').fill(dia(-7));
  await page.getByLabel('Último dia').fill(dia(0));
}

test.describe('Meu tempo trabalhado', () => {
  test('quando a pessoa abre "Meu tempo trabalhado" no menu de Tarefas, então vê cada tarefa com o tempo dela no período e o total', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/');
    // Quando
    await page.getByRole('button', { name: 'Mais ações' }).click();
    await page.getByRole('menuitem', { name: 'Meu tempo trabalhado' }).click();
    await ultimosDias(page);
    // Então
    await expect(page.getByRole('heading', { name: 'Meu tempo trabalhado', level: 1 })).toBeVisible();
    const tabela = page.getByRole('table', { name: 'Tempo por tarefa' });
    await expect(tabela.getByRole('row').filter({ hasText: 'Emitir a GRU' })).toContainText('1 h 20 min');
    await expect(tabela.getByRole('row').filter({ hasText: 'Organizar a pasta' })).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'Total' })).toHaveText('Total: 1 h 20 min');
  });

  test('quando o administrador escolhe outra pessoa da equipe, então vê o tempo dela, com o ajuste descontado', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/meu-tempo/');
    await ultimosDias(page);
    // Quando
    await page.getByLabel('De quem').selectOption({ label: 'Bruno Exemplo Souza' });
    // Então
    await expect(page.getByRole('heading', { name: 'Tempo de Bruno Exemplo Souza', level: 1 })).toBeVisible();
    const linhas = page.getByRole('table', { name: 'Tempo por tarefa' }).getByRole('row');
    await expect(linhas.filter({ hasText: 'Emitir a GRU' })).toContainText('40 min');
    await expect(linhas.filter({ hasText: 'Organizar a pasta' })).toContainText('40 min');
    await expect(page.getByRole('status').filter({ hasText: 'Total' })).toHaveText('Total: 1 h 20 min');
  });

  test('quando não há tempo no período, então a página diz que não há nada registrado', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/meu-tempo/');
    // Quando: um intervalo no futuro
    await page.getByLabel('Período').selectOption({ label: 'Escolher as datas' });
    await page.getByLabel('Primeiro dia').fill(dia(30));
    await page.getByLabel('Último dia').fill(dia(31));
    // Então
    await expect(page.getByText(/^Nenhum tempo registrado de /)).toBeVisible();
    await expect(page.getByRole('table', { name: 'Tempo por tarefa' })).toHaveCount(0);
  });

  test('quando as datas estão trocadas, então a página avisa e não mostra a tabela', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/meu-tempo/');
    // Quando
    await page.getByLabel('Período').selectOption({ label: 'Escolher as datas' });
    await page.getByLabel('Primeiro dia').fill(dia(0));
    await page.getByLabel('Último dia').fill(dia(-3));
    // Então
    await expect(page.getByText('O primeiro dia vem antes do último.')).toBeVisible();
    await expect(page.getByRole('table', { name: 'Tempo por tarefa' })).toHaveCount(0);
  });

  test('quando a pessoa clica numa tarefa da lista, então abre o cartão da tarefa', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/meu-tempo/');
    await ultimosDias(page);
    // Quando
    await page.getByRole('table', { name: 'Tempo por tarefa' }).getByRole('link', { name: 'Emitir a GRU' }).click();
    // Então
    await expect(page).toHaveURL(/\/tarefas\/\?id=/);
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Emitir a GRU', level: 2 })).toBeVisible();
  });
});
