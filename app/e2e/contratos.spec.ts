// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Na semente do banco fictício há 6 contratos (MA96-0001 a 0006). Mateus, que está logado, tem a sigla MA96.
import { expect, test, type Page } from '@playwright/test';
import { abrir } from './ajudantes';

const ANO = new Date().getFullYear();

/** Escolhe uma pessoa do cadastro num campo de busca (Cliente, Participante, Indicador). */
async function escolherPessoa(page: Page, campo: string, busca: string, nome: string) {
  await page.getByRole('textbox', { name: campo, exact: true }).fill(busca);
  await page.getByRole('button', { name: new RegExp(nome) }).click();
}

/** Preenche os quatro campos obrigatórios (o responsável já vem como quem está logado). */
async function preencherObrigatorios(page: Page) {
  await page.goto('/contratos/novo/');
  await escolherPessoa(page, 'Cliente', 'luciana', 'LUCIANA ROCHA AMOSTRA');
  await page.getByRole('combobox', { name: 'Objeto 1' }).fill('Registro de marca no INPI');
  await page.getByLabel('Categoria de honorário').selectOption({ label: 'Pró-labore' });
}

test.describe('Cadastro de contratos', () => {
  test('quando a pessoa salva um contrato com os campos obrigatórios, então ele ganha o número e aparece na primeira coluna e na tabela', async ({ page }) => {
    // Dado
    await preencherObrigatorios(page);
    // Quando
    await page.getByRole('button', { name: 'Salvar contrato' }).click();
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'LUCIANA ROCHA AMOSTRA' })).toBeVisible();
    await expect(cartao).toContainText(`MA96-0007-${ANO}`);
    await expect(page.getByRole('row').filter({ hasText: 'LUCIANA ROCHA AMOSTRA' })).toContainText(`MA96-0007-${ANO}`);
    await page.goto('/contratos/');
    await page.getByRole('button', { name: 'Kanban' }).click();
    await expect(page.getByRole('list', { name: 'Em negociação', exact: true }).getByRole('listitem').filter({ hasText: 'LUCIANA ROCHA AMOSTRA' })).toBeVisible();
  });

  test('quando falta o que é obrigatório, então o formulário avisa e não salva', async ({ page }) => {
    // Dado
    await page.goto('/contratos/novo/');
    // Quando
    await page.getByRole('button', { name: 'Salvar contrato' }).click();
    // Então
    await expect(page.getByText('Escolha o cliente.')).toBeVisible();
    await expect(page.getByText('Informe ao menos um objeto do contrato.')).toBeVisible();
    await expect(page.getByText('Escolha a categoria de honorário.')).toBeVisible();
    await expect(page).toHaveURL(/\/contratos\/novo\/$/);
  });

  test('quando valor, entrada, parcelas e percentuais são preenchidos, então a parcela e o % do responsável aparecem calculados', async ({ page }) => {
    // Dado
    await preencherObrigatorios(page);
    // Quando
    await page.getByLabel('Valor do contrato').fill('5000');
    await page.getByLabel('Entrada').fill('1000');
    await page.getByLabel('Parcelas').fill('5');
    await escolherPessoa(page, 'Participante', 'carla', 'CARLA BEATRIZ PROTÓTIPO');
    await page.getByLabel('% do participante').fill('20');
    // Então
    await expect(page.getByRole('status', { name: 'Valor da parcela' })).toHaveText(/1\.000,00/);
    await expect(page.getByRole('status', { name: 'Fica com o responsável' })).toHaveText('80%');
  });
});

