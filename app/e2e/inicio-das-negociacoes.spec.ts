// Início das negociações do contrato e demanda sem contrato (#311). Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Na semente do banco fictício, o contrato de MARIA APARECIDA EXEMPLO ("Ação de cobrança") está em negociação, sem assinatura, e a
// demanda "Notificar o devedor" não tem contrato (as do contrato de JOSÉ DA SILVA TESTE têm).
import { expect, test, type Page } from '@playwright/test';
import { entrarComo } from './ajudantes';

async function abrirContrato(page: Page, cliente: string) {
  await page.goto('/contratos/');
  await page.getByRole('button', { name: 'Tabela', exact: true }).click();
  await page.getByRole('row').filter({ hasText: cliente }).click();
  const cartao = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: cliente, level: 2 }) });
  await expect(cartao).toBeVisible();
  return cartao;
}
/** Grava, pelo lápis, o início das negociações e a assinatura do contrato de MARIA APARECIDA EXEMPLO. */
async function datasNoLapis(page: Page, inicio: string, assinatura: string) {
  const cartao = await abrirContrato(page, 'MARIA APARECIDA EXEMPLO');
  await cartao.getByRole('button', { name: 'Editar', exact: true }).click();
  const edicao = cartao.getByRole('form', { name: 'Editar contrato' });
  await edicao.getByRole('textbox', { name: 'Início das negociações' }).fill(inicio);
  await edicao.getByRole('textbox', { name: 'Assinado em' }).fill(assinatura);
  await cartao.getByRole('button', { name: 'Salvar', exact: true }).click();
  return cartao;
}

test.describe('Início das negociações do contrato (#311)', () => {
  test('dado o lápis do contrato, quando a pessoa informa o início das negociações e a assinatura, então o cartão mostra as datas e os dias da negociação', async ({ page }) => {
    // Quando
    const cartao = await datasNoLapis(page, '01/03/2026', '10/03/2026');
    // Então
    const datas = cartao.getByRole('group', { name: 'Início das negociações' });
    await expect(datas).toContainText('01/03/2026');
    await expect(cartao.getByRole('group', { name: 'Negociação' })).toContainText('9 dias');
    // E o histórico registra a data, com o nome do campo
    await cartao.getByRole('button', { name: /Histórico de alterações/ }).click();
    await expect(cartao.getByText('Início das negociações: 01/03/2026')).toBeVisible();
  });

  test('dado o início das negociações depois da assinatura, quando a pessoa tenta salvar, então o lápis avisa e não grava', async ({ page }) => {
    // Quando
    const cartao = await datasNoLapis(page, '20/03/2026', '10/03/2026');
    // Então
    await expect(cartao.getByText('O início das negociações não pode ser depois da assinatura.')).toBeVisible();
    await expect(cartao.getByRole('form', { name: 'Editar contrato' })).toBeVisible();
  });

  test('dado a tabela de contratos, quando a pessoa mostra a coluna do início das negociações no ⋯, então ela aparece com a data e continua depois de recarregar', async ({ page }) => {
    // Dado
    const cartao = await datasNoLapis(page, '01/03/2026', '10/03/2026');
    await expect(cartao.getByRole('group', { name: 'Negociação' })).toBeVisible();
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    await expect(cartao).toBeHidden();
    await expect(page.getByRole('columnheader', { name: 'Início das negociações' })).toHaveCount(0);
    // Quando
    await page.getByRole('button', { name: 'Mais ações' }).click();
    await page.getByRole('menuitem', { name: 'Mostrar a coluna Início das negociações' }).click();
    // Então
    await expect(page.getByRole('columnheader', { name: 'Início das negociações' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'MARIA APARECIDA EXEMPLO' })).toContainText('01/03/2026');
    await page.reload();
    await expect(page.getByRole('columnheader', { name: 'Início das negociações' })).toBeVisible();
    // Quando: esconde de novo
    await page.getByRole('button', { name: 'Mais ações' }).click();
    await page.getByRole('menuitem', { name: 'Esconder a coluna Início das negociações' }).click();
    // Então
    await expect(page.getByRole('columnheader', { name: 'Início das negociações' })).toHaveCount(0);
  });

  test('dado quem não é parte do contrato, quando mostra a coluna do início das negociações, então a data fica oculta, como no cartão', async ({ page }) => {
    // Dado: o contrato da MARIA APARECIDA EXEMPLO (da Ana) com o início das negociações, e a chave "equipe vê tudo" ligada
    const cartao = await datasNoLapis(page, '01/03/2026', '10/03/2026');
    await expect(cartao.getByRole('group', { name: 'Negociação' })).toBeVisible();
    await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { equipeVeTudo(l: boolean): void } }).SEMPER_FALSO.equipeVeTudo(true));
    await entrarComo(page, 'u-bruno');
    // Quando
    await page.goto('/contratos/');
    await page.getByRole('button', { name: 'Tabela', exact: true }).click();
    await page.getByRole('button', { name: 'Mais ações' }).click();
    await page.getByRole('menuitem', { name: 'Mostrar a coluna Início das negociações' }).click();
    // Então: a linha mostra "Oculto" no lugar da data, e o cartão também não a mostra
    await expect(page.getByRole('columnheader', { name: 'Início das negociações' })).toBeVisible();
    const linha = page.getByRole('row').filter({ hasText: 'MARIA APARECIDA EXEMPLO' });
    await expect(linha).toContainText('Oculto');
    await expect(linha).not.toContainText('01/03/2026');
    await linha.click();
    await expect(page.getByRole('dialog').getByText('toda a equipe vê este contrato, sem os valores', { exact: false })).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('group', { name: 'Início das negociações' })).toHaveCount(0);
  });
});

test.describe('Demanda sem contrato (#311)', () => {
  test('dado o quadro e a tabela de Demandas, quando há demanda sem contrato, então ela tem o selo "Sem contrato", e as do contrato não', async ({ page }) => {
    // Dado
    await page.goto('/demandas/');
    await page.getByRole('button', { name: 'Kanban' }).click();
    // Então: no quadro
    const avulsa = page.getByRole('listitem').filter({ hasText: 'Notificar o devedor' });
    await expect(avulsa.getByText('Sem contrato', { exact: true })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Busca de anterioridade' }).getByText('Sem contrato', { exact: true })).toHaveCount(0);
    // Então: na tabela
    await page.getByRole('button', { name: 'Tabela', exact: true }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Notificar o devedor' }).getByText('Sem contrato', { exact: true })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Registro de marca' }).getByText('Sem contrato', { exact: true })).toHaveCount(0);
  });

  test('dado o filtro de Demandas, quando a pessoa escolhe "Sem contrato", então vê só essas', async ({ page }) => {
    // Dado
    await page.goto('/demandas/');
    await page.getByRole('button', { name: 'Tabela', exact: true }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Registro de marca' })).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Filtros' }).click();
    await page.getByRole('dialog', { name: 'Filtros' }).getByRole('combobox', { name: 'Contrato' }).selectOption({ label: 'Sem contrato' });
    // Então
    await expect(page.getByRole('row').filter({ hasText: 'Notificar o devedor' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Registro de marca' })).toHaveCount(0);
    await expect(page.getByRole('row').filter({ hasText: 'Busca de anterioridade' })).toHaveCount(0);
  });
});
