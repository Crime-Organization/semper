// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O processo administrativo ligado ao judicial que nasceu dele (#425), em "Processos relacionados" nos dois cartões, e os campos de PI
// só no administrativo. Na semente do banco fictício: o processo judicial 0001234-97.2026.8.13.0024, de JOSÉ DA SILVA TESTE, e a pessoa
// LUCIANA ROCHA AMOSTRA. Quem está logado é o Mauro (administrador).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao } from './ajudantes';

const NUMERO_ADMINISTRATIVO = 'BR 10 2020 004567-8';
const NUMERO_JUDICIAL = '0005678-13.2026.8.13.0433';
const JUDICIAL_DA_SEMENTE = '0001234-97.2026.8.13.0024';

/** A seção do cartão pelo título (aberta). */
async function secao(cartao: Locator, titulo: string) {
  await abrirSecao(cartao, titulo);
  return cartao.locator('section', { has: cartao.page().getByRole('button', { name: new RegExp(`^${titulo}( \\d+)?$`) }) });
}
/** Cadastra um processo administrativo da LUCIANA na área dada e devolve o cartão dele, aberto depois de salvar. */
async function administrativo(page: Page, area: string, protecao?: string) {
  await page.goto('/processos/novo/');
  await page.getByRole('group', { name: 'Tipo' }).getByText('Administrativo', { exact: true }).click();
  await page.getByLabel('Número do processo').fill(NUMERO_ADMINISTRATIVO);
  await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByRole('textbox', { name: 'Cliente', exact: true }).fill('luciana');
  await page.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ }).click();
  await page.getByLabel('Papel do cliente').selectOption('autor');
  await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByLabel('Área do direito').selectOption({ label: area });
  if (protecao) await page.getByLabel('Tipo de proteção').selectOption({ label: protecao });
  await page.getByRole('button', { name: 'Salvar processo' }).click();
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByRole('heading', { name: 'LUCIANA ROCHA AMOSTRA', level: 2 })).toBeVisible();
  return cartao;
}