test.describe('Objetos do contrato', () => {
  test('quando a pessoa acrescenta objetos e tira um, então o contrato salvo mostra os que ficaram, na ordem', async ({ page }) => {
    // Dado
    await preencherObrigatorios(page);
    // Quando: Enter no último objeto abre uma linha nova
    await page.getByRole('combobox', { name: 'Objeto 1' }).press('Enter');
    await page.getByRole('combobox', { name: 'Objeto 2' }).fill('Oposição');
    await page.getByRole('button', { name: 'Adicionar objeto' }).click();
    await page.getByRole('combobox', { name: 'Objeto 3' }).fill('Busca de anterioridade');
    await page.getByRole('button', { name: 'Tirar o objeto 2' }).click();
    await page.getByRole('button', { name: 'Salvar contrato' }).click();
    // Então
    const objetos = page.getByRole('dialog').getByRole('list', { name: 'Objetos do contrato' }).getByRole('listitem');
    await expect(objetos).toHaveText(['Registro de marca no INPI', 'Busca de anterioridade']);
    await expect(page.getByRole('row').filter({ hasText: 'LUCIANA ROCHA AMOSTRA' })).toContainText('Registro de marca no INPI; Busca de anterioridade');
  });

  test('quando um contrato é salvo, então os objetos dele aparecem como sugestão no próximo cadastro', async ({ page }) => {
    // Dado
    await preencherObrigatorios(page);
    await page.getByRole('combobox', { name: 'Objeto 1' }).fill('Notificação extrajudicial');
    await page.getByRole('button', { name: 'Salvar contrato' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    // Quando
    await page.goto('/contratos/novo/');
    // Então
    await expect(page.getByRole('option', { name: 'Notificação extrajudicial', includeHidden: true })).toHaveCount(1);
  });
});

test.describe('Contrato salvo', () => {
  test('quando o contrato muda de responsável e de situação, então o número continua o mesmo e o histórico registra', async ({ page }) => {
    // Dado: JOSÉ DA SILVA TESTE tem o contrato MA96-0001, em "Assinado / em andamento"
    await page.goto('/inicio/');
    await abrir(page, 'Contratos');
    await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).click();
    await page.getByRole('dialog').getByRole('link', { name: 'Atualizar contrato' }).click();
    // Quando
    await page.getByLabel('Advogado responsável').selectOption({ label: 'Ana Teste Lima' });
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await page.getByRole('dialog').getByLabel('Situação do contrato').selectOption({ label: 'Encerrado' });
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao).toContainText(`MA96-0001-${ANO}`);
    await expect(cartao.getByRole('definition').filter({ hasText: 'Ana Teste Lima' })).toBeVisible();
    await cartao.getByRole('button', { name: /Histórico de alterações/ }).click();
    await expect(cartao.getByText('Situação: Assinado / em andamento → Encerrado')).toBeVisible();
    await expect(cartao.getByText('Responsável: Mateus Freitas Gonçalves → Ana Teste Lima')).toBeVisible();
  });

  test('quando se busca pelo código antigo da planilha, então o contrato é encontrado', async ({ page }) => {
    // Dado
    await page.goto('/contratos/');
    // Quando
    await page.getByRole('searchbox').fill('ma96-jo25');
    // Então
    await expect(page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'MARIA APARECIDA EXEMPLO' })).toHaveCount(0);
  });

  test('quando a pessoa arrasta o contrato para outra coluna, então ele continua lá depois de recarregar', async ({ page }) => {
    // Dado: MARIA APARECIDA EXEMPLO está em "Em negociação"
    await page.goto('/contratos/');
    await page.getByRole('button', { name: 'Kanban' }).click();
    const negociacao = page.getByRole('list', { name: 'Em negociação', exact: true });
    const aguardando = page.getByRole('list', { name: 'Aguardando assinatura', exact: true });
    const maria = negociacao.getByRole('listitem').filter({ hasText: 'MARIA APARECIDA EXEMPLO' });
    await expect(maria).toBeVisible();
    // Quando
    await maria.dragTo(aguardando);
    // Então
    await expect(aguardando.getByRole('listitem').filter({ hasText: 'MARIA APARECIDA EXEMPLO' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('list', { name: 'Aguardando assinatura', exact: true }).getByRole('listitem').filter({ hasText: 'MARIA APARECIDA EXEMPLO' })).toBeVisible();
  });
});
