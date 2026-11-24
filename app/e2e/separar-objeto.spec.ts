// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Separar um objeto de contrato em dois ou mais, na lista das Configurações (#410). Na semente do banco fictício, o contrato de JOSÉ DA
// SILVA TESTE tem "Registro de marca" e "Busca de anterioridade", cada um com a sua demanda; o de MARIA APARECIDA EXEMPLO tem "Ação de
// cobrança", sem demanda. Quem está logado é o Mauro (administrador).
import { expect, test, type Page } from '@playwright/test';

async function abrirObjetos(page: Page) {
  await page.goto('/configuracoes/');
  const secao = page.getByRole('region', { name: 'Objetos de contrato' });
  await expect(secao.getByRole('row').nth(1)).toBeVisible();
  return secao;
}
const linha = (secao: ReturnType<Page['getByRole']>, nome: string) => secao.getByRole('row', { name: new RegExp(`^Marcar ${nome} para juntar `) });

test.describe('Separar um objeto de contrato (#410)', () => {
  test('dado um objeto com demanda, quando o administrador o separa em dois e escolhe o objeto da demanda, então o contrato tem os dois e a demanda fica ligada ao escolhido', async ({ page }) => {
    // Dado
    const secao = await abrirObjetos(page);
    // Quando
    await secao.getByRole('button', { name: 'Separar o objeto Registro de marca' }).click();
    const separacao = secao.getByRole('group', { name: 'Separar o objeto Registro de marca' });
    await expect(separacao.getByText(/Muda em 1 contrato e 1 demanda/)).toBeVisible();
    await separacao.getByLabel('Nome novo 1').fill('Pedido de registro');
    await separacao.getByLabel('Nome novo 2').fill('Acompanhamento do registro');
    await separacao.getByRole('button', { name: /Separar/ }).click();
    await separacao.getByRole('button', { name: 'Confirmar: separar Registro de marca' }).click();
    // Então: sem escolher o objeto da demanda, a tela pergunta
    await expect(separacao.getByText('Escolha o objeto novo de cada demanda.')).toBeVisible();
    // Quando
    await separacao.getByLabel(/^Registro de marca \(demanda /).selectOption('Pedido de registro');
    await separacao.getByRole('button', { name: /Separar/ }).click();
    await separacao.getByRole('button', { name: 'Confirmar: separar Registro de marca' }).click();
    // Então
    await expect(page.getByText('Objeto separado em "Pedido de registro" e "Acompanhamento do registro". Mudou em 1 contrato e 1 demanda.')).toBeVisible();
    await expect(linha(secao, 'Registro de marca')).toHaveCount(0);
    await expect(linha(secao, 'Pedido de registro').getByRole('cell')).toHaveText(['', 'Pedido de registro', '1', '1', /Corrigir/]);
    await expect(linha(secao, 'Acompanhamento do registro').getByRole('cell')).toHaveText(['', 'Acompanhamento do registro', '1', '0', /Corrigir/]);
    await page.goto('/contratos/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await expect(page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }))
      .toContainText('Pedido de registro; Acompanhamento do registro; Busca de anterioridade');
    await page.goto('/demandas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Pedido de registro' })).toHaveCount(1);
  });

  test('dado um objeto sem demanda, quando o administrador o separa, então não pergunta de demandas e o contrato passa a ter os dois', async ({ page }) => {
    // Dado
    const secao = await abrirObjetos(page);
    // Quando
    await secao.getByRole('button', { name: 'Separar o objeto Ação de cobrança' }).click();
    const separacao = secao.getByRole('group', { name: 'Separar o objeto Ação de cobrança' });
    await separacao.getByLabel('Nome novo 1').fill('Ação de cobrança');
    await separacao.getByLabel('Nome novo 2').fill('Notificação ao devedor');
    await expect(separacao.getByRole('group', { name: 'A qual objeto novo cada demanda fica ligada?' })).toHaveCount(0);
    await separacao.getByRole('button', { name: /Separar/ }).click();
    await separacao.getByRole('button', { name: 'Confirmar: separar Ação de cobrança' }).click();
    // Então
    await expect(page.getByText('Objeto separado em "Ação de cobrança" e "Notificação ao devedor". Mudou em 1 contrato e 0 demandas.')).toBeVisible();
    await expect(linha(secao, 'Ação de cobrança')).toBeVisible();
    await expect(linha(secao, 'Notificação ao devedor')).toBeVisible();
    await page.goto('/contratos/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await expect(page.getByRole('row').filter({ hasText: 'MARIA APARECIDA EXEMPLO' })).toContainText('Ação de cobrança; Notificação ao devedor');
  });
});
