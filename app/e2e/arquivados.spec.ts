// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Arquivados à vista em todos os módulos: a coluna fixa "Arquivados" no fim do quadro e a seção recolhível
// "Arquivados" embaixo da tabela. Na semente do banco fictício, "Renovar a procuração" é uma tarefa em "Para fazer" e o
// contrato de MARIA APARECIDA EXEMPLO está ativo. Quem está logado é o Mateus (administrador).
import { expect, test } from '@playwright/test';

test.describe('Arquivados no quadro', () => {
  // Tela bem larga: as colunas de "Para fazer" até "Arquivados" ficam todas à vista, para arrastar entre elas.
  test.use({ viewport: { width: 2400, height: 1000 } });

  test('quando a pessoa arrasta um cartão para "Arquivados", então ele é arquivado; arrastado de volta, volta para a coluna', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/');
    await page.getByRole('button', { name: 'Kanban' }).click();
    const arquivados = page.getByRole('list', { name: 'Arquivados', exact: true });
    const titulos = await page.getByRole('region', { name: 'Quadro' }).getByRole('heading', { level: 3 }).allTextContents();
    expect(titulos.at(-1)).toBe('Arquivados');
    await expect(arquivados.getByText('Nenhum item.')).toBeVisible();
    // Quando
    await page.getByRole('list', { name: 'Para fazer', exact: true }).getByRole('listitem').filter({ hasText: 'Renovar a procuração' }).dragTo(arquivados);
    // Então
    await expect(arquivados.getByRole('listitem').filter({ hasText: 'Renovar a procuração' })).toBeVisible();
    await expect(page.getByText('F00D1234 foi para Arquivados.')).toBeVisible();
    // Quando: de volta, para "Fazendo"
    const fazendo = page.getByRole('list', { name: 'Fazendo', exact: true });
    await arquivados.getByRole('listitem').filter({ hasText: 'Renovar a procuração' }).dragTo(fazendo);
    // Então
    await expect(page.getByText('F00D1234 saiu de Arquivados e foi para "Fazendo".')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('list', { name: 'Fazendo', exact: true }).getByRole('listitem').filter({ hasText: 'Renovar a procuração' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Arquivados', exact: true }).getByRole('listitem').filter({ hasText: 'Renovar a procuração' })).toHaveCount(0);
  });
});

test.describe('Arquivados na tabela', () => {
  test('quando a pessoa arquiva um contrato, então ele sai da tabela e aparece em "Arquivados" embaixo dela, de onde volta ao desarquivar', async ({ page }) => {
    // Dado
    await page.goto('/contratos/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    const maria = page.getByRole('row').filter({ hasText: 'MARIA APARECIDA EXEMPLO' });
    // Quando
    await maria.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Arquivar', exact: true }).click();
    // Então: a seção mostra quantos há, mesmo fechada, e ao abrir mostra o contrato
    const secao = page.getByRole('button', { name: /^Arquivados/ });
    await expect(secao).toContainText('1');
    await expect(maria).toHaveCount(0);
    await secao.click();
    await expect(maria).toHaveCount(1);
    // Quando
    await maria.getByRole('checkbox').check();
    await page.getByRole('group', { name: 'Ações nos arquivados selecionados' }).getByRole('button', { name: 'Desarquivar' }).click();
    // Então
    await expect(page.getByText('1 contrato voltou para a lista.')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'MARIA APARECIDA EXEMPLO' })).toHaveCount(1);
    await expect(secao).not.toContainText('1');
  });
});
