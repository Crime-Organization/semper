// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Caminhos do cadastro de pessoa além da pessoa física (que está em pessoas.spec.ts): pessoa jurídica, MEI,
// somente contato e as validações de cada etapa.
import { expect, test, type Page } from '@playwright/test';

const CNPJ_LIVRE = '12.345.678/0001-95';   // válido e fora da semente do banco fictício
/** CNPJ com letras (alfanumérico, emitido desde julho de 2026): o exemplo da Receita, válido. */
const CNPJ_COM_LETRAS = '12.ABC.345/01DE-35';

const proxima = (page: Page) => page.getByRole('button', { name: 'Próxima' }).click();
const etapa = (page: Page, titulo: string) => expect(page.getByRole('heading', { level: 2, name: titulo })).toBeVisible();

/** Tipo pessoa jurídica, nome, CNPJ e natureza empresarial; para na etapa do tipo de entidade. */
async function comecarEmpresa(page: Page, nome: string, cnpj = CNPJ_LIVRE.replace(/\D/g, '')) {
  await page.goto('/pessoas/nova/');
  await page.getByText('Pessoa jurídica', { exact: true }).click();
  await etapa(page, 'Dados da empresa');
  await page.getByLabel('Nome').fill(nome);
  await page.getByLabel('CNPJ').fill(cnpj);
  await page.getByLabel('Natureza jurídica').selectOption({ label: 'Entidades empresariais' });
  await proxima(page);
  await etapa(page, 'Entidades empresariais');
}

test.describe('Cadastro de pessoa jurídica', () => {
  test('quando a empresa é cadastrada com o tipo de entidade, então aparece na lista com o CNPJ formatado', async ({ page }) => {
    // Dado
    await comecarEmpresa(page, 'padaria contrato e2e ltda');
    await page.getByText('Sociedade Empresária Limitada', { exact: true }).click();
    await proxima(page);
    await etapa(page, 'Pessoa jurídica');
    // Então (o CNPJ da primeira etapa já vem preenchido)
    await expect(page.getByLabel('CNPJ')).toHaveValue(CNPJ_LIVRE);
    // Quando
    await proxima(page);
    await etapa(page, 'Endereço');
    await proxima(page);
    await page.getByRole('textbox', { name: 'Telefone' }).fill('3832220000');
    await page.getByRole('button', { name: 'Salvar cadastro' }).click();
    // Então
    await expect(page).toHaveURL(/\/pessoas\/\?id=/);
    await page.goto('/pessoas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('searchbox').fill('padaria contrato');
    await expect(page.getByRole('row').filter({ hasText: 'PADARIA CONTRATO E2E LTDA' })).toContainText(CNPJ_LIVRE);
  });

  test('quando o CNPJ tem letras, mesmo digitado em minúsculas e sem máscara, então é aceito, formatado e achado na busca', async ({ page }) => {
    // Dado
    await comecarEmpresa(page, 'empresa alfanumerica e2e ltda', '12abc34501de35');
    await page.getByText('Sociedade Empresária Limitada', { exact: true }).click();
    await proxima(page);
    await etapa(page, 'Pessoa jurídica');
    await expect(page.getByLabel('CNPJ')).toHaveValue(CNPJ_COM_LETRAS);
    await proxima(page);
    await etapa(page, 'Endereço');
    await proxima(page);
    await page.getByRole('textbox', { name: 'Telefone' }).fill('3832220001');
    // Quando
    await page.getByRole('button', { name: 'Salvar cadastro' }).click();
    await expect(page).toHaveURL(/\/pessoas\/\?id=/);
    await page.goto('/pessoas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('searchbox').fill(CNPJ_COM_LETRAS);
    // Então
    await expect(page.getByRole('row').filter({ hasText: 'EMPRESA ALFANUMERICA E2E LTDA' })).toContainText(CNPJ_COM_LETRAS);
  });

  test('quando a empresa é MEI e o gênero do titular não foi escolhido, então a etapa pede o gênero', async ({ page }) => {
    // Dado
    await comecarEmpresa(page, 'fulana mei e2e');
    await page.getByText('Microempreendedor(a) Individual (MEI)', { exact: true }).click();
    await proxima(page);
    await etapa(page, 'Pessoa jurídica');
    // Quando
    await proxima(page);
    // Então
    await expect(page.getByText('Selecione o gênero do(a) titular (usado na concordância da qualificação).')).toBeVisible();
    await etapa(page, 'Pessoa jurídica');
  });

  test('quando o CNPJ da primeira etapa tem dígito errado, então a etapa avisa e não segue', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/nova/');
    await page.getByText('Pessoa jurídica', { exact: true }).click();
    await page.getByLabel('Nome').fill('empresa errada');
    // Quando
    await page.getByLabel('CNPJ').fill('12345678000196');
    await proxima(page);
    // Então
    await expect(page.getByText('CNPJ inválido: confira os números.')).toBeVisible();
    await etapa(page, 'Dados da empresa');
  });
});

test.describe('Cadastro de somente contato', () => {
  test('quando o cadastro é só de contato, então vai direto do nome para o contato e é salvo', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/nova/');
    await page.getByText('Somente informações de contato', { exact: true }).click();
    await etapa(page, 'Identificação');
    await page.getByLabel('Nome').fill('contato e2e');
    // Quando
    await proxima(page);
    await etapa(page, 'Contato');
    await page.getByRole('textbox', { name: 'Telefone' }).fill('38999990000');
    await page.getByRole('button', { name: 'Salvar cadastro' }).click();
    // Então
    await expect(page).toHaveURL(/\/pessoas\/\?id=/);
  });

  test('quando falta o nome, então a etapa pede o nome', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/nova/');
    await page.getByText('Somente informações de contato', { exact: true }).click();
    await etapa(page, 'Identificação');
    // Quando
    await proxima(page);
    // Então
    await expect(page.getByText('Informe o nome.')).toBeVisible();
  });
});