test.describe('O administrativo e o judicial que nasceu dele (#425)', () => {
  test('dado um administrativo de PI, quando cria o judicial a partir dele, então o judicial nasce sem os campos de PI, e cada cartão mostra o outro', async ({ page }) => {
    // Dado
    let cartao = await administrativo(page, 'Propriedade intelectual', 'Marca');
    await expect(cartao.getByRole('button', { name: /^Validade e anuidades/ })).toBeVisible();
    let relacionados = await secao(cartao, 'Processos relacionados');
    await expect(relacionados).toContainText('Nenhum processo relacionado a este.');
    // Quando
    await relacionados.getByRole('link', { name: 'Novo processo judicial a partir deste' }).click();
    // Então o cadastro já vem como judicial, ligado ao administrativo
    await expect(page.getByText(/Este processo nasce do processo/)).toBeVisible();
    await expect(page.getByRole('group', { name: 'Este processo é' }).getByRole('radio', { name: 'Processo judicial a partir do administrativo' })).toBeChecked();
    await expect(page.getByRole('group', { name: 'Tipo' })).toHaveCount(0);
    await page.getByLabel('Número do processo').fill(NUMERO_JUDICIAL);
    await page.getByRole('button', { name: 'Próxima' }).click();
    await expect(page.getByTitle('LUCIANA ROCHA AMOSTRA', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Próxima' }).click();
    // E, nos detalhes, a área vem do administrativo, mas os campos de PI não aparecem
    await expect(page.getByLabel('Área do direito')).toHaveValue('Propriedade intelectual');
    await expect(page.getByLabel('Tipo de proteção')).toHaveCount(0);
    await page.getByRole('button', { name: 'Salvar processo' }).click();
    // Então volta ao administrativo, que mostra o judicial
    cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('button', { name: 'Processos relacionados 1' })).toBeVisible();
    relacionados = await secao(cartao, 'Processos relacionados');
    const judicial = relacionados.getByRole('link', { name: /Processo judicial deste administrativo/ });
    await expect(judicial).toContainText(NUMERO_JUDICIAL);
    // E o judicial mostra o administrativo de origem, sem a seção de validade
    await judicial.click();
    cartao = page.getByRole('dialog');
    await expect(cartao.getByText(NUMERO_JUDICIAL, { exact: true })).toBeVisible();
    await expect(cartao.getByRole('button', { name: /^Validade e anuidades/ })).toHaveCount(0);
    relacionados = await secao(cartao, 'Processos relacionados');
    await expect(relacionados.getByRole('link', { name: /Processo administrativo de origem/ })).toContainText(NUMERO_ADMINISTRATIVO);
    await expect(relacionados.getByRole('link', { name: 'Novo processo judicial a partir deste' })).toHaveCount(0);
  });

  test('dado um administrativo de outra área, quando liga um judicial que já existe, então os dois cartões mostram a ligação, que se desfaz pelo "x"', async ({ page }) => {
    // Dado
    let cartao = await administrativo(page, 'Previdenciário');
    let relacionados = await secao(cartao, 'Processos relacionados');
    // Quando
    await relacionados.getByRole('button', { name: 'Ligar processo judicial existente' }).click();
    await relacionados.getByRole('textbox', { name: 'Buscar processo para ligar' }).fill('0001234');
    await relacionados.getByRole('list', { name: 'Processos para ligar' }).getByRole('button', { name: /JOSÉ DA SILVA TESTE/ }).click();
    // Então
    await expect(page.getByText(/Processo judicial ligado:/)).toBeVisible();
    const judicial = relacionados.getByRole('link', { name: /Processo judicial deste administrativo/ });
    await expect(judicial).toContainText(JUDICIAL_DA_SEMENTE);
    // E o cartão do judicial mostra o administrativo
    await judicial.click();
    cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'JOSÉ DA SILVA TESTE', level: 2 })).toBeVisible();
    relacionados = await secao(cartao, 'Processos relacionados');
    await expect(relacionados.getByRole('link', { name: /Processo administrativo de origem/ })).toContainText(NUMERO_ADMINISTRATIVO);
    // Quando desfaz pelo "x" do cartão do judicial e confirma
    await relacionados.getByRole('button', { name: /Desfazer a ligação com o processo/ }).click();
    await page.getByRole('dialog', { name: 'Desfazer a ligação?' }).getByRole('button', { name: 'Desfazer a ligação' }).click();
    // Então a ligação sai
    await expect(relacionados.getByRole('link', { name: /Processo administrativo de origem/ })).toHaveCount(0);
    await expect(page.getByText(/Ligação desfeita com o processo/)).toBeVisible();
  });

  test('dado um endereço que pede o judicial a partir de um processo judicial (link antigo ou mudado à mão), quando o cadastro abre, então nada vem marcado e ele pede para escolher', async ({ page }) => {
    // Dado: o endereço do cartão do judicial da semente
    await page.goto('/processos/judicial/');
    await page.getByRole('button', { name: 'Tabela', exact: true }).click();
    await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).first().click();
    await expect(page.getByRole('dialog').getByLabel('Situação do processo')).toBeVisible();
    const id = new URL(page.url()).searchParams.get('id');
    expect(id).toBeTruthy();
    // Quando
    await page.goto(`/processos/novo/?processo=${id}&ligacao=judicial`);
    // Então só o recurso e o incidental aparecem, nenhum marcado, e seguir sem escolher mostra o que falta
    const ligacao = page.getByRole('group', { name: 'Este processo é' });
    await expect(ligacao.getByRole('radio')).toHaveCount(2);
    await expect(ligacao.getByRole('radio', { checked: true })).toHaveCount(0);
    await page.getByLabel('Número do processo').fill(NUMERO_JUDICIAL);
    await page.getByRole('button', { name: 'Próxima' }).click();
    await expect(ligacao).toContainText('Escolha se é um recurso ou um incidental.');
  });
});
