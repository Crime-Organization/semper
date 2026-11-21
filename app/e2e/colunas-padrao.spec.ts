// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Colunas padrão que chegaram depois (#314, #315), no banco fictício. Quem está logado é o Mauro (administrador).
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 2000, height: 1000 } });

/** O topo do quadro na ordem da tela: o nome de cada coluna sem grupo e "Grupo X" para cada grupo. */
const topo = (page: Page) => page.getByRole('region', { name: 'Quadro' }).evaluate(q =>
  [...q.querySelectorAll<HTMLElement>('[data-topo]')].map(el => el.getAttribute('aria-label') ?? el.querySelector('h3')?.textContent));

test.describe('Colunas padrão novas', () => {
  test('quando a pessoa abre o quadro de Tarefas, então as duas colunas de espera estão depois de "Fazendo" (#314)', async ({ page }) => {
    // Quando
    await page.goto('/tarefas/');
    await page.getByRole('button', { name: 'Kanban' }).click();
    // Então
    await expect.poll(() => topo(page)).toEqual(['Para fazer', 'Fazendo', 'Aguardando: análise do solicitante', 'Aguardando: retorno do cliente',
      'Aguardando retorno', 'Concluída']);
    await expect(page.getByRole('list', { name: 'Aguardando: análise do solicitante', exact: true })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Aguardando: retorno do cliente', exact: true })).toBeVisible();
  });

  test('quando a pessoa recarrega a página, então as colunas não se repetem (#314)', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/');
    await page.getByRole('button', { name: 'Kanban' }).click();
    await expect(page.getByRole('list', { name: 'Aguardando: retorno do cliente', exact: true })).toBeVisible();
    // Quando
    await page.reload();
    await page.getByRole('button', { name: 'Kanban' }).click();
    // Então
    await expect.poll(() => topo(page)).toEqual(['Para fazer', 'Fazendo', 'Aguardando: análise do solicitante', 'Aguardando: retorno do cliente',
      'Aguardando retorno', 'Concluída']);
  });
});
