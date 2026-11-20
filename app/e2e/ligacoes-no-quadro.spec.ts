// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// As ligações no cartão do quadro (#300): o ícone de cada tipo e só o código, com o nome na dica e para o leitor de tela; na
// tabela, por extenso. Na semente do banco fictício, a tarefa "Emitir a GRU" (C0FFEE12) é da demanda "Registro de marca"
// (D3A1F09C), do contrato MA96-0001 de JOSÉ DA SILVA TESTE; "Renovar a procuração" é avulsa. Quem está logado é o Mauro.
import { expect, test, type Page } from '@playwright/test';

/** O cartão do quadro com este título. */
const cartaoNoQuadro = (page: Page, titulo: string) => page.getByRole('listitem').filter({ has: page.getByText(titulo, { exact: true }) });

test.describe('Ligações no cartão do quadro', () => {
  test('dada uma tarefa ligada a uma demanda e a um contrato, quando a pessoa olha o quadro, então vê o ícone de cada uma com só o código (#300)', async ({ page }) => {
    // Quando
    await page.goto('/tarefas/');
    await page.getByRole('button', { name: 'Kanban' }).click();
    const cartao = cartaoNoQuadro(page, 'Emitir a GRU');
    // Então
    await expect(cartao.getByText('C0FFEE12', { exact: true })).toBeVisible();
    const demanda = cartao.getByRole('img', { name: 'Demanda D3A1F09C' });
    await expect(demanda).toBeVisible();
    await expect(demanda).toHaveText('D3A1F09C');
    await expect(demanda).toHaveAttribute('data-dica', 'Demanda D3A1F09C');
    const contrato = cartao.getByRole('img', { name: /^Contrato MA96-0001/ });
    await expect(contrato).toHaveText(/^MA96-0001/);
    await expect(contrato).toHaveAttribute('data-dica', /^Contrato MA96-0001/);
    await expect(cartao).not.toContainText(/demanda|contrato/i);
  });

  test('dada uma tarefa avulsa, quando a pessoa olha o quadro, então o cartão mostra só o código dela, sem ícones de ligação (#300)', async ({ page }) => {
    // Quando
    await page.goto('/tarefas/');
    await page.getByRole('button', { name: 'Kanban' }).click();
    const cartao = cartaoNoQuadro(page, 'Renovar a procuração');
    // Então
    await expect(cartao.getByText('F00D1234', { exact: true })).toBeVisible();
    await expect(cartao.getByRole('img', { name: /^(Demanda|Contrato) / })).toHaveCount(0);
  });

  test('dada uma demanda ligada a um contrato, quando a pessoa olha o quadro de Demandas, então vê a mesma peça: o ícone e só o código (#300)', async ({ page }) => {
    // Quando
    await page.goto('/demandas/');
    await page.getByRole('button', { name: 'Kanban' }).click();
    const cartao = cartaoNoQuadro(page, 'Registro de marca');
    // Então
    await expect(cartao.getByText('D3A1F09C', { exact: true })).toBeVisible();
    await expect(cartao.getByRole('img', { name: /^Contrato MA96-0001/ })).toHaveText(/^MA96-0001/);
    await expect(cartao).not.toContainText(/contrato/i);
  });

  test('dada uma tarefa ligada, quando a pessoa olha a tabela, então as ligações continuam por extenso (#300)', async ({ page }) => {
    // Quando
    await page.goto('/tarefas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    // Então
    await expect(page.getByRole('row').filter({ hasText: 'Emitir a GRU' })).toContainText(/demanda D3A1F09C · contrato MA96-0001/);
  });

  test('dada uma demanda ligada a um contrato, quando a pessoa olha a tabela de Demandas, então a ligação continua por extenso (#300)', async ({ page }) => {
    // Quando
    await page.goto('/demandas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    // Então
    await expect(page.getByRole('row').filter({ hasText: 'Registro de marca' })).toContainText(/contrato MA96-0001/);
  });
});
