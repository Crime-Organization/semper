// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Arquivar o contrato leva junto as demandas dele; desarquivar as traz de volta (#284). Na semente do banco fictício, o contrato
// de JOSÉ DA SILVA TESTE tem as demandas "Registro de marca" e "Busca de anterioridade". Quem está logado é o Mauro (administrador).
import { expect, test, type Page } from '@playwright/test';

const JOSE = 'JOSÉ DA SILVA TESTE';
const DEMANDA = 'Busca de anterioridade';

async function abrirTabela(page: Page, modulo: string) {
  await page.goto(`/${modulo}/`);
  await page.getByRole('button', { name: 'Tabela' }).click();
}

test('dado um contrato com demandas, quando é arquivado, então elas vão junto para os arquivados e voltam quando ele é desarquivado', async ({ page }) => {
  // Dado
  await abrirTabela(page, 'demandas');
  await expect(page.getByRole('row').filter({ hasText: DEMANDA })).toHaveCount(1);
  await abrirTabela(page, 'contratos');
  const jose = page.getByRole('row').filter({ hasText: JOSE });
  // Quando
  await jose.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Arquivar', exact: true }).click();
  // Então: o aviso diz que as demandas e as tarefas foram junto, e a demanda está nos arquivados de Demandas
  await expect(page.getByText('1 contrato arquivado, com as demandas e as tarefas.')).toBeVisible();
  await abrirTabela(page, 'demandas');
  const demanda = page.getByRole('row').filter({ hasText: DEMANDA });
  await expect(demanda).toHaveCount(0);
  await page.getByRole('button', { name: /^Arquivados/ }).click();
  await expect(demanda).toHaveCount(1);

  // Quando o contrato é desarquivado
  await abrirTabela(page, 'contratos');
  await page.getByRole('button', { name: /^Arquivados/ }).click();
  await jose.getByRole('checkbox').check();
  await page.getByRole('group', { name: 'Ações nos arquivados selecionados' }).getByRole('button', { name: 'Desarquivar' }).click();
  await expect(page.getByText('1 contrato voltou para a lista.')).toBeVisible();
  // Então a demanda volta para a lista de Demandas
  await abrirTabela(page, 'demandas');
  await expect(page.getByRole('row').filter({ hasText: DEMANDA })).toHaveCount(1);
});

test('dado um contrato, quando é movido para Encerrado pelo cartão, então as demandas dele continuam ativas', async ({ page }) => {
  // Dado
  await abrirTabela(page, 'contratos');
  await page.getByRole('row').filter({ hasText: JOSE }).click();
  const cartao = page.getByRole('dialog');
  // Quando
  await cartao.getByLabel('Situação do contrato').selectOption({ label: 'ENCERRADO' });
  await cartao.getByRole('button', { name: /Histórico de alterações/ }).click();
  await expect(cartao.getByText('Situação: Assinado / em andamento → Encerrado')).toBeVisible();
  // Então
  await abrirTabela(page, 'demandas');
  await expect(page.getByRole('row').filter({ hasText: DEMANDA })).toHaveCount(1);
});