test.describe('Validações das etapas', () => {
  /** Pessoa física válida até a etapa de endereço. */
  async function ateEndereco(page: Page) {
    await page.goto('/pessoas/nova/');
    await page.getByText('Pessoa física', { exact: true }).click();
    await page.getByLabel('Nome').fill('validacao e2e');
    await proxima(page);
    await page.getByText('Masculino', { exact: true }).click();
    await page.getByLabel('CPF').fill('31572498609');
  }

  test('quando a data de nascimento não existe, então a etapa avisa e não segue', async ({ page }) => {
    // Dado
    await ateEndereco(page);
    // Quando
    await page.getByLabel('Data de nascimento').fill('31021980');
    await proxima(page);
    // Então
    await expect(page.getByText('Data inexistente.')).toBeVisible();
    await etapa(page, 'Pessoa física');
  });

  test('quando o CEP tem menos de 8 dígitos, então o endereço avisa', async ({ page }) => {
    // Dado
    await ateEndereco(page);
    await proxima(page);
    await etapa(page, 'Endereço');
    // Quando
    await page.getByLabel('CEP').fill('3940');
    await proxima(page);
    // Então
    await expect(page.getByText('O CEP tem 8 dígitos.')).toBeVisible();
  });

  test('quando o telefone não tem DDD ou o e-mail está mal escrito, então o contato avisa', async ({ page }) => {
    // Dado
    await ateEndereco(page);
    await proxima(page);
    await proxima(page);
    await etapa(page, 'Contato');
    // Quando
    await page.getByRole('textbox', { name: 'Telefone' }).fill('99999');
    await page.getByRole('textbox', { name: 'E-mail' }).fill('maria.exemplo.com');
    await page.getByRole('button', { name: 'Salvar cadastro' }).click();
    // Então
    await expect(page.getByText('Confira os telefones: use DDD + número.')).toBeVisible();
    await expect(page.getByText('Confira o formato do e-mail.')).toBeVisible();
  });

  test('quando a base legal é consentimento e a data não existe, então o contato pede a data', async ({ page }) => {
    // Dado
    await ateEndereco(page);
    await proxima(page);
    await proxima(page);
    await page.getByRole('textbox', { name: 'Telefone' }).fill('38999990000');
    // Quando
    await page.getByLabel('Base legal para o tratamento dos dados (LGPD)').selectOption({ value: 'consentimento' });
    await page.getByLabel('Data do consentimento').fill('31022026');
    await page.getByRole('button', { name: 'Salvar cadastro' }).click();
    // Então
    await expect(page.getByText('Data inexistente.')).toBeVisible();
  });
});
