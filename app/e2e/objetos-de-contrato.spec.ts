// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A lista de objetos de contrato nas Configurações (#281). Na semente do banco fictício, o contrato de JOSÉ DA SILVA TESTE tem
// "Registro de marca" e "Busca de anterioridade", cada um com a sua demanda; o de MARIA APARECIDA EXEMPLO tem "Ação de cobrança"; o da
// COMERCIAL NORTE TESTE LTDA tem "Ação de indenização por danos morais". Quem está logado é o Mauro (administrador).
import { expect, test, type Page } from '@playwright/test';
import { entrarComo } from './ajudantes';

async function abrirObjetos(page: Page) {
  await page.goto('/configuracoes/');
  const secao = page.getByRole('region', { name: 'Objetos de contrato' });
  await expect(secao.getByRole('row').nth(1)).toBeVisible();
  return secao;
}
const linha = (secao: ReturnType<Page['getByRole']>, nome: string) => secao.getByRole('row', { name: new RegExp(`^Marcar ${nome.replace(/[.()]/g, '\\$&')} para juntar `) });
async function corrigir(secao: ReturnType<Page['getByRole']>, de: string, para: string) {
  await secao.getByRole('button', { name: `Corrigir o objeto ${de}` }).click();
  await secao.getByLabel('Nome do objeto').fill(para);
  await secao.getByRole('button', { name: 'Salvar nome' }).click();
}
/** A linha do contrato na tabela de Contratos. */
async function contratoDe(page: Page, cliente: string) {
  await page.goto('/contratos/');
  await page.getByRole('button', { name: 'Tabela' }).click();
  return page.getByRole('row').filter({ hasText: cliente });
}

test.describe('Objetos de contrato nas Configurações (#281)', () => {
  test('quando o administrador abre a lista, então vê cada objeto com quantos contratos e demandas o usam', async ({ page }) => {
    // Dado / Quando
    const secao = await abrirObjetos(page);
    // Então
    await expect(linha(secao, 'Registro de marca').getByRole('cell')).toHaveText(['', 'Registro de marca', '1', '1', /Corrigir/]);
    await expect(linha(secao, 'Ação de cobrança').getByRole('cell')).toHaveText(['', 'Ação de cobrança', '1', '0', /Corrigir/]);
  });

  test('quando o administrador corrige um nome, então ele muda na lista, no contrato e na demanda nascida dele', async ({ page }) => {
    // Dado
    const secao = await abrirObjetos(page);
    // Quando
    await corrigir(secao, 'Registro de marca', '  Registro de marca no INPI ');
    // Então
    await expect(page.getByText('Objeto corrigido: "Registro de marca no INPI". Mudou em 1 contrato e 1 demanda.')).toBeVisible();
    await expect(linha(secao, 'Registro de marca no INPI')).toBeVisible();
    await expect(linha(secao, 'Registro de marca')).toHaveCount(0);
    await expect(await contratoDe(page, 'JOSÉ DA SILVA TESTE')).toContainText('Registro de marca no INPI; Busca de anterioridade');
    await page.goto('/demandas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Registro de marca no INPI' })).toHaveCount(1);
  });

  test('dado um nome corrigido, quando o administrador desfaz, então o nome antigo volta; e o nome de outro objeto é recusado', async ({ page }) => {
    // Dado
    const secao = await abrirObjetos(page);
    await corrigir(secao, 'Registro de marca', 'Registro de marca no INPI');
    // Quando
    await page.getByRole('button', { name: 'Desfazer' }).click();
    // Então
    await expect(linha(secao, 'Registro de marca')).toBeVisible();
    await expect(linha(secao, 'Registro de marca no INPI')).toHaveCount(0);
    // Quando: o nome de outro objeto
    await corrigir(secao, 'Registro de marca', 'busca de anterioridade');
    // Então
    await expect(secao.getByText('Já existe um objeto com esse nome. Para unir os dois, marque-os e use Juntar.')).toBeVisible();
  });

  test('dados dois objetos parecidos, quando o administrador os junta, então fica um só, e o contrato passa a usar o que ficou', async ({ page }) => {
    // Dado: um objeto escrito quase igual a outro
    const secao = await abrirObjetos(page);
    await corrigir(secao, 'Ação de indenização por danos morais', 'Ação de cobrança.');
    await expect(linha(secao, 'Ação de cobrança.').getByText('parecido')).toBeVisible();
    await expect(linha(secao, 'Ação de cobrança').getByText('parecido')).toBeVisible();
    // Quando
    await secao.getByLabel('Marcar Ação de cobrança. para juntar').check();
    await secao.getByLabel('Marcar Ação de cobrança para juntar').check();
    const juncao = secao.getByRole('group', { name: 'Juntar objetos' });
    await juncao.getByLabel('Ação de cobrança', { exact: true }).check();
    await expect(juncao.getByText('Sai 1 objeto, usado em 1 contrato e 0 demandas. Ele passa a ter o nome do que fica. Não dá para desfazer.')).toBeVisible();
    await juncao.getByRole('button', { name: /Juntar 2 objetos/ }).click();
    await juncao.getByRole('button', { name: 'Confirmar: juntar em Ação de cobrança' }).click();
    // Então
    await expect(page.getByText('Objetos juntados em "Ação de cobrança". Mudou em 1 contrato e 0 demandas.')).toBeVisible();
    await expect(linha(secao, 'Ação de cobrança.')).toHaveCount(0);
    await expect(linha(secao, 'Ação de cobrança').getByRole('cell')).toHaveText(['', 'Ação de cobrança', '2', '0', /Corrigir/]);
    await expect(await contratoDe(page, 'COMERCIAL NORTE TESTE LTDA')).toContainText('Ação de cobrança');
  });

  test('dado um objeto em uso, quando o administrador tenta apagá-lo, então o SEMPER diz quantos contratos o usam e não apaga', async ({ page }) => {
    // Dado
    const secao = await abrirObjetos(page);
    // Quando
    await secao.getByRole('button', { name: 'Apagar o objeto Registro de marca' }).click();
    // Então
    await expect(page.getByText('Este objeto está em 1 contrato. Troque-o por outro antes de apagar: marque os dois e use Juntar.')).toBeVisible();
    await expect(linha(secao, 'Registro de marca')).toBeVisible();
  });

  test('quando quem não é administrador abre as Configurações, então não chega à lista de objetos', async ({ page }) => {
    // Dado
    await entrarComo(page, 'u-bruno');
    // Quando
    await page.goto('/configuracoes/');
    // Então
    await expect(page.getByRole('region', { name: 'Objetos de contrato' })).toHaveCount(0);
  });
});
